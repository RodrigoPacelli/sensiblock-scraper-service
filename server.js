/**
 * Apify Actor Local Service
 *
 * Express server que executa o Apify Actor localmente via child process.
 * Gerencia fila de execução para evitar sobrecarga de memória.
 */

import express from 'express';
import cors from 'cors';
import { QueueManager } from './queue-manager.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Queue: apenas 1 scraper por vez
const queue = new QueueManager(1);

// Métricas
let totalRuns = 0;
let successfulRuns = 0;
let failedRuns = 0;

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();

  res.json({
    status: 'healthy',
    service: 'apify-actor-local',
    version: '1.0.0',
    uptime: process.uptime(),
    queue: queue.status(),
    metrics: {
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns * 100).toFixed(2) + '%' : '0%'
    },
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    },
    system: {
      freeMem: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      totalMem: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      platform: os.platform(),
      cpus: os.cpus().length
    }
  });
});

/**
 * Scrape endpoint
 * POST /scrape
 * Body: { sites: string[], maxArticlesPerSite: number, timeout: number }
 */
app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  const {
    sites = ['edition.cnn.com'],
    maxArticlesPerSite = 50,
    timeout = 30000,
    dateFilter = 'today',
    includeImages = true,
    removeDuplicates = true,
    debug = false
  } = req.body;

  console.log('\n' + '='.repeat(80));
  console.log(`[Server] 🚀 New scrape request received`);
  console.log(`[Server] 📰 Sites: ${sites.join(', ')}`);
  console.log(`[Server] 📊 Max articles per site: ${maxArticlesPerSite}`);
  console.log('='.repeat(80) + '\n');

  totalRuns++;

  try {
    // Adiciona à fila
    const result = await queue.add(async () => {
      return await runActorScript({
        sites,
        maxArticlesPerSite,
        timeout,
        dateFilter,
        includeImages,
        removeDuplicates,
        debug
      });
    });

    successfulRuns++;

    const duration = Date.now() - startTime;
    console.log(`\n✅ Scrape completed in ${(duration / 1000).toFixed(2)}s\n`);

    res.json({
      ...result,
      meta: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        queueStatus: queue.status()
      }
    });
  } catch (error) {
    failedRuns++;

    const duration = Date.now() - startTime;
    console.error(`\n❌ Scrape failed after ${(duration / 1000).toFixed(2)}s: ${error.message}\n`);

    res.status(500).json({
      status: 'error',
      error: error.message,
      articles: [],
      totalResults: 0,
      meta: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        queueStatus: queue.status()
      }
    });
  }
});

/**
 * Scrape batch endpoint - Scrapes multiple URLs in sequence
 * POST /scrape-batch
 * Body: { urls: string[], maxArticlesPerUrl: number }
 */
app.post('/scrape-batch', async (req, res) => {
  const startTime = Date.now();
  const {
    urls = [],
    maxArticlesPerUrl = 50,
    timeout = 30000,
    dateFilter = 'today',
    includeImages = true,
    removeDuplicates = true,
    debug = false
  } = req.body;

  if (!urls || urls.length === 0) {
    return res.status(400).json({
      status: 'error',
      error: 'URLs array is required and must not be empty',
      results: []
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`[Server] 🚀 New batch scrape request received`);
  console.log(`[Server] 📰 URLs: ${urls.length}`);
  console.log(`[Server] 📊 Max articles per URL: ${maxArticlesPerUrl}`);
  console.log('='.repeat(80) + '\n');

  totalRuns++;

  try {
    const results = [];
    let totalArticles = 0;

    // Processa cada URL sequencialmente
    for (const url of urls) {
      const urlStartTime = Date.now();

      try {
        console.log(`[Server] 📡 Processing: ${url}`);

        const result = await queue.add(async () => {
          return await runActorScript({
            sites: [url],
            maxArticlesPerSite: maxArticlesPerUrl,
            timeout,
            dateFilter,
            includeImages,
            removeDuplicates,
            debug
          });
        });

        const urlDuration = Date.now() - urlStartTime;

        results.push({
          url,
          success: true,
          articlesFound: result.totalResults || 0,
          duration: urlDuration / 1000,
          articles: result.articles || []
        });

        totalArticles += result.totalResults || 0;

        console.log(`[Server] ✅ ${url}: ${result.totalResults} articles (${(urlDuration / 1000).toFixed(2)}s)`);

      } catch (error) {
        const urlDuration = Date.now() - urlStartTime;

        results.push({
          url,
          success: false,
          articlesFound: 0,
          duration: urlDuration / 1000,
          error: error.message
        });

        console.error(`[Server] ❌ ${url}: ${error.message}`);
      }
    }

    successfulRuns++;

    const duration = Date.now() - startTime;
    console.log(`\n✅ Batch scrape completed in ${(duration / 1000).toFixed(2)}s\n`);

    res.json({
      status: 'ok',
      totalArticles,
      totalUrls: urls.length,
      successfulUrls: results.filter(r => r.success).length,
      failedUrls: results.filter(r => !r.success).length,
      results,
      meta: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        queueStatus: queue.status()
      }
    });
  } catch (error) {
    failedRuns++;

    const duration = Date.now() - startTime;
    console.error(`\n❌ Batch scrape failed after ${(duration / 1000).toFixed(2)}s: ${error.message}\n`);

    res.status(500).json({
      status: 'error',
      error: error.message,
      results: [],
      meta: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString(),
        queueStatus: queue.status()
      }
    });
  }
});

