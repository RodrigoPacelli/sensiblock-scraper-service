/**
 * ProxyManager - Gerenciador de Proxy Residencial para Apify Actor
 *
 * Suporta:
 * - IPRoyal residential proxies
 * - Smartproxy/Decodo
 * - Bright Data
 * - Oxylabs
 *
 * Features:
 * - Sticky sessions com rotação automática
 * - Estatísticas de uso
 * - Retry strategy
 * - Cost tracking
 */

export class ProxyManager {
  constructor(config = {}) {
    // Configuração de proxy
    this.enabled = config.enabled ?? (process.env.PROXY_ENABLED === 'true');
    this.server = config.server || process.env.PROXY_SERVER || '';
    this.username = config.username || process.env.PROXY_USERNAME || '';
    this.password = config.password || process.env.PROXY_PASSWORD || '';
    this.type = config.type || process.env.PROXY_TYPE || 'residential';

    // Rotação de proxy
    this.rotation = config.rotation ?? (process.env.PROXY_ROTATION === 'true');
    this.sessionDuration = config.sessionDuration ||
                          parseInt(process.env.PROXY_SESSION_DURATION) ||
                          600000; // 10 minutos padrão

    // Monitoramento
    this.logUsage = config.logUsage ?? (process.env.PROXY_LOG_USAGE === 'true');
    this.maxRetries = config.maxRetries || parseInt(process.env.PROXY_MAX_RETRIES) || 3;

    // Estatísticas
    this.stats = {
      totalRequests: 0,
      proxyRequests: 0,
      directRequests: 0,
      failedProxyRequests: 0,
      totalBandwidthMB: 0,
      sessionId: null,
      sessionStartTime: null
    };

    // Session management
    this.currentSessionId = this.generateSessionId();
    this.lastSessionRotation = Date.now();
  }

  /**
   * Gera um ID único para sessão de proxy
   * IPRoyal format: customer-USERNAME-session-TIMESTAMP
   */
  generateSessionId() {
    const timestamp = Date.now();
    return `session-${timestamp}`;
  }

  /**
   * Verifica se deve rotacionar a sessão
   */
  shouldRotateSession() {
    if (!this.rotation) return false;

    const timeSinceRotation = Date.now() - this.lastSessionRotation;
    return timeSinceRotation >= this.sessionDuration;
  }

  /**
   * Rotaciona a sessão do proxy
   */
  rotateSession() {
    this.currentSessionId = this.generateSessionId();
    this.lastSessionRotation = Date.now();

    if (this.logUsage) {
      console.log(`🔄 Proxy session rotated: ${this.currentSessionId}`);
    }
  }

  /**
   * Retorna configuração de proxy para Playwright
   * @returns {Object|null} Configuração de proxy ou null se desabilitado
   */
  getPlaywrightConfig() {
    if (!this.enabled || !this.server || !this.username || !this.password) {
      return null;
    }

    // Verificar se deve rotacionar sessão
    if (this.shouldRotateSession()) {
      this.rotateSession();
    }

    // IPRoyal: Sticky session via username
    // Format: customer-USERNAME-session-TIMESTAMP:PASSWORD
    // Outros providers podem ter formato diferente
    const sessionUsername = this.rotation
      ? `${this.username}-${this.currentSessionId}`
      : this.username;

    const proxyConfig = {
      server: this.server.startsWith('http')
        ? this.server
        : `http://${this.server}`,
      username: sessionUsername,
      password: this.password
    };

    if (this.logUsage && this.stats.proxyRequests === 0) {
      console.log('🔒 Proxy config generated:', {
        server: proxyConfig.server,
        username: sessionUsername.replace(/customer-.*-session/, 'customer-***-session'),
        type: this.type,
        rotation: this.rotation
      });
    }

    return proxyConfig;
  }

  /**
   * Registra uso de proxy
   * @param {boolean} success - Se a requisição foi bem-sucedida
   * @param {number} estimatedMB - Tamanho estimado da requisição em MB
   */
  logRequest(success = true, estimatedMB = 0.02) {
    this.stats.totalRequests++;

    if (this.enabled) {
      this.stats.proxyRequests++;
      this.stats.totalBandwidthMB += estimatedMB;

      if (!success) {
        this.stats.failedProxyRequests++;
      }
    } else {
      this.stats.directRequests++;
    }
  }

