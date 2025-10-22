#!/usr/bin/env node
/**
 * Batch Scheduler Daemon - VPS Version
 * 
 * Conecta no Firestore, busca batches habilitados e dispara
 * scraping direto no scraper local (localhost:3005)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3005';
const CHECK_INTERVAL = 60000; // 1 minuto
const BATCH_SIZE = 10; // Executar 10 batches em paralelo por vez

let isRunning = false;

// Initialize Firebase Admin
const envContent = readFileSync('/var/www/sensiblock-scraper-service/.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(envVars.SERVICE_ACCOUNT_JSON);
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function fetchEnabledBatches() {
  try {
    const snapshot = await db.collection('batchScheduler')
      .where('enabled', '==', true)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Error fetching batches:', error.message);
    return [];
  }
}

function shouldRunBatch(batch) {
  if (!batch.lastRun) return true;

  const lastRunTime = new Date(batch.lastRun).getTime();
  const now = Date.now();
  const intervalMs = (batch.interval || 5) * 60 * 1000; // Convert minutes to ms

  return (now - lastRunTime) >= intervalMs;
}

async function triggerBatch(batchId, batchName, batch) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${SCRAPER_URL}/scrape-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: batch.urls || [],
        maxArticles: batch.maxArticlesPerUrl || 50,
        interval: 0 // No interval between URLs (handled by queue)
      })
    });

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Update batch stats
    await db.collection('batchScheduler').doc(batchId).update({
      lastRun: new Date().toISOString(),
      'stats.totalRuns': (batch.stats?.totalRuns || 0) + 1,
      'stats.successfulRuns': (batch.stats?.successfulRuns || 0) + (result.success ? 1 : 0),
      'stats.failedRuns': (batch.stats?.failedRuns || 0) + (result.success ? 0 : 1),
      'stats.lastResult': {
        success: result.success !== undefined ? result.success : false,
        articlesSaved: result.totalArticles || 0,
        duration: parseFloat(duration),
        timestamp: new Date().toISOString()
      }
    });

    console.log(`   ✅ Success: ${result.totalArticles || 0} articles saved in ${duration}s`);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    
    // Update failed stats
    await db.collection('batchScheduler').doc(batchId).update({
      lastRun: new Date().toISOString(),
      'stats.totalRuns': (batch.stats?.totalRuns || 0) + 1,
      'stats.failedRuns': (batch.stats?.failedRuns || 0) + 1
    });
  }
}

async function processBatchesInChunks(batches, chunkSize) {
  for (let i = 0; i < batches.length; i += chunkSize) {
    const chunk = batches.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;
    const totalChunks = Math.ceil(batches.length / chunkSize);

    console.log(`\n📦 Chunk ${chunkNumber}/${totalChunks}: Processing ${chunk.length} batches in parallel...`);
    const startTime = Date.now();

    const promises = chunk.map(batch =>
      triggerBatch(batch.id, batch.name, batch)
    );
    await Promise.all(promises);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Chunk ${chunkNumber} completed in ${duration}s`);
  }
}

async function checkAndRunBatches() {
  if (isRunning) {
    console.log('⏸️  Scheduler already running, skipping...');
    return;
  }
  isRunning = true;

  try {
    const batches = await fetchEnabledBatches();
    console.log(`\n🔍 [${new Date().toLocaleString()}] Checking ${batches.length} enabled batches...`);

    const batchesToRun = batches.filter(shouldRunBatch);
    const fastBatches = batchesToRun.filter(b =>
      b.name.toLowerCase().includes('fast') ||
      b.name.toLowerCase().includes('breaking')
    );
    const slowBatches = batchesToRun.filter(b =>
      !b.name.toLowerCase().includes('fast') &&
      !b.name.toLowerCase().includes('breaking')
    );

    const skippedBatches = batches.filter(b => !shouldRunBatch(b));

    console.log(`📊 Fast: ${fastBatches.length}, Slow: ${slowBatches.length}, Skipped: ${skippedBatches.length}`);

    if (fastBatches.length > 0) {
      console.log(`\n⚡ Processing ${fastBatches.length} Fast/Breaking News batches (${BATCH_SIZE} at a time)...`);
      await processBatchesInChunks(fastBatches, BATCH_SIZE);
    }

    if (slowBatches.length > 0) {
      console.log(`\n🐢 Processing ${slowBatches.length} Slow/Features batches (${BATCH_SIZE} at a time)...`);
      await processBatchesInChunks(slowBatches, BATCH_SIZE);
    }

  } finally {
    isRunning = false;
  }
}

console.log(`🎯 Batch Scheduler Daemon (VPS) starting...`);
console.log(`   Scraper: ${SCRAPER_URL}`);
console.log(`   Check interval: ${CHECK_INTERVAL / 1000}s\n`);

// Run immediately on start
checkAndRunBatches();

// Then run every CHECK_INTERVAL
setInterval(checkAndRunBatches, CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
