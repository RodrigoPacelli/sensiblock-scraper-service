/**
 * Proxy System - Export central
 *
 * Exporta todos os provedores e a factory.
 *
 * Uso simplificado:
 * ```javascript
 * import { getProxyFactory } from './proxy/index.js';
 *
 * const factory = getProxyFactory();
 * const provider = factory.getProvider();
 * ```
 */

// Base
export { BaseProxyProvider } from './base-provider.js';

// Providers
export { NoProxyProvider } from './no-proxy-provider.js';
export { IPRoyalProxyProvider } from './iproyal-provider.js';
export { ZyteProxyProvider } from './zyte-provider.js';

// Factory
export { ProxyFactory, getProxyFactory } from './proxy-factory.js';

// Helper: Criar provider rapidamente
export async function setupProxy(chromium, providerName = null) {
  const { getProxyFactory } = await import('./proxy-factory.js');

  const factory = getProxyFactory();
  const provider = factory.getProvider(providerName);

  console.log(`\n🔒 Proxy Configuration:`);
  console.log(`   Provider: ${provider.name}`);
  console.log(`   Enabled: ${provider.enabled}`);
  console.log(`   Valid: ${provider.isValid()}`);

  if (!provider.isValid()) {
    const error = provider.getValidationError();
    console.warn(`   ⚠️  ${error}`);
  }

  console.log(`   Config:`, provider.sanitizeConfig());
  console.log('');

  // Setup launcher se necessário (Zyte modifica launcher)
  const configuredChromium = await provider.setupLauncher(chromium);

  return {
    provider,
    chromium: configuredChromium,
    proxyConfig: provider.getPlaywrightConfig()
  };
}
