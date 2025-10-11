import { Actor } from 'apify';

// Mock Apify environment for local testing
class MockActor {
    static async init() {
        console.log('🚀 Mock Actor initialized');
    }

    static async getInput() {
        // Return test input
        return {
            sites: ['edition.cnn.com', 'www.bbc.com'],
            maxArticlesPerSite: 5,
            timeout: 30000,
            dateFilter: null,
            debug: true
        };
    }

    static async pushData(data) {
        console.log('\n📊 FINAL RESULTS:');
        console.log(`Total articles: ${data.totalResults}`);
        console.log(`Sources: ${data.sources.join(', ')}`);
        console.log('\nSample articles:');

        data.articles.slice(0, 3).forEach((article, i) => {
            console.log(`\n${i + 1}. ${article.title}`);
            console.log(`   Source: ${article.source.name}`);
            console.log(`   URL: ${article.url}`);
            console.log(`   Description: ${article.description?.substring(0, 100)}...`);
        });

        // Save to file for inspection
        const fs = await import('fs');
        fs.writeFileSync('./test-output.json', JSON.stringify(data, null, 2));
        console.log('\n💾 Full results saved to test-output.json');
    }

    static async exit() {
        console.log('✅ Mock Actor finished');
        process.exit(0);
    }
}

// Replace Actor with mock for local testing
global.Actor = MockActor;

// Import and run the main script
console.log('🧪 Starting local test of News Scraper Actor...\n');

try {
    await import('./main.js');
} catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
}