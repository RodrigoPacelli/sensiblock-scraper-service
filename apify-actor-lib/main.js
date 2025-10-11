import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { setupProxy } from './proxy/index.js';

// Configuração otimizada com seletores multi-nível (headlines, articles, fallback)
const SITE_CONFIGS = {
    'edition.cnn.com': {
        domain: 'edition.cnn.com',
        name: 'CNN',
        baseUrl: 'https://edition.cnn.com',
        // URLs de seções para navegação profunda
        sections: [
            'https://edition.cnn.com',                    // Homepage
            'https://edition.cnn.com/world',              // World
            'https://edition.cnn.com/politics',           // Politics
            'https://edition.cnn.com/business',           // Business
            'https://edition.cnn.com/health',             // Health
            'https://edition.cnn.com/entertainment',      // Entertainment
            'https://edition.cnn.com/tech',               // Tech
            'https://edition.cnn.com/style',              // Style
            'https://edition.cnn.com/travel',             // Travel
            'https://edition.cnn.com/sports',             // Sports
            'https://edition.cnn.com/videos'              // Videos
        ],
        // Seletores genéricos para capturar TODOS os cards
        selectors: {
            headlines: {
                container: 'li.card.container',
                title: [
                    'span.container__headline',
                    '.container__headline',
                    'h2',
                    'h3'
                ],
                link: ['a'],
                image: ['img'],
                description: [
                    '.container__description',
                    'p'
                ]
            },
            articles: {
                container: 'li.card.container',
                title: [
                    'span.container__headline',
                    '.container__headline',
                    'h3',
                    'h2'
                ],
                link: ['a'],
                image: ['img'],
                description: [
                    '.container__description',
                    'p'
                ]
            },
            fallback: {
                container: 'div.container, article, .card',
                title: [
                    'span.container__headline',
                    '.container__headline',
                    'h2',
                    'h3',
                    '.headline__text'
                ],
                link: ['a'],
                image: ['img'],
                description: ['p', '.description']
            }
        },
        confidence: 0.95
    }
};

await Actor.init();

const input = await Actor.getInput();
const {
    sites = ['edition.cnn.com'], // Default: apenas CNN
    maxArticlesPerSite = 500, // Aumentado para capturar TUDO
    timeout = 30000
} = input || {};

// 🔒 Setup Proxy System (Modular & Plugável)
// Detecta automaticamente qual proxy usar via PROXY_PROVIDER env var
// Opções: 'none', 'iproyal', 'zyte'
const { chromium } = await import('playwright');
const { provider, chromium: configuredChromium, proxyConfig } = await setupProxy(chromium);

console.log('🚀 Starting Optimized News Scraper Actor');
console.log(`📰 Target sites: ${sites.join(', ')}`);
console.log(`📊 Max articles per site: ${maxArticlesPerSite}`);

const allArticles = [];

