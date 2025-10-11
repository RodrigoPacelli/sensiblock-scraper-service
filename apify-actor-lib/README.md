# SensiBlock News Scraper Actor

A powerful Apify Actor that scrapes news articles from major international news websites and returns data in NewsAPI-compatible format.

## 🎯 Features

- **Multi-Source Scraping**: Extracts news from CNN, BBC, Reuters, The Guardian, New York Times, and AP News
- **NewsAPI Compatible**: Returns data in the same format as NewsAPI.ai
- **Intelligent Extraction**: Uses multiple fallback strategies for robust data extraction
- **Anti-Bot Protection**: Built-in stealth mode and proxy rotation support
- **Duplicate Removal**: Automatically removes duplicate articles
- **Date Filtering**: Optional filtering by publication date
- **Rate Limiting**: Respectful crawling to avoid being blocked

## 🌐 Supported News Sources

| Website | Domain | Notes |
|---------|--------|-------|
| CNN | edition.cnn.com | International edition |
| BBC | www.bbc.com | Global news coverage |
| Reuters | www.reuters.com | Financial and world news |
| The Guardian | www.theguardian.com | UK-based international news |
| New York Times | www.nytimes.com | US and international news |
| AP News | apnews.com | Associated Press |

## 📋 Input Configuration

```json
{
  "sites": ["edition.cnn.com", "www.bbc.com", "www.reuters.com"],
  "maxArticlesPerSite": 25,
  "timeout": 30000,
  "dateFilter": "today",
  "includeImages": true,
  "removeDuplicates": true
}
```

### Input Parameters

- **sites** (array): List of websites to scrape. Default: all supported sites
- **maxArticlesPerSite** (integer): Maximum articles per site (1-100). Default: 25
- **timeout** (integer): Page load timeout in milliseconds. Default: 30000
- **dateFilter** (string): Filter by date - "today", "week", or null. Default: null
- **includeImages** (boolean): Extract image URLs. Default: true
- **removeDuplicates** (boolean): Remove duplicate articles. Default: true
- **debug** (boolean): Enable detailed logging. Default: false

## 📊 Output Format

The Actor returns data in NewsAPI-compatible format:

```json
{
  "articles": [
    {
      "title": "Breaking: Major News Event Unfolds",
      "description": "Detailed description of the news event...",
      "url": "https://edition.cnn.com/2024/01/15/news/breaking-news",
      "urlToImage": "https://cdn.cnn.com/cnnnext/dam/assets/image.jpg",
      "publishedAt": "2024-01-15T10:30:00Z",
      "source": {
        "name": "CNN"
      }
    }
  ],
  "totalResults": 127,
  "status": "ok",
  "scrapedAt": "2024-01-15T10:35:00Z",
  "sources": ["CNN", "BBC", "Reuters"]
}
```

## 🚀 Usage Examples

### Basic Usage
```javascript
// Scrape all supported sites with default settings
const input = {};
```

### Custom Configuration
```javascript
// Scrape specific sites with custom limits
const input = {
  "sites": ["edition.cnn.com", "www.bbc.com"],
  "maxArticlesPerSite": 50,
  "dateFilter": "today",
  "timeout": 45000
};
```

### API Integration
```javascript
// Call the Actor via Apify API
const response = await fetch('https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: {
      sites: ["edition.cnn.com", "www.reuters.com"],
      maxArticlesPerSite: 30
    }
  })
});
```

## 🔧 Integration with SensiBlock

This Actor is designed to replace NewsAPI.ai in the SensiBlock system:

1. **Deploy** this Actor to your Apify account
2. **Configure** your SensiBlock app to call this Actor instead of NewsAPI.ai
3. **Update** the news collection endpoint to use Apify API
4. **Maintain** the same data flow and processing logic

### Example Integration Code

```javascript
// Replace NewsAPI.ai calls with Apify Actor calls
async function collectNews() {
  const response = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${APIFY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: {
        sites: ['edition.cnn.com', 'www.bbc.com', 'www.reuters.com'],
        maxArticlesPerSite: 25,
        dateFilter: 'today'
      }
    })
  });

  const runInfo = await response.json();

  // Wait for completion and get results
  const results = await waitForCompletion(runInfo.data.id);
  return results.articles;
}
```

## ⚡ Performance

- **Speed**: ~2-3 minutes for all 6 sites (150+ articles)
- **Reliability**: Built-in retries and fallback strategies
- **Efficiency**: Concurrent processing with rate limiting
- **Cost**: ~$0.02-0.05 per run (depending on Apify plan)

## 🛠️ Technical Details

### Architecture
- **Framework**: Crawlee with Playwright
- **Browser**: Chromium with stealth mode
- **Concurrency**: 3 concurrent pages maximum
- **Fallback**: Multiple selector strategies per site
- **Error Handling**: Comprehensive error catching and logging

### Selector Strategy
Each site has:
- **Primary selectors**: Site-specific, high-precision
- **Fallback selectors**: Generic HTML elements
- **Multiple container patterns**: To handle layout changes

### Anti-Detection
- **Stealth mode**: Playwright stealth plugin
- **User agent rotation**: Realistic browser headers
- **Proxy support**: Apify proxy integration
- **Rate limiting**: Respectful crawling speed

## 🔒 Privacy & Compliance

- **No personal data**: Only extracts publicly available news
- **Respectful crawling**: Follows robots.txt when possible
- **Rate limiting**: Avoids overwhelming target servers
- **GDPR compliant**: No tracking or personal data storage

## 📞 Support

For issues or feature requests:
1. Check the logs in Apify Console
2. Verify input configuration
3. Enable debug mode for detailed logging
4. Contact support with Actor run ID

## 🔄 Updates

This Actor is regularly updated to:
- Adapt to website changes
- Add new news sources
- Improve extraction accuracy
- Enhance performance

---

**Built for SensiBlock** | Replacing NewsAPI.ai with autonomous news collection