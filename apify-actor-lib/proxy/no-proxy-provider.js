/**
 * No Proxy Provider - Modo direto sem proxy
 *
 * Usado quando não se quer usar proxy.
 * Útil para:
 * - Testes locais
 * - Sites que não bloqueiam
 * - Desenvolvimento
 */

import { BaseProxyProvider } from './base-provider.js';

export class NoProxyProvider extends BaseProxyProvider {
  constructor(config = {}) {
    super('NoProxy', config);
    this.enabled = true; // Sempre habilitado
  }

  /**
   * Retorna null (sem proxy)
   */
  getPlaywrightConfig() {
    return null;
  }

  /**
   * Não modifica o launcher
   */
  async setupLauncher(chromium) {
    return chromium;
  }

  /**
   * Sem custo (conexão direta)
   */
  calculateCost(estimatedMB, metadata = {}) {
    return 0;
  }

  /**
   * Sempre válido
   */
  isValid() {
    return true;
  }

  /**
   * Sanitiza config (vazio para NoProxy)
   */
  sanitizeConfig() {
    return {
      mode: 'direct',
      cost: '$0.00/mês'
    };
  }
}
