/**
 * Queue Manager Tests
 *
 * Testa o gerenciamento de fila de execução de scrapers:
 * - Limite de concorrência
 * - Processamento sequencial
 * - Tratamento de erros
 * - Status e métricas
 *
 * @jest-environment node
 */

import { jest, describe, test, beforeEach, afterEach, expect } from '@jest/globals';
import { QueueManager } from '../queue-manager.js';

describe('QueueManager', () => {
  let queue;

  beforeEach(() => {
    // Silenciar console logs durante testes
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create queue with default max concurrent = 1', () => {
      queue = new QueueManager();
      expect(queue.maxConcurrent).toBe(1);
      expect(queue.activeJobs).toBe(0);
      expect(queue.queue).toEqual([]);
    });

    test('should create queue with custom max concurrent', () => {
      queue = new QueueManager(5);
      expect(queue.maxConcurrent).toBe(5);
      expect(queue.activeJobs).toBe(0);
    });
  });

  describe('Job Addition and Processing', () => {
    beforeEach(() => {
      queue = new QueueManager(1);
    });

    test('should add and execute a single job', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const result = await queue.add(mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(queue.activeJobs).toBe(0);
      expect(queue.queue.length).toBe(0);
    });

    test('should execute jobs sequentially when maxConcurrent = 1', async () => {
      const executionOrder = [];

      const job1 = jest.fn(async () => {
        executionOrder.push('job1-start');
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('job1-end');
        return 'result1';
      });

      const job2 = jest.fn(async () => {
        executionOrder.push('job2-start');
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push('job2-end');
        return 'result2';
      });

      const promise1 = queue.add(job1);
      const promise2 = queue.add(job2);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(executionOrder).toEqual([
        'job1-start',
        'job1-end',
        'job2-start',
        'job2-end'
      ]);
    });

    test('should execute jobs concurrently when maxConcurrent > 1', async () => {
      queue = new QueueManager(2);
      const executionOrder = [];

      const job1 = jest.fn(async () => {
        executionOrder.push('job1-start');
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('job1-end');
        return 'result1';
      });

      const job2 = jest.fn(async () => {
        executionOrder.push('job2-start');
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push('job2-end');
        return 'result2';
      });

      const promise1 = queue.add(job1);
      const promise2 = queue.add(job2);

      await Promise.all([promise1, promise2]);

      // Jobs devem iniciar em paralelo
      expect(executionOrder.indexOf('job1-start')).toBeLessThan(executionOrder.indexOf('job1-end'));
      expect(executionOrder.indexOf('job2-start')).toBeLessThan(executionOrder.indexOf('job2-end'));
      expect(executionOrder.indexOf('job2-start')).toBeLessThan(executionOrder.indexOf('job1-end'));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      queue = new QueueManager(1);
    });

    test('should reject promise when job fails', async () => {
      const mockError = new Error('Job failed');
      const failingJob = jest.fn().mockRejectedValue(mockError);

      await expect(queue.add(failingJob)).rejects.toThrow('Job failed');
      expect(failingJob).toHaveBeenCalledTimes(1);
      expect(queue.activeJobs).toBe(0);
    });

    test('should continue processing queue after failed job', async () => {
      const failingJob = jest.fn().mockRejectedValue(new Error('Failed'));
      const successJob = jest.fn().mockResolvedValue('success');

      const promise1 = queue.add(failingJob);
      const promise2 = queue.add(successJob);

      await expect(promise1).rejects.toThrow('Failed');
      const result2 = await promise2;

      expect(result2).toBe('success');
      expect(successJob).toHaveBeenCalledTimes(1);
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      queue = new QueueManager(1);
    });

    test('should return correct queue size', () => {
      expect(queue.size()).toBe(0);

      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      queue.add(async () => {});
      queue.add(async () => {});

      // Primeiro job deve estar em execução, outros 2 na fila
      expect(queue.size()).toBe(2);
    });

    test('should return correct active jobs count', async () => {
      expect(queue.active()).toBe(0);

      const job = queue.add(async () => {
        expect(queue.active()).toBe(1);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await job;
      expect(queue.active()).toBe(0);
    });

    test('should clear queued jobs', () => {
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      queue.add(async () => {});
      queue.add(async () => {});

      const cleared = queue.clear();

      expect(cleared).toBe(2);
      expect(queue.size()).toBe(0);
      // Job ativo ainda deve estar rodando
      expect(queue.active()).toBe(1);
    });

    test('should return correct status', () => {
      const status = queue.status();

      expect(status).toEqual({
        active: 0,
        queued: 0,
        maxConcurrent: 1
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty queue gracefully', () => {
      queue = new QueueManager(1);
      queue.process(); // Não deve causar erro
      expect(queue.activeJobs).toBe(0);
    });

    test('should handle multiple concurrent limits', async () => {
      queue = new QueueManager(3);
      const jobs = [];

      for (let i = 0; i < 10; i++) {
        jobs.push(queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return i;
        }));
      }

      const results = await Promise.all(jobs);

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(queue.activeJobs).toBe(0);
      expect(queue.size()).toBe(0);
    });

    test('should handle job that returns undefined', async () => {
      queue = new QueueManager(1);
      const result = await queue.add(async () => {});
      expect(result).toBeUndefined();
    });

    test('should handle job that returns null', async () => {
      queue = new QueueManager(1);
      const result = await queue.add(async () => null);
      expect(result).toBeNull();
    });

    test('should handle job that throws synchronously', async () => {
      queue = new QueueManager(1);
      const syncThrowingJob = () => {
        throw new Error('Sync error');
      };

      await expect(queue.add(syncThrowingJob)).rejects.toThrow('Sync error');
      expect(queue.activeJobs).toBe(0);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high volume of jobs', async () => {
      queue = new QueueManager(5);
      const jobCount = 100;
      const jobs = [];

      for (let i = 0; i < jobCount; i++) {
        jobs.push(queue.add(async () => i));
      }

      const results = await Promise.all(jobs);

      expect(results.length).toBe(jobCount);
      expect(queue.activeJobs).toBe(0);
      expect(queue.size()).toBe(0);
    });

    test('should maintain order in queue', async () => {
      queue = new QueueManager(1);
      const executionOrder = [];

      const jobs = Array.from({ length: 5 }, (_, i) =>
        queue.add(async () => {
          executionOrder.push(i);
          return i;
        })
      );

      await Promise.all(jobs);
      expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