const crawler = new PlaywrightCrawler({
    launchContext: {
        launcher: configuredChromium, // Usa launcher configurado pelo proxy
        useIncognitoPages: true,
        launchOptions: {
            headless: true,
            proxy: proxyConfig, // Config de proxy (IPRoyal) ou null (Zyte/None)
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        }
    },

    maxConcurrency: 4, // Processar 4 seções em paralelo para acelerar
    requestHandlerTimeoutSecs: 120, // 2 minutos por seção (captura todos os artigos)

    async requestHandler({ page, request, log }) {
        const url = request.loadedUrl || request.url;
        const domain = new URL(url).hostname;
        const siteConfig = SITE_CONFIGS[domain];
        const sectionName = request.userData?.sectionName || 'unknown';

        if (!siteConfig) {
            log.warning(`No configuration found for domain: ${domain}`);
            return;
        }

        log.info(`📄 Processing ${siteConfig.name} - Section: ${sectionName} (${url})`);

        try {
            // Wait for page load
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000); // Wait for dynamic content

            // OTIMIZAÇÃO: Extrair TODOS os artigos de uma vez usando page.evaluate
            const articles = await page.evaluate((config) => {
                const results = [];

                // Função auxiliar para limpar texto
                const cleanText = (text) => {
                    if (!text) return '';
                    return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                };

                // Função auxiliar para obter URL absoluta
                const getAbsoluteUrl = (url, baseUrl) => {
                    if (!url) return '';
                    if (url.startsWith('http')) return url;
                    try {
                        return new URL(url, baseUrl).href;
                    } catch {
                        return '';
                    }
                };

                // Função para tentar múltiplos seletores (retorna primeiro match)
                const trySelectors = (container, selectors) => {
                    if (!selectors) return null;
                    for (const selector of selectors) {
                        const el = container.querySelector(selector);
                        if (el) return el;
                    }
                    return null;
                };

                // Blacklist de URLs que não são artigos
                const urlBlacklist = [
                    '/account/', '/settings', '/newsletters', '/audio', '/live-tv',
                    '/profiles', '/weather', '/more', '/intl_index', '/app-international-edition',
                    '/search', '/videos', '#', 'mailto:', 'javascript:'
                ];

                // Blacklist de títulos
                const titleBlacklist = [
                    'settings', 'newsletters', 'audio', 'live tv', 'search', 'menu',
                    'watch', 'listen', 'more', 'follow', 'log in', 'sign up'
                ];

                // Função para extrair dados de um container
                const extractFromContainer = (container, selectorConfig, contentType) => {
                    try {
                        // Extrair URL
                        let url = '';
                        const linkEl = trySelectors(container, selectorConfig.link) || container.querySelector('a') || container.closest('a');
                        if (linkEl) {
                            url = linkEl.getAttribute('href') || '';
                        }

                        // Filtrar URLs da blacklist
                        if (url && urlBlacklist.some(blocked => url.toLowerCase().includes(blocked))) {
                            return null;
                        }

                        // Extrair título
                        let title = '';
                        const titleEl = trySelectors(container, selectorConfig.title);
                        if (titleEl && titleEl.textContent.trim()) {
                            title = titleEl.textContent;
                        }

                        // Fallback: usar texto do link
                        if (!title && linkEl) {
                            title = linkEl.textContent || linkEl.getAttribute('aria-label') || '';
                        }

                        // Filtrar títulos da blacklist
                        if (title && titleBlacklist.some(blocked => title.toLowerCase().includes(blocked))) {
                            return null;
                        }

                        // Extrair imagem
                        let urlToImage = '';
                        const imgEl = trySelectors(container, selectorConfig.image) || container.querySelector('img');
                        if (imgEl) {
                            urlToImage = imgEl.getAttribute('src') ||
                                        imgEl.getAttribute('data-src') ||
                                        imgEl.getAttribute('data-lazy-src') || '';
                        }

                        // Extrair descrição
                        let description = '';
                        const descEl = trySelectors(container, selectorConfig.description);
                        if (descEl && descEl.textContent.trim()) {
                            description = descEl.textContent;
                        }

                        // Validar dados mínimos
                        if (!title || !url) {
                            return null;
                        }

                        // Data de publicação = timestamp do scraper
                        const publishedAt = new Date().toISOString();

                        return {
                            title: cleanText(title),
                            description: cleanText(description) || cleanText(title),
                            url: getAbsoluteUrl(url, config.baseUrl),
                            urlToImage: getAbsoluteUrl(urlToImage, config.baseUrl),
                            publishedAt,
                            type: contentType,
                            source: {
                                name: config.name,
                                domain: config.domain || window.location.hostname
                            }
                        };

                    } catch (error) {
                        console.warn(`Error extracting ${contentType}:`, error.message);
                        return null;
                    }
                };

                // 1. Tentar manchetes principais (headlines)
                if (config.selectors.headlines) {
                    const headlineContainers = document.querySelectorAll(config.selectors.headlines.container);
                    for (let i = 0; i < headlineContainers.length; i++) {
                        const article = extractFromContainer(headlineContainers[i], config.selectors.headlines, 'headlines');
                        if (article) results.push(article);
                    }
                }

                // 2. Tentar artigos regulares (articles)
                if (config.selectors.articles) {
                    const articleContainers = document.querySelectorAll(config.selectors.articles.container);
                    for (let i = 0; i < articleContainers.length; i++) {
                        const article = extractFromContainer(articleContainers[i], config.selectors.articles, 'articles');
                        if (article) results.push(article);
                    }
                }

                // 3. Fallback genérico - captura elementos FORA de li.card.container
                // Estratégia: usar fallback para pegar div.container, article, .card standalone
                if (config.selectors.fallback) {
                    const capturedUrls = new Set(results.map(r => r.url));
                    const fallbackContainers = document.querySelectorAll(config.selectors.fallback.container);

                    let fallbackTotal = 0;
                    let fallbackInsideCard = 0;
                    let fallbackCaptured = 0;

                    for (let i = 0; i < fallbackContainers.length; i++) {
                        const container = fallbackContainers[i];
                        fallbackTotal++;

                        // IMPORTANTE: Pular se estiver DENTRO de um li.card.container
                        if (container.closest('li.card.container')) {
                            fallbackInsideCard++;
                            continue; // Já foi capturado
                        }

                        const article = extractFromContainer(container, config.selectors.fallback, 'fallback');

                        // Só adicionar se não foi capturado antes (evitar duplicatas por URL)
                        if (article && !capturedUrls.has(article.url)) {
                            results.push(article);
                            capturedUrls.add(article.url);
                            fallbackCaptured++;
                        }
                    }

                    console.log(`📊 Fallback stats: ${fallbackTotal} total, ${fallbackInsideCard} inside li.card, ${fallbackCaptured} captured`);
                    console.log(`📊 Final result: ${results.length} articles (${results.length - capturedUrls.size} from cards, ${fallbackCaptured} from fallback)`);
                }

                return results;

            }, siteConfig); // Passar config para o contexto do browser

            // Limitar artigos por seção
            const limitedArticles = articles.slice(0, maxArticlesPerSite);

            // Adicionar metadados da seção aos artigos
            const articlesWithSection = limitedArticles.map(article => ({
                ...article,
                section: sectionName,
                sectionUrl: url
            }));

            allArticles.push(...articlesWithSection);

            // 📊 Log request no provider (para estatísticas e custo)
            provider.logRequest(true, 0.02, { tier: 1, requestType: 'http' });

            log.info(`✅ Extracted ${articlesWithSection.length} articles from ${siteConfig.name} - ${sectionName}`);

        } catch (error) {
            // 📊 Log falha no provider
            provider.logRequest(false, 0, { tier: 1, requestType: 'http' });

            log.error(`❌ Failed to process ${siteConfig.name}: ${error.message}`);
        }
    },

    failedRequestHandler({ request, log }) {
        // 📊 Log falha no provider
        provider.logRequest(false, 0, { tier: 1, requestType: 'http' });

        log.error(`❌ Request failed: ${request.url}`);
    }
});