/**
 * Queue status endpoint
 */
app.get('/queue', (req, res) => {
  res.json(queue.status());
});

/**
 * Clear queue endpoint (emergência)
 */
app.post('/queue/clear', (req, res) => {
  const cleared = queue.clear();
  res.json({
    message: `Cleared ${cleared} queued jobs`,
    status: queue.status()
  });
});

/**
 * Metrics endpoint
 */
app.get('/metrics', (req, res) => {
  res.json({
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns * 100).toFixed(2) + '%' : '0%',
    uptime: process.uptime(),
    queue: queue.status()
  });
});

/**
 * Executa o script do actor como child process
 * @param {Object} input - Input para o actor
 * @returns {Promise<Object>} - Resultado do scraping
 */
async function runActorScript(input) {
  return new Promise((resolve, reject) => {
    const actorPath = path.join(__dirname, 'apify-actor-lib/main-local.js');

    console.log(`[runActor] 🎬 Starting actor execution`);
    console.log(`[runActor] 📂 Actor path: ${actorPath}`);
    console.log(`[runActor] 📥 Input:`, input);

    // Environment variables para o actor
    const env = {
      ...process.env,
      APIFY_INPUT: JSON.stringify(input),
      NODE_OPTIONS: '--max-old-space-size=1024', // Limite de 1GB
      NODE_ENV: 'production' // Desabilita logs verbosos
    };

    // Spawn child process
    const child = spawn('node', [actorPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
      detached: false,
      timeout: 300000 // 5 minutos timeout
    });

    let stdout = '';
    let stderr = '';
    let outputCaptured = false;

    // Captura stdout
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Log seletivo (não loggar tudo)
      if (output.includes('🚀') || output.includes('✅') || output.includes('❌') || output.includes('📊')) {
        console.log(`[Actor] ${output.trim()}`);
      }
    });

    // Captura stderr
    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`[Actor Error] ${error.trim()}`);
    });

    // Quando o processo termina
    child.on('close', (code) => {
      console.log(`[runActor] 🏁 Actor process exited with code ${code}`);

      if (code !== 0) {
        console.error(`[runActor] ❌ Actor failed`);
        console.error(`[runActor] stderr:`, stderr);
        reject(new Error(`Actor process failed with code ${code}`));
        return;
      }

      // Parse output do actor
      try {
        // Remove códigos ANSI (cores) do stdout
        const cleanStdout = stdout.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

        // Procura por marcadores especiais
        const startMarker = '__APIFY_OUTPUT_START__';
        const endMarker = '__APIFY_OUTPUT_END__';

        let outputJson = null;

        if (cleanStdout.includes(startMarker) && cleanStdout.includes(endMarker)) {
          const startIdx = cleanStdout.indexOf(startMarker) + startMarker.length;
          const endIdx = cleanStdout.indexOf(endMarker);
          const jsonStr = cleanStdout.substring(startIdx, endIdx).trim();
          outputJson = JSON.parse(jsonStr);
        } else {
          // Fallback: tenta parsear último JSON válido no stdout
          const lines = cleanStdout.split('\n').filter(l => l.trim().startsWith('{'));
          if (lines.length > 0) {
            outputJson = JSON.parse(lines[lines.length - 1]);
          }
        }

        if (!outputJson) {
          throw new Error('No valid JSON output found');
        }

        console.log(`[runActor] ✅ Successfully parsed output`);
        console.log(`[runActor] 📊 Results: ${outputJson.totalResults} articles from ${outputJson.sources?.length || 0} sources`);

        resolve(outputJson);
      } catch (error) {
        console.error(`[runActor] ❌ Failed to parse actor output:`, error.message);
        console.error(`[runActor] stdout (last 500 chars):`, stdout.slice(-500));
        reject(new Error(`Failed to parse actor output: ${error.message}`));
      }
    });

    // Error no spawn
    child.on('error', (error) => {
      console.error(`[runActor] ❌ Failed to spawn actor process:`, error);
      reject(error);
    });

    // Timeout manual (backup)
    const timeoutId = setTimeout(() => {
      console.error(`[runActor] ⏰ Actor timeout (5min) - killing process`);
      child.kill('SIGKILL');
      reject(new Error('Actor execution timeout (5 minutes)'));
    }, 300000);

    // Limpa timeout se terminar antes
    child.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 Apify Actor Local Service`);
  console.log('='.repeat(80));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`📋 Queue status: http://localhost:${PORT}/queue`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`   - Max concurrent scrapers: 1`);
  console.log(`   - Memory limit per job: 1GB`);
  console.log(`   - Timeout per job: 5 minutes`);
  console.log(`   - Actor path: ./apify-actor-lib/main-local.js`);
  console.log('\n' + '='.repeat(80) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
