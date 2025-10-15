/**
 * Local version of main.js with mock Actor
 * This file imports from mock instead of real apify package
 *
 * FIXED: Now supports any URL, not just CNN
 */

import { MockActor as Actor } from '../mock-apify-actor.js';
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

console.log('🚀 Starting Optimized News Scraper Actor (UNIVERSAL MODE)');
console.log(`📰 Target sites: ${sites.join(', ')}`);
console.log(`📊 Max articles per site: ${maxArticlesPerSite}`);

const allArticles = [];

// Build start URLs - UNIVERSAL: accept any URL
const startUrls = [];
for (const siteOrUrl of sites) {
    try {
        // Check if it's a full URL or just a domain
        let url, domain, source;

        if (siteOrUrl.startsWith('http://') || siteOrUrl.startsWith('https://')) {
            // Full URL
            url = siteOrUrl;
            const urlObj = new URL(url);
            domain = urlObj.hostname.replace('www.', '');
            source = domain.split('.')[0].toUpperCase(); // ex: 'reuters' -> 'REUTERS'
        } else {
            // Just domain
            url = `https://${siteOrUrl}`;
            domain = siteOrUrl.replace('www.', '');
            source = domain.split('.')[0].toUpperCase();
        }

        startUrls.push({
            url,
            userData: {
                site: domain,
                source,
                section: domain
            }
        });

        console.log(`📍 Added: ${url} (source: ${source})`);
    } catch (error) {
        console.error(`❌ Invalid URL: ${siteOrUrl}`, error.message);
    }
}

if (startUrls.length === 0) {
    console.error('❌ No valid URLs to scrape!');
    await Actor.exit();
}

console.log(`📋 Total URLs to scrape: ${startUrls.length}`);

// Playwright crawler
const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: startUrls.length * 5, // Allow multiple pages per site
    maxConcurrency: 2,
    async requestHandler({ page, request }) {
        const { site, source, section } = request.userData;

        console.log(`🔍 Scraping: ${request.url}`);

        // Wait for page to load
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {
            console.log(`⚠️  Timeout waiting for ${request.url}`);
        });

        // Extract articles using generic selectors that work on most news sites
        const articles = await page.$$eval(
            'article, .card, [class*="article"], [class*="story"], [class*="item"], [data-testid*="article"], [data-component*="article"]',
            (elements, sectionName) => {
                return elements.map(el => {
                    // Try multiple selectors for title
                    const titleEl = el.querySelector('h1, h2, h3, h4, [class*="headline"], [class*="title"], a[href*="/"]');

                    // Try multiple selectors for link
                    const linkEl = el.querySelector('a[href*="/"]') || titleEl?.closest('a');

                    // Try multiple selectors for description
                    const descEl = el.querySelector('p, [class*="description"], [class*="summary"], [class*="excerpt"]');

                    // Try multiple selectors for image
                    const imgEl = el.querySelector('img, picture img');

                    if (!titleEl || !linkEl) return null;

                    const href = linkEl.href;
                    // Filter out non-article links
                    if (!href || href.includes('#') || href.includes('javascript:') ||
                        href.includes('mailto:') || href.includes('tel:')) {
                        return null;
                    }

                    return {
                        title: titleEl.textContent?.trim(),
                        url: href,
                        description: descEl?.textContent?.trim() || '',
                        imageUrl: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                        section: sectionName
                    };
                }).filter(Boolean);
            },
            section
        );

        // Add source to each article
        const articlesWithSource = articles.map(article => ({
            ...article,
            source,
            publishedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString()
        }));

        allArticles.push(...articlesWithSource);

        console.log(`✅ Extracted ${articles.length} articles from ${source} - ${section}`);
    },
    failedRequestHandler({ request }) {
        console.error(`❌ Request failed: ${request.url}`);
    }
});

// Run crawler
console.log('🚀 Starting crawler...');
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
