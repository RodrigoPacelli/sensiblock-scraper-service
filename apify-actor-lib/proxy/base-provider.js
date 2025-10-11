/**
 * Base Proxy Provider - Interface abstrata para provedores de proxy
 *
 * Todos os provedores (Zyte, IPRoyal, etc) devem estender esta classe
 * e implementar os métodos abstratos.
 *
 * Benefícios:
 * - Fácil adicionar novos provedores
 * - Interface consistente
 * - Troca transparente de provedores
 * - Testabilidade
 */

export class BaseProxyProvider {
  constructor(name, config = {}) {
    if (new.target === BaseProxyProvider) {
      throw new Error('BaseProxyProvider é uma classe abstrata e não pode ser instanciada diretamente');
    }

    this.name = name;
    this.config = config;
    this.enabled = config.enabled ?? false;

    // Estatísticas compartilhadas
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBandwidthMB: 0,
      estimatedCost: 0
    };
  }

  /**
   * Retorna configuração de proxy para Playwright/Crawlee
   * @abstract
   * @returns {Object|null} Configuração de proxy ou null
   */
  getPlaywrightConfig() {
    throw new Error('Método getPlaywrightConfig() deve ser implementado');
  }

  /**
   * Configura o browser launcher (para provedores que precisam modificar o launcher)
   * @abstract
   * @param {Object} chromium - Chromium launcher do Playwright
   * @returns {Object} Launcher configurado
   */
  async setupLauncher(chromium) {
    // Default: retorna launcher sem modificações
    return chromium;
  }

  /**
   * Registra uma requisição
   * @param {boolean} success - Se a requisição foi bem-sucedida
   * @param {number} estimatedMB - Tamanho estimado em MB
   * @param {Object} metadata - Metadados adicionais (tier, tipo, etc)
   */
  logRequest(success = true, estimatedMB = 0.02, metadata = {}) {
    this.stats.totalRequests++;
    this.stats.totalBandwidthMB += estimatedMB;

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Calcular custo (pode ser sobrescrito por subclasses)
    this.stats.estimatedCost += this.calculateCost(estimatedMB, metadata);
  }

  /**
   * Calcula custo estimado de uma requisição
   * @abstract
   * @param {number} estimatedMB - Tamanho estimado em MB
   * @param {Object} metadata - Metadados (tier, tipo, etc)
   * @returns {number} Custo em USD
   */
  calculateCost(estimatedMB, metadata = {}) {
    // Default: sem custo
    return 0;
  }

  /**
   * Retorna estatísticas do provedor
   * @returns {Object} Estatísticas
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0
      ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2)
      : '0.00';

    return {
      provider: this.name,
      enabled: this.enabled,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      successRate: `${successRate}%`,
      totalBandwidthMB: this.stats.totalBandwidthMB.toFixed(2),
      totalBandwidthGB: (this.stats.totalBandwidthMB / 1024).toFixed(3),
      estimatedCost: `$${this.stats.estimatedCost.toFixed(4)}`
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBandwidthMB: 0,
      estimatedCost: 0
    };
  }

  /**
   * Retorna informações de configuração (sem senhas)
   * @returns {Object} Configuração
   */
  getConfig() {
    return {
      provider: this.name,
      enabled: this.enabled,
      config: this.sanitizeConfig()
    };
  }

  /**
   * Sanitiza configuração removendo dados sensíveis
   * @abstract
   * @returns {Object} Configuração sanitizada
   */
  sanitizeConfig() {
    return {
      ...this.config,
      apiKey: this.config.apiKey ? '***configured***' : 'not set',
      password: this.config.password ? '***configured***' : 'not set'
    };
  }

  /**
   * Valida se o provedor está configurado corretamente
   * @abstract
   * @returns {boolean} True se válido
   */
  isValid() {
    return this.enabled;
  }

  /**
   * Retorna mensagem de erro se configuração inválida
   * @returns {string|null} Mensagem de erro ou null
   */
  getValidationError() {
    if (!this.enabled) {
      return `${this.name} não está habilitado`;
    }
    return null;
  }
}
