/**
 * Proxy Factory - Seletor automático de provedor de proxy
 *
 * Responsável por criar e retornar o provedor de proxy correto
 * baseado em variáveis de ambiente.
 *
 * Uso:
 * ```javascript
 * import { ProxyFactory } from './proxy/proxy-factory.js';
 *
 * const factory = new ProxyFactory();
 * const provider = factory.getProvider();
 *
 * console.log(`Usando: ${provider.name}`);
 * ```
 */

import { NoProxyProvider } from './no-proxy-provider.js';
import { IPRoyalProxyProvider } from './iproyal-provider.js';
import { ZyteProxyProvider } from './zyte-provider.js';

export class ProxyFactory {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
  }

  /**
   * Registra todos os provedores disponíveis
   */
  registerProviders() {
    // No Proxy (sempre disponível)
    this.providers.set('none', new NoProxyProvider());
    this.providers.set('noproxy', new NoProxyProvider());
    this.providers.set('direct', new NoProxyProvider());

    // IPRoyal
    this.providers.set('iproyal', new IPRoyalProxyProvider({
      enabled: process.env.IPROYAL_ENABLED === 'true',
      server: process.env.IPROYAL_SERVER,
      username: process.env.IPROYAL_USERNAME,
      password: process.env.IPROYAL_PASSWORD,
      rotation: process.env.IPROYAL_ROTATION === 'true',
      sessionDuration: parseInt(process.env.IPROYAL_SESSION_DURATION) || 600000,
      pricePerGB: parseFloat(process.env.IPROYAL_PRICE_PER_GB) || 1.75
    }));

    // Zyte
    this.providers.set('zyte', new ZyteProxyProvider({
      enabled: process.env.ZYTE_ENABLED === 'true',
      apiKey: process.env.ZYTE_API_KEY,
      staticBypass: process.env.ZYTE_STATIC_BYPASS !== 'false',
      profile: process.env.ZYTE_PROFILE || 'desktop',
      defaultTier: parseInt(process.env.ZYTE_DEFAULT_TIER) || 1,
      defaultRequestType: process.env.ZYTE_DEFAULT_REQUEST_TYPE || 'http'
    }));
  }

  /**
   * Retorna o provedor baseado na configuração
   * @param {string} providerName - Nome do provedor (opcional)
   * @returns {BaseProxyProvider} Instância do provedor
   */
  getProvider(providerName = null) {
    // Se já tem um provider atual, retorna
    if (this.currentProvider) {
      return this.currentProvider;
    }

    // Registra providers se ainda não foi feito
    if (this.providers.size === 0) {
      this.registerProviders();
    }

    // Determina qual provider usar
    const name = (providerName || process.env.PROXY_PROVIDER || 'none').toLowerCase();

    // Busca o provider
    let provider = this.providers.get(name);

    if (!provider) {
      console.warn(`⚠️  Proxy provider "${name}" não encontrado, usando NoProxy`);
      provider = this.providers.get('none');
    }

    // Valida o provider
    if (!provider.isValid()) {
      const error = provider.getValidationError();
      console.warn(`⚠️  ${error}, usando NoProxy`);
      provider = this.providers.get('none');
    }

    this.currentProvider = provider;
    return provider;
  }

  /**
   * Lista todos os provedores disponíveis
   * @returns {Array} Lista de nomes de provedores
   */
  listProviders() {
    if (this.providers.size === 0) {
      this.registerProviders();
    }

    return Array.from(this.providers.keys());
  }

  /**
   * Retorna informações de todos os provedores
   * @returns {Object} Mapa com info de cada provedor
   */
  getProvidersInfo() {
    if (this.providers.size === 0) {
      this.registerProviders();
    }

    const info = {};
    for (const [name, provider] of this.providers.entries()) {
      info[name] = {
        name: provider.name,
        enabled: provider.enabled,
        valid: provider.isValid(),
        validationError: provider.getValidationError(),
        config: provider.sanitizeConfig()
      };
    }

    return info;
  }

  /**
   * Reseta o provider atual (útil para testes)
   */
  reset() {
    this.currentProvider = null;
    this.providers.clear();
  }

  /**
   * Cria um provider específico com config customizada
   * @param {string} providerName - Nome do provedor
   * @param {Object} config - Configuração customizada
   * @returns {BaseProxyProvider} Instância do provedor
   */
  createProvider(providerName, config = {}) {
    const name = providerName.toLowerCase();

    switch (name) {
      case 'none':
      case 'noproxy':
      case 'direct':
        return new NoProxyProvider(config);

      case 'iproyal':
        return new IPRoyalProxyProvider(config);

      case 'zyte':
        return new ZyteProxyProvider(config);

      default:
        throw new Error(`Provider desconhecido: ${providerName}`);
    }
  }
}

/**
 * Instância singleton da factory (opcional)
 */
let factoryInstance = null;

export function getProxyFactory() {
  if (!factoryInstance) {
    factoryInstance = new ProxyFactory();
  }
  return factoryInstance;
}
