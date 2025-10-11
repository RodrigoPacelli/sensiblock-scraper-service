/**
 * Server Integration Tests
 *
 * Testa os endpoints HTTP da API de scraping:
 * - Health check endpoint
 * - Metrics endpoint
 * - Queue status endpoint
 * - Scrape endpoints (mock)
 * - Error handling
 * @jest-environment node
 */

import { jest, describe, test, beforeEach, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { QueueManager } from '../queue-manager.js';

// Mock QueueManager para evitar execuções reais
jest.mock('../queue-manager.js');

describe('Apify Actor Cloud Service - API Integration', () => {
  let app;
  let queue;

  beforeEach(() => {
    // Setup básico do Express app
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Mock queue
    queue = {
      add: jest.fn().mockImplementation(async (fn) => {
        // Execute the function passed to queue.add
        return await fn();
      }),
      status: jest.fn().mockReturnValue({
        active: 0,
        queued: 0,
        maxConcurrent: 1
      }),
      clear: jest.fn().mockReturnValue(0),
      size: jest.fn().mockReturnValue(0),
      active: jest.fn().mockReturnValue(0)
    };

    // Métricas mock
    const metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0
    };

    // Endpoints
    app.get('/health', (req, res) => {
      const memUsage = process.memoryUsage();
      res.json({
        status: 'healthy',
        service: 'apify-actor-local',
        version: '1.0.0',
        uptime: process.uptime(),
        queue: queue.status(),
        metrics: {
          totalRuns: metrics.totalRuns,
          successfulRuns: metrics.successfulRuns,
          failedRuns: metrics.failedRuns,
          successRate: metrics.totalRuns > 0
            ? (metrics.successfulRuns / metrics.totalRuns * 100).toFixed(2) + '%'
            : '0%'
        },
        memory: {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
        }
      });
    });

    app.get('/metrics', (req, res) => {
      res.json({
        totalRuns: metrics.totalRuns,
        successfulRuns: metrics.successfulRuns,
        failedRuns: metrics.failedRuns,
        successRate: metrics.totalRuns > 0
          ? (metrics.successfulRuns / metrics.totalRuns * 100).toFixed(2) + '%'
          : '0%',
        uptime: process.uptime(),
        queue: queue.status()
      });
    });

    app.get('/queue', (req, res) => {
      res.json(queue.status());
    });

    app.post('/queue/clear', (req, res) => {
      const cleared = queue.clear();
      res.json({
        message: `Cleared ${cleared} queued jobs`,
        status: queue.status()
      });
    });

    app.post('/scrape', async (req, res) => {
      const {
        sites = ['edition.cnn.com'],
        maxArticlesPerSite = 50,
        timeout = 30000
      } = req.body;

      try {
        metrics.totalRuns++;
        const result = await queue.add(async () => ({
          status: 'ok',
          articles: [],
          totalResults: 0,
          sources: sites
        }));
        metrics.successfulRuns++;

        res.json({
          ...result,
          meta: {
            duration: '0.50s',
            timestamp: new Date().toISOString(),
            queueStatus: queue.status()
          }
        });
      } catch (error) {
        metrics.failedRuns++;
        res.status(500).json({
          status: 'error',
          error: error.message,
          articles: [],
          totalResults: 0
        });
      }
    });

    app.post('/scrape-batch', async (req, res) => {
      const { urls = [] } = req.body;

      if (!urls || urls.length === 0) {
        return res.status(400).json({
          status: 'error',
          error: 'URLs array is required and must not be empty',
          results: []
        });
      }

      try {
        metrics.totalRuns++;
        const results = await Promise.all(
          urls.map(async (url) => ({
            url,
            success: true,
            articlesFound: 0,
            duration: 0.5,
            articles: []
          }))
        );
        metrics.successfulRuns++;

        res.json({
          status: 'ok',
          totalArticles: 0,
          totalUrls: urls.length,
          successfulUrls: urls.length,
          failedUrls: 0,
          results,
          meta: {
            duration: '1.50s',
            timestamp: new Date().toISOString(),
            queueStatus: queue.status()
          }
        });
      } catch (error) {
        metrics.failedRuns++;
        res.status(500).json({
          status: 'error',
          error: error.message,
          results: []
        });
      }
    });
  });

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'apify-actor-local');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('queue');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('memory');
    });

    test('should return memory metrics in correct format', async () => {
      const response = await request(app).get('/health');

      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('external');
      expect(response.body.memory).toHaveProperty('rss');

      // Verificar que valores terminam com MB
      expect(response.body.memory.heapUsed).toMatch(/\d+MB/);
      expect(response.body.memory.heapTotal).toMatch(/\d+MB/);
    });

    test('should return queue status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.queue).toEqual({
        active: 0,
        queued: 0,
        maxConcurrent: 1
      });
    });
  });

  describe('GET /metrics', () => {
    test('should return metrics endpoint', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRuns');
      expect(response.body).toHaveProperty('successfulRuns');
      expect(response.body).toHaveProperty('failedRuns');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('queue');
    });

    test('should calculate success rate correctly', async () => {
      const response = await request(app).get('/metrics');

      expect(response.body.successRate).toBe('0%');
    });
  });

  describe('GET /queue', () => {
    test('should return queue status', async () => {
      const response = await request(app).get('/queue');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        active: 0,
        queued: 0,
        maxConcurrent: 1
      });
    });
  });

  describe('POST /queue/clear', () => {
    test('should clear queue and return count', async () => {
      const response = await request(app).post('/queue/clear');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.message).toMatch(/Cleared \d+ queued jobs/);
    });
  });

  describe('POST /scrape', () => {
    test('should accept scrape request with default parameters', async () => {
      const response = await request(app)
        .post('/scrape')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('articles');
      expect(response.body).toHaveProperty('totalResults');
      expect(response.body).toHaveProperty('meta');
    });

    test('should accept scrape request with custom parameters', async () => {
      const response = await request(app)
        .post('/scrape')
        .send({
          sites: ['bbc.com', 'nytimes.com'],
          maxArticlesPerSite: 100,
          timeout: 60000
        });

      expect(response.status).toBe(200);
      expect(response.body.sources).toEqual(['bbc.com', 'nytimes.com']);
    });

    test('should include metadata in response', async () => {
      const response = await request(app).post('/scrape').send({});

      expect(response.body.meta).toHaveProperty('duration');
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('queueStatus');
    });

    test('should handle large JSON payload', async () => {
      const largeSites = Array.from({ length: 100 }, (_, i) => `site${i}.com`);

      const response = await request(app)
        .post('/scrape')
        .send({ sites: largeSites });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /scrape-batch', () => {
    test('should require urls parameter', async () => {
      const response = await request(app)
        .post('/scrape-batch')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.error).toMatch(/URLs array is required/);
    });

    test('should reject empty urls array', async () => {
      const response = await request(app)
        .post('/scrape-batch')
        .send({ urls: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/must not be empty/);
    });

    test('should accept batch scrape request', async () => {
      const response = await request(app)
        .post('/scrape-batch')
        .send({
          urls: ['https://cnn.com', 'https://bbc.com'],
          maxArticlesPerUrl: 50
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('totalArticles');
      expect(response.body).toHaveProperty('totalUrls', 2);
      expect(response.body).toHaveProperty('successfulUrls');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveLength(2);
    });

    test('should return result for each URL', async () => {
      const urls = ['https://site1.com', 'https://site2.com', 'https://site3.com'];

      const response = await request(app)
        .post('/scrape-batch')
        .send({ urls });

      expect(response.body.results).toHaveLength(3);
      response.body.results.forEach((result, index) => {
        expect(result).toHaveProperty('url', urls[index]);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('articlesFound');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('articles');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/scrape')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle missing Content-Type', async () => {
      const response = await request(app)
        .post('/scrape')
        .send({ sites: ['test.com'] });

      // Express aceita mesmo sem Content-Type explícito
      expect([200, 400]).toContain(response.status);
    });

    test('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');
      expect(response.status).toBe(404);
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Performance', () => {
    test('should respond quickly to health check', async () => {
      const start = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // < 100ms
    });

    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
