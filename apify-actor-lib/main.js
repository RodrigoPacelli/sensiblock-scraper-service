import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { setupProxy } from './proxy/index.js';
import { buildStartRequests, extractArticlesWithSelectors } from './utils/site-loader.js';

await Actor.init();

const input = await Actor.getInput();
const {
  sites = ['edition.cnn.com'],
  maxArticlesPerSite = 500
} = input || {};

const { chromium } = await import('playwright');
const { provider, chromium: configuredChromium, proxyConfig } = await setupProxy(chromium);

console.log('🚀 Starting Optimized News Scraper Actor (Universal Mode)');
console.log(`📰 Requested sites: ${sites.join(', ')}`);
console.log(`📊 Max articles per site: ${maxArticlesPerSite}`);

const allArticles = [];
const siteArticleCount = new Map();

const { startRequests, warnings } = buildStartRequests(sites);

warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));

if (startRequests.length === 0) {
  console.error('❌ No valid start URLs after selector validation. Aborting.');
  await Actor.pushData({ status: 'error', error: 'No valid start URLs' });
  await Actor.exit();
}

console.log(`📋 Final start URL list (${startRequests.length}):`);
startRequests.forEach((req) => console.log(`   - ${req.url}`));

const crawler = new PlaywrightCrawler({
  launchContext: {
    launcher: configuredChromium,
    useIncognitoPages: true,
    launchOptions: {
      headless: true,
      proxy: proxyConfig,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  },
  maxConcurrency: 4,
  requestHandlerTimeoutSecs: 180,
  async requestHandler({ page, request, log }) {
    const label = request.userData?.source || request.url;
    try {
      log.info(`🌐 Navigating: ${request.url}`);
      await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      const extracted = await extractArticlesWithSelectors(page, request, log);

      const domainKey = request.userData?.site || new URL(request.url).hostname;
      const alreadyCollected = siteArticleCount.get(domainKey) || 0;
      const remaining = Math.max(maxArticlesPerSite - alreadyCollected, 0);
      const limited = remaining > 0 ? extracted.slice(0, remaining) : [];

      siteArticleCount.set(domainKey, alreadyCollected + limited.length);

      allArticles.push(...limited);

      provider?.logRequest?.(true, 0.02, { tier: 1, requestType: 'http', domain: domainKey });

      log.info(`✅ ${label}: ${limited.length}/${extracted.length} articles captured (domain total: ${siteArticleCount.get(domainKey)})`);
    } catch (error) {
      provider?.logRequest?.(false, 0, { tier: 1, requestType: 'http', domain: request.userData?.site });
      log.error(`❌ Failed to process ${label}: ${error.message}`);
    }
  },
  failedRequestHandler({ request, log }) {
    provider?.logRequest?.(false, 0, { tier: 1, requestType: 'http', domain: request.userData?.site });
    log.error(`❌ Request failed: ${request.url}`);
  }
});

console.log('🚀 Starting crawler...\n');
await crawler.run(startRequests);

const uniqueArticles = Array.from(
  new Map(allArticles.map((article) => [article.url, article])).values()
);

const sources = new Set(uniqueArticles.map((article) => article.source).filter(Boolean));

const output = {
  status: 'ok',
  articles: uniqueArticles,
  totalResults: uniqueArticles.length,
  scrapedAt: new Date().toISOString(),
  sources: Array.from(sources)
};

console.log(`✅ Scraping completed! Total unique articles: ${uniqueArticles.length}`);
console.log(`🌐 Sources captured: ${output.sources.join(', ') || 'none'}`);

console.log('\n📊 Proxy Usage Statistics:');
try {
  console.log(JSON.stringify(provider?.getStats?.() || {}, null, 2));
} catch (error) {
  console.warn('⚠️ Unable to fetch proxy stats:', error.message);
}

await Actor.pushData(output);
await Actor.exit();