// Add URLs to the queue - incluindo todas as seções
for (const site of sites) {
    if (SITE_CONFIGS[site]) {
        const config = SITE_CONFIGS[site];

        // Se tem seções definidas, adicionar cada uma
        if (config.sections && config.sections.length > 0) {
            const requests = config.sections.map((sectionUrl, index) => ({
                url: sectionUrl,
                uniqueKey: `${site}-section-${index}`,
                userData: {
                    site: site,
                    section: sectionUrl,
                    sectionName: sectionUrl.split('/').pop() || 'homepage'
                }
            }));
            await crawler.addRequests(requests);
            console.log(`📋 Added ${requests.length} sections for ${site}`);
        } else {
            // Fallback: apenas homepage
            await crawler.addRequests([{
                url: config.baseUrl,
                uniqueKey: site,
                userData: { site: site, section: 'homepage' }
            }]);
        }
    } else {
        console.warn(`⚠️ Site not supported: ${site}`);
    }
}

// Run the crawler
await crawler.run();

// Remove duplicates based on URL
const uniqueArticles = [];
const seenUrls = new Set();
const sectionStats = {};

for (const article of allArticles) {
    if (article.url && !seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        uniqueArticles.push(article);

        // Contabilizar por seção
        const section = article.section || 'unknown';
        sectionStats[section] = (sectionStats[section] || 0) + 1;
    }
}

// Prepare output in NewsAPI format
const output = {
    articles: uniqueArticles,
    totalResults: uniqueArticles.length,
    status: 'ok',
    scrapedAt: new Date().toISOString(),
    sources: sites.map(site => SITE_CONFIGS[site]?.name).filter(Boolean),
    sectionStats: sectionStats
};

console.log(`✅ Scraping completed!`);
console.log(`📊 Total articles collected: ${allArticles.length} (${output.totalResults} unique)`);
console.log(`🌐 Sources: ${output.sources.join(', ')}`);
console.log(`📑 Articles by section:`);
Object.entries(sectionStats).sort((a, b) => b[1] - a[1]).forEach(([section, count]) => {
    console.log(`   - ${section}: ${count} articles`);
});

// 🔒 Proxy Statistics
console.log('\n📊 Proxy Usage Statistics:');
console.log(JSON.stringify(provider.getStats(), null, 2));

// Save the output
await Actor.pushData(output);

await Actor.exit();
