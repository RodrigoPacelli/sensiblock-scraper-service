/**
 * Local version of main.js with mock Actor
 * This file imports from mock instead of real apify package
 */

import { MockActor as Actor } from '../apify-actor-local-service/mock-apify-actor.js';
import { PlaywrightCrawler } from 'crawlee';

console.log('[Local] 🔧 Using MockActor for local execution');

// Initialize the Actor
await Actor.init();

// Get input from environment
const input = await Actor.getInput();

const {
    sites = ['edition.cnn.com'],
    maxArticlesPerSite = 50,
    dateFilter = 'today',
    includeImages = true,
    removeDuplicates = true,
    debug = false
} = input;

console.log('🚀 Starting Optimized News Scraper Actor');
console.log(`📰 Target sites: ${sites.join(', ')}`);
console.log(`📊 Max articles per site: ${maxArticlesPerSite}`);

const allArticles = [];
const siteConfig = {
    'edition.cnn.com': {
        name: 'CNN',
        sections: [
            { url: 'https://edition.cnn.com/world', name: 'world' },
            { url: 'https://edition.cnn.com', name: 'edition.cnn.com' },
            { url: 'https://edition.cnn.com/politics', name: 'politics' },
            { url: 'https://edition.cnn.com/business', name: 'business' },
            { url: 'https://edition.cnn.com/health', name: 'health' },
            { url: 'https://edition.cnn.com/entertainment', name: 'entertainment' },
            { url: 'https://edition.cnn.com/tech', name: 'tech' },
            { url: 'https://edition.cnn.com/style', name: 'style' },
            { url: 'https://edition.cnn.com/travel', name: 'travel' },
            { url: 'https://edition.cnn.com/sport', name: 'sports' },
            { url: 'https://edition.cnn.com/videos', name: 'videos' },
        ]
    }
};

// Build start URLs
const startUrls = [];
for (const site of sites) {
    if (siteConfig[site]) {
        for (const section of siteConfig[site].sections) {
            startUrls.push({
                url: section.url,
                userData: {
                    site,
                    source: siteConfig[site].name,
                    section: section.name
                }
            });
        }
    }
}

// Playwright crawler
const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: startUrls.length,
    maxConcurrency: 2,
    async requestHandler({ page, request }) {
        const { site, source, section } = request.userData;

        // Extract articles (no limit) - pass section as parameter
        const articles = await page.$$eval('article, .card, [class*="article"]', (elements, sectionName) => {
            return elements.map(el => {
                const titleEl = el.querySelector('h2, h3, h4, [class*="headline"]');
                const linkEl = el.querySelector('a[href*="/"]');
                const descEl = el.querySelector('p, [class*="description"]');
                const imgEl = el.querySelector('img');

                if (!titleEl || !linkEl) return null;

                return {
                    title: titleEl.textContent?.trim(),
                    url: linkEl.href,
                    description: descEl?.textContent?.trim() || '',
                    imageUrl: imgEl?.src || '',
                    section: sectionName
                };
            }).filter(Boolean);
        }, section);

        allArticles.push(...articles.map(article => ({
            ...article,
            source,
            publishedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString()
        })));

        console.log(`✅ Extracted ${articles.length} articles from ${source} - ${section}`);
    },
    failedRequestHandler({ request }) {
        console.error(`❌ Request failed: ${request.url}`);
    }
});

// Run crawler
await crawler.run(startUrls);

// Remove duplicates
const uniqueArticles = removeDuplicates
    ? Array.from(new Map(allArticles.map(a => [a.url, a])).values())
    : allArticles;

// Prepare output (no limit on articles)
const output = {
    status: 'ok',
    articles: uniqueArticles,
    totalResults: uniqueArticles.length,
    sources: [...new Set(allArticles.map(a => a.source))],
    scrapedAt: new Date().toISOString()
};

// Summary
const sectionStats = {};
uniqueArticles.forEach(a => {
    sectionStats[a.section] = (sectionStats[a.section] || 0) + 1;
});

console.log('✅ Scraping completed!');
console.log(`📊 Total articles collected: ${allArticles.length} (${uniqueArticles.length} unique)`);
console.log(`🌐 Sources: ${output.sources.join(', ')}`);
console.log(`📑 Articles by section:`);
Object.entries(sectionStats).sort((a, b) => b[1] - a[1]).forEach(([section, count]) => {
    console.log(`   - ${section}: ${count} articles`);
});

// Save the output
await Actor.pushData(output);

await Actor.exit();
