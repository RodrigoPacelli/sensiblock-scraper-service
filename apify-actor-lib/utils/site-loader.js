import fs from 'fs';
import path from 'path';

const DEFAULT_SELECTORS_PATH = process.env.NEWS_SITE_SELECTORS_PATH || path.resolve(process.cwd(), 'config', 'news-site-selectors.json');

const FALLBACK_SELECTORS = {
  articleContainer: ['article', '.card', '[data-testid*="article"]', '[class*="story"]', '[class*="article"]', '[data-qa*="article"]'],
  title: ['h1', 'h2', 'h3', '[class*="headline"]', '[class*="title"]', 'a[href*="/"], span[role="heading"]'],
  link: ['a[href^="http"]', 'a[href^="/"]'],
  description: ['p', '[class*="summary"]', '[class*="description"]'],
  image: ['img', 'picture img']
};

let cachedSelectorsMap = null;

function loadSelectorsFile() {
  if (!fs.existsSync(DEFAULT_SELECTORS_PATH)) {
    console.warn(`[Selectors] File not found at ${DEFAULT_SELECTORS_PATH}. Falling back to generic selectors.`);
    return {};
  }

  try {
    const raw = fs.readFileSync(DEFAULT_SELECTORS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.selectors || {};
  } catch (error) {
    console.error('[Selectors] Failed to parse selectors file:', error);
    return {};
  }
}

function buildSelectorsMap() {
  if (cachedSelectorsMap) {
    return cachedSelectorsMap;
  }

  const selectors = loadSelectorsFile();
  const map = new Map();

  for (const [domain, entry] of Object.entries(selectors)) {
    if (!entry || entry.status === 'FAILED') {
      continue;
    }

    const selectorConfig = entry.selectors || {};
    const canonical = domain.toLowerCase();

    map.set(canonical, selectorConfig);

    const withoutWww = canonical.replace(/^www\./, '');
    map.set(withoutWww, selectorConfig);

    if (!canonical.startsWith('www.')) {
      map.set(`www.${canonical}`, selectorConfig);
    }
  }

  cachedSelectorsMap = map;
  return map;
}

function normalizeUrl(input) {
  const trimmed = input.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed);
    } catch (error) {
      throw new Error(`Invalid URL: ${trimmed}`);
    }
  }

  if (trimmed.includes('/')) {
    try {
      return new URL(`https://${trimmed}`);
    } catch (error) {
      throw new Error(`Invalid domain/path: ${trimmed}`);
    }
  }

  return new URL(`https://${trimmed}`);
}

function computeSourceName(hostname) {
  const domain = hostname.replace(/^(www\.|edition\.|m\.|mobile\.|news\.|en\.)/i, '');
  const base = domain.split('.')[0].toUpperCase();

  switch (base) {
    case 'THEGUARDIAN':
      return 'THE GUARDIAN';
    case 'NYTIMES':
      return 'NY TIMES';
    case 'WASHINGTONPOST':
      return 'WASHINGTON POST';
    case 'APNEWS':
      return 'AP NEWS';
    default:
      return base;
  }
}

function splitSelectors(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  if (Array.isArray(value)) {
    const arr = value.map((item) => String(item).trim()).filter(Boolean);
    return arr.length > 0 ? arr : [...fallback];
  }

  const parts = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [...fallback];
}

