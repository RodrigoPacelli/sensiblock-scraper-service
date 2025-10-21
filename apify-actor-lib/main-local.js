/**
 * Local version of main.js with mock Actor
 * This file imports from mock instead of real apify package
 *
 * FIXED: Now supports any URL, not just CNN
 */

import { MockActor as Actor } from '../mock-apify-actor.js';
import { PlaywrightCrawler } from 'crawlee';
import { buildStartRequests, extractArticlesWithSelectors } from './utils/site-loader.js';

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

console.log('🚀 Starting Optimized News Scraper Actor (UNIVERSAL MODE)');
console.log(`📰 Target sites: ${sites.join(', ')}`);
console.log(`📊 Max articles per site: ${maxArticlesPerSite}`);

const allArticles = [];

const { startRequests, warnings } = buildStartRequests(sites);
const siteArticleCount = new Map();

warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));

if (startRequests.length === 0) {
    console.error('❌ No valid URLs to scrape!');
    await Actor.exit();
}

console.log(`📋 Total URLs to scrape: ${startRequests.length}`);

// Playwright crawler with Chromium system binary
const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: startRequests.length * 5,
    maxConcurrency: 2,
    browserPoolOptions: {
        useFingerprints: false,
        preLaunchHooks: [
            async (pageId, launchContext) => {
                launchContext.launchOptions = {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                };
            }
        ]
    },
    async requestHandler({ page, request }) {
        console.log(`🔍 Processing: ${request.url}`);

        await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((error) => {
            console.warn(`⚠️  Navigation issue on ${request.url}: ${error.message}`);
        });

        await page.waitForTimeout(3000);

        const articles = await extractArticlesWithSelectors(page, request, console);

        const domainKey = request.userData?.site || new URL(request.url).hostname;
        const alreadyCollected = siteArticleCount.get(domainKey) || 0;
        const remaining = Math.max(maxArticlesPerSite - alreadyCollected, 0);
        const limited = remaining > 0 ? articles.slice(0, remaining) : [];

        siteArticleCount.set(domainKey, alreadyCollected + limited.length);

        console.log(`📊 Extracted ${limited.length}/${articles.length} articles from ${request.userData?.source || request.url}`);

        allArticles.push(...limited);
    },
    failedRequestHandler({ request }) {
        console.error(`❌ Request failed: ${request.url}`);
    }
});

// Run crawler
console.log('🚀 Starting crawler...');
await crawler.run(startRequests);

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
