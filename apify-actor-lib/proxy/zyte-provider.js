/**
 * Zyte Smart Proxy Provider
 *
 * Provedor de proxy inteligente da Zyte com AI.
 * Modelo de preço: pay-per-request
 *
 * Features:
 * - CAPTCHA bypass automático
 * - Rotação inteligente
 * - Browser rendering integrado
 * - $0.06-$15.98 / 1000 requests
 *
 * Docs: https://www.zyte.com/smart-proxy-manager/
 * GitHub: https://github.com/zytedata/zyte-smartproxy-plugin
 */

import { BaseProxyProvider } from './base-provider.js';

export class ZyteProxyProvider extends BaseProxyProvider {
  constructor(config = {}) {
    super('Zyte', config);

    // Configuração
    this.apiKey = config.apiKey || process.env.ZYTE_API_KEY || '';
    this.staticBypass = config.staticBypass ?? (process.env.ZYTE_STATIC_BYPASS !== 'false');
    this.profile = config.profile || process.env.ZYTE_PROFILE || 'desktop';

    // Pricing tiers (baseado em request type e complexidade do site)
    // Valores em USD per 1000 requests (PAYG)
    this.pricingTiers = {
      http: [0.13, 0.39, 0.75, 1.03, 1.27],      // HTTP requests
      browser: [1.00, 3.49, 6.99, 11.49, 15.98]  // Browser rendering
    };

    // Default: tier 1, HTTP
    this.defaultTier = config.defaultTier || parseInt(process.env.ZYTE_DEFAULT_TIER) || 1;
    this.defaultRequestType = config.defaultRequestType || process.env.ZYTE_DEFAULT_REQUEST_TYPE || 'http';

    this.enabled = config.enabled ?? (process.env.ZYTE_ENABLED === 'true');

    // Plugin será carregado dinamicamente
    this.pluginLoaded = false;
  }

  /**
   * Retorna null (Zyte usa plugin no launcher, não proxy config)
   */
  getPlaywrightConfig() {
    // Zyte não usa proxy config tradicional
    // Usa plugin no launcher
    return null;
  }

  /**
   * Configura o launcher com plugin Zyte
   * IMPORTANTE: Este método modifica o chromium launcher
   */
  async setupLauncher(chromium) {
    if (!this.enabled || !this.apiKey) {
      console.warn('⚠️  [Zyte] Não habilitado ou API key ausente, usando launcher padrão');
      return chromium;
    }

    try {
      // Importação dinâmica dos plugins
      const { chromium: chromiumExtra } = await import('playwright-extra');
      const SmartProxyPlugin = (await import('zyte-smartproxy-plugin')).default;

      // Opcional: Stealth plugin
      let StealthPlugin;
      try {
        StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
      } catch (error) {
        console.warn('⚠️  [Zyte] Stealth plugin não disponível, continuando sem ele');
      }

      // Configurar plugin Zyte
      chromiumExtra.use(SmartProxyPlugin({
        spm_apikey: this.apiKey,
        static_bypass: this.staticBypass,
        headers: {
          'X-Crawlera-Profile': this.profile
        }
      }));

      // Adicionar stealth se disponível
      if (StealthPlugin) {
        chromiumExtra.use(StealthPlugin());
      }

      this.pluginLoaded = true;
      console.log('✅ [Zyte] Smart Proxy plugin configurado');
      console.log(`   - API Key: ${this.apiKey.substring(0, 10)}...`);
      console.log(`   - Static Bypass: ${this.staticBypass}`);
      console.log(`   - Profile: ${this.profile}`);

      return chromiumExtra;

    } catch (error) {
      console.error('❌ [Zyte] Erro ao carregar plugin:', error.message);
      console.error('   Certifique-se de instalar: npm install playwright-extra zyte-smartproxy-plugin');
      console.error('   Usando launcher padrão sem proxy');
      return chromium;
    }
  }

  /**
   * Calcula custo baseado em requests
   */
  calculateCost(estimatedMB, metadata = {}) {
    const tier = metadata.tier || this.defaultTier;
    const requestType = metadata.requestType || this.defaultRequestType;

    // Tier está entre 1-5
    const tierIndex = Math.max(0, Math.min(4, tier - 1));

    // Custo por request
    const costPerRequest = this.pricingTiers[requestType]?.[tierIndex] || this.pricingTiers.http[0];

    // Custo = (custo por 1000 requests) / 1000
    return costPerRequest / 1000;
  }

  /**
   * Override logRequest para aceitar metadata de tier
   */
  logRequest(success = true, estimatedMB = 0.02, metadata = {}) {
    super.logRequest(success, estimatedMB, metadata);

    // Log específico do Zyte
    if (this.stats.totalRequests % 100 === 0) {
      console.log(`📊 [Zyte] ${this.stats.totalRequests} requests, custo estimado: $${this.stats.estimatedCost.toFixed(4)}`);
    }
  }

  /**
   * Valida configuração
   */
  isValid() {
    if (!this.enabled) return false;
    if (!this.apiKey) return false;
    return true;
  }

  /**
   * Retorna erro de validação
   */
  getValidationError() {
    if (!this.enabled) return 'Zyte não está habilitado (ZYTE_ENABLED=false)';
    if (!this.apiKey) return 'Zyte API key não configurado (ZYTE_API_KEY)';
    return null;
  }

  /**
   * Sanitiza configuração
   */
  sanitizeConfig() {
    return {
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'not set',
      staticBypass: this.staticBypass,
      profile: this.profile,
      defaultTier: this.defaultTier,
      defaultRequestType: this.defaultRequestType,
      pluginLoaded: this.pluginLoaded,
      pricing: {
        httpTier1: `$${this.pricingTiers.http[0]}/1000 req`,
        browserTier1: `$${this.pricingTiers.browser[0]}/1000 req`
      }
    };
  }

  /**
   * Override getStats para incluir info específica do Zyte
   */
  getStats() {
    const baseStats = super.getStats();

    // Estimativa de requests por tipo (assumindo default)
    const avgCostPerRequest = this.calculateCost(0.02, {});
    const estimatedRequests = this.stats.successfulRequests;

    return {
      ...baseStats,
      zyteInfo: {
        pluginLoaded: this.pluginLoaded,
        staticBypass: this.staticBypass,
        profile: this.profile,
        estimatedRequests: estimatedRequests,
        avgCostPerRequest: `$${avgCostPerRequest.toFixed(6)}`,
        estimatedTier: this.defaultTier,
        requestType: this.defaultRequestType
      }
    };
  }
}