export function buildStartRequests(sites) {
  const selectorsMap = buildSelectorsMap();
  const startRequests = [];
  const warnings = [];

  for (const siteInput of sites) {
    if (!siteInput || typeof siteInput !== 'string') {
      warnings.push(`Invalid site input: ${siteInput}`);
      continue;
    }

    let parsedUrl;
    try {
      parsedUrl = normalizeUrl(siteInput);
    } catch (error) {
      warnings.push(error.message);
      continue;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const selectorConfig = selectorsMap.get(hostname);

    if (!selectorConfig) {
      warnings.push(`Selectors not found for domain: ${hostname}`);
    }

    const source = computeSourceName(hostname);

    startRequests.push({
      url: parsedUrl.href,
      userData: {
        site: hostname,
        source,
        section: parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : hostname,
        baseUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
        selectors: selectorConfig ? {
          container: splitSelectors(selectorConfig.articleContainer, FALLBACK_SELECTORS.articleContainer),
          title: splitSelectors(selectorConfig.title, FALLBACK_SELECTORS.title),
          link: splitSelectors(selectorConfig.link, FALLBACK_SELECTORS.link),
          description: splitSelectors(selectorConfig.description, FALLBACK_SELECTORS.description),
          image: splitSelectors(selectorConfig.image, FALLBACK_SELECTORS.image)
        } : {
          container: [...FALLBACK_SELECTORS.articleContainer],
          title: [...FALLBACK_SELECTORS.title],
          link: [...FALLBACK_SELECTORS.link],
          description: [...FALLBACK_SELECTORS.description],
          image: [...FALLBACK_SELECTORS.image]
        },
        hasCustomSelectors: !!selectorConfig
      }
    });
  }

  return {
    startRequests,
    warnings
  };
}

export async function extractArticlesWithSelectors(page, request, logger = console) {
  const { selectors, source, section, baseUrl } = request.userData || {};

  if (!selectors) {
    logger.warn?.(`[UniversalScraper] No selectors provided for ${request.url}. Skipping.`);
    return [];
  }

  try {
    const articles = await page.evaluate(({ selectors, baseUrl, section, source }) => {
      const toAbsoluteUrl = (href) => {
        if (!href) return '';
        if (href.startsWith('http://') || href.startsWith('https://')) return href;
        if (href.startsWith('//')) return `${window.location.protocol}${href}`;
        try {
          return new URL(href, baseUrl).href;
        } catch {
          return '';
        }
      };

      const uniqueElements = (elements) => {
        const seen = new Set();
        const result = [];
        for (const el of elements) {
          if (!seen.has(el)) {
            seen.add(el);
            result.push(el);
          }
        }
        return result;
      };

      const queryAll = (selectorsList) => {
        const nodes = [];
        selectorsList.forEach((selector) => {
          try {
            document.querySelectorAll(selector).forEach((el) => nodes.push(el));
          } catch {
            // ignore invalid selector
          }
        });
        return uniqueElements(nodes);
      };

      const findFirst = (root, selectorsList) => {
        for (const selector of selectorsList) {
          try {
            const el = root.querySelector(selector);
            if (el) return el;
          } catch {
            // ignore invalid selector
          }
        }
        return null;
      };

      const containers = queryAll(selectors.container);

      return containers
        .map((container) => {
          const linkEl = findFirst(container, selectors.link) || container.closest('a');
          const titleEl = findFirst(container, selectors.title) || linkEl;
          const descEl = findFirst(container, selectors.description);
          const imgEl = findFirst(container, selectors.image);

          if (!titleEl || !linkEl) {
            return null;
          }

          const href = toAbsoluteUrl(linkEl.getAttribute('href') || linkEl.getAttribute('data-href') || '');

          if (!href || href.includes('mailto:') || href.includes('javascript:') || href.startsWith('#')) {
            return null;
          }

          const cleanText = (value) => value ? value.replace(/\s+/g, ' ').trim() : '';

          const rawTitle = titleEl.textContent || titleEl.getAttribute('aria-label') || linkEl.getAttribute('title') || '';
          const title = cleanText(rawTitle);
          if (!title) {
            return null;
          }

          const description = cleanText(descEl?.textContent || '');
          const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || '';

          return {
            title,
            url: href,
            description,
            urlToImage: toAbsoluteUrl(imageUrl),
            section,
            source,
            scrapedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString()
          };
        })
        .filter(Boolean);
    }, { selectors, baseUrl, section, source });

    return articles;
  } catch (error) {
    logger.error?.(`[UniversalScraper] Error extracting articles for ${request.url}:`, error);
    return [];
  }
}

export const fallbackSelectors = FALLBACK_SELECTORS;
