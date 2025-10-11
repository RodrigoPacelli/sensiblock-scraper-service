/**
 * IPRoyal Proxy Provider
 *
 * Provedor de proxies residenciais da IPRoyal.
 * Modelo de preço: pay-per-GB
 *
 * Features:
 * - 32M IPs residenciais
 * - Sticky sessions
 * - Rotação manual
 * - $1.75-$7/GB
 *
 * Docs: https://iproyal.com/
 */

import { BaseProxyProvider } from './base-provider.js';

export class IPRoyalProxyProvider extends BaseProxyProvider {
  constructor(config = {}) {
    super('IPRoyal', config);

    // Configuração
    this.server = config.server || process.env.IPROYAL_SERVER || 'geo.iproyal.com:32325';
    this.username = config.username || process.env.IPROYAL_USERNAME || '';
    this.password = config.password || process.env.IPROYAL_PASSWORD || '';

    // Rotação
    this.rotation = config.rotation ?? (process.env.IPROYAL_ROTATION === 'true');
    this.sessionDuration = config.sessionDuration ||
                          parseInt(process.env.IPROYAL_SESSION_DURATION) ||
                          600000; // 10 minutos

    // Preço por GB
    this.pricePerGB = config.pricePerGB || parseFloat(process.env.IPROYAL_PRICE_PER_GB) || 1.75;

    // Session management
    this.currentSessionId = this.generateSessionId();
    this.lastSessionRotation = Date.now();

    this.enabled = config.enabled ?? (process.env.IPROYAL_ENABLED === 'true');
  }

  /**
   * Gera ID único para sessão sticky
   */
  generateSessionId() {
    return `session-${Date.now()}`;
  }

  /**
   * Verifica se deve rotacionar sessão
   */
  shouldRotateSession() {
    if (!this.rotation) return false;
    const timeSinceRotation = Date.now() - this.lastSessionRotation;
    return timeSinceRotation >= this.sessionDuration;
  }

  /**
   * Rotaciona a sessão
   */
  rotateSession() {
    this.currentSessionId = this.generateSessionId();
    this.lastSessionRotation = Date.now();
    console.log(`🔄 [IPRoyal] Session rotated: ${this.currentSessionId}`);
  }

  /**
   * Retorna configuração de proxy para Playwright
   */
  getPlaywrightConfig() {
    if (!this.enabled || !this.server || !this.username || !this.password) {
      return null;
    }

    // Rotacionar se necessário
    if (this.shouldRotateSession()) {
      this.rotateSession();
    }

    // IPRoyal: Sticky session via username
    // Format: customer-USERNAME-session-TIMESTAMP
    const sessionUsername = this.rotation
      ? `${this.username}-${this.currentSessionId}`
      : this.username;

    return {
      server: this.server.startsWith('http')
        ? this.server
        : `http://${this.server}`,
      username: sessionUsername,
      password: this.password
    };
  }

  /**
   * Não modifica o launcher (proxy via config)
   */
  async setupLauncher(chromium) {
    return chromium;
  }

  /**
   * Calcula custo baseado em GB
   */
  calculateCost(estimatedMB, metadata = {}) {
    const gb = estimatedMB / 1024;
    return gb * this.pricePerGB;
  }

  /**
   * Valida configuração
   */
  isValid() {
    if (!this.enabled) return false;
    if (!this.server) return false;
    if (!this.username) return false;
    if (!this.password) return false;
    return true;
  }

  /**
   * Retorna erro de validação
   */
  getValidationError() {
    if (!this.enabled) return 'IPRoyal não está habilitado (IPROYAL_ENABLED=false)';
    if (!this.server) return 'IPRoyal server não configurado (IPROYAL_SERVER)';
    if (!this.username) return 'IPRoyal username não configurado (IPROYAL_USERNAME)';
    if (!this.password) return 'IPRoyal password não configurado (IPROYAL_PASSWORD)';
    return null;
  }

  /**
   * Sanitiza configuração
   */
  sanitizeConfig() {
    return {
      server: this.server,
      username: this.username ? `${this.username.split('-')[0]}-***` : 'not set',
      password: this.password ? '***configured***' : 'not set',
      rotation: this.rotation,
      sessionDuration: `${this.sessionDuration / 1000}s`,
      pricePerGB: `$${this.pricePerGB}/GB`,
      currentSession: this.currentSessionId
    };
  }

  /**
   * Override getStats para incluir info de sessão
   */
  getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      sessionInfo: {
        currentSessionId: this.currentSessionId,
        timeSinceRotation: this.getTimeSinceRotationFormatted(),
        rotationEnabled: this.rotation
      }
    };
  }

  /**
   * Tempo desde última rotação formatado
   */
  getTimeSinceRotationFormatted() {
    const ms = Date.now() - this.lastSessionRotation;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