  /**
   * Retorna estatísticas de uso
   * @returns {Object} Estatísticas detalhadas
   */
  getStats() {
    const successfulProxyRequests = this.stats.proxyRequests - this.stats.failedProxyRequests;
    const successRate = this.stats.proxyRequests > 0
      ? ((successfulProxyRequests / this.stats.proxyRequests) * 100).toFixed(2)
      : '0.00';

    const estimatedCostIPRoyal = (this.stats.totalBandwidthMB / 1024) * 1.75; // $1.75/GB
    const estimatedCostSmartproxy = (this.stats.totalBandwidthMB / 1024) * 6.00; // $6/GB

    return {
      enabled: this.enabled,
      type: this.type,
      rotation: this.rotation,
      totalRequests: this.stats.totalRequests,
      proxyRequests: this.stats.proxyRequests,
      directRequests: this.stats.directRequests,
      failedProxyRequests: this.stats.failedProxyRequests,
      successfulProxyRequests: successfulProxyRequests,
      successRate: `${successRate}%`,
      totalBandwidthMB: this.stats.totalBandwidthMB.toFixed(2),
      totalBandwidthGB: (this.stats.totalBandwidthMB / 1024).toFixed(3),
      estimatedCost: {
        iproyal: `$${estimatedCostIPRoyal.toFixed(2)}`,
        smartproxy: `$${estimatedCostSmartproxy.toFixed(2)}`
      },
      currentSession: this.currentSessionId,
      timeSinceRotation: this.getTimeSinceRotationFormatted()
    };
  }

  /**
   * Retorna tempo desde última rotação formatado
   */
  getTimeSinceRotationFormatted() {
    const ms = Date.now() - this.lastSessionRotation;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Reset de estatísticas (útil para testes)
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      proxyRequests: 0,
      directRequests: 0,
      failedProxyRequests: 0,
      totalBandwidthMB: 0,
      sessionId: null,
      sessionStartTime: null
    };
  }

  /**
   * Retorna informações de configuração (sem senhas)
   */
  getConfig() {
    return {
      enabled: this.enabled,
      server: this.server,
      username: this.username ? '***configured***' : 'not set',
      password: this.password ? '***configured***' : 'not set',
      type: this.type,
      rotation: this.rotation,
      sessionDuration: `${this.sessionDuration / 1000}s`,
      maxRetries: this.maxRetries
    };
  }
}

/**
 * ProxyMonitor - Monitor de uso de proxy com alertas
 */
export class ProxyMonitor {
  constructor(monthlyLimitGB = 10, alertThresholds = [50, 80, 90, 95]) {
    this.monthlyLimitGB = monthlyLimitGB;
    this.currentUsageGB = 0;
    this.alertThresholds = alertThresholds.sort((a, b) => a - b);
    this.alertsSent = new Set();
  }

  /**
   * Registra requisição e verifica alertas
   * @param {number} estimatedMB - Tamanho estimado em MB
   */
  trackRequest(estimatedMB = 20) {
    this.currentUsageGB += estimatedMB / 1024;

    const usagePercent = (this.currentUsageGB / this.monthlyLimitGB) * 100;

    // Verificar se deve emitir alerta
    for (const threshold of this.alertThresholds) {
      if (usagePercent >= threshold && !this.alertsSent.has(threshold)) {
        this.emitAlert(threshold, usagePercent);
        this.alertsSent.add(threshold);
      }
    }
  }

  /**
   * Emite alerta de uso
   */
  emitAlert(threshold, currentPercent) {
    const emoji = threshold >= 90 ? '🚨' : threshold >= 80 ? '⚠️' : '📊';
    console.warn(`${emoji} Proxy usage alert: ${currentPercent.toFixed(1)}% (threshold: ${threshold}%)`);
    console.warn(`   Current: ${this.currentUsageGB.toFixed(2)}GB / ${this.monthlyLimitGB}GB`);
    console.warn(`   Remaining: ${this.getRemainingGB().toFixed(2)}GB`);
  }

  /**
   * Retorna GB restante
   */
  getRemainingGB() {
    return Math.max(0, this.monthlyLimitGB - this.currentUsageGB);
  }

  /**
   * Retorna porcentagem de uso
   */
  getUsagePercent() {
    return ((this.currentUsageGB / this.monthlyLimitGB) * 100).toFixed(2);
  }

  /**
   * Reset mensal (chamar no início de cada mês)
   */
  resetMonthly() {
    this.currentUsageGB = 0;
    this.alertsSent.clear();
    console.log('✅ Proxy monitor reset for new month');
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      monthlyLimitGB: this.monthlyLimitGB,
      currentUsageGB: this.currentUsageGB.toFixed(3),
      remainingGB: this.getRemainingGB().toFixed(3),
      usagePercent: `${this.getUsagePercent()}%`,
      alertThresholds: this.alertThresholds,
      alertsTriggered: Array.from(this.alertsSent)
    };
  }
}
