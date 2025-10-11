/**
 * Queue Manager
 *
 * Gerencia fila de execução de scrapers para evitar sobrecarga de memória.
 * Permite apenas N execuções simultâneas.
 */
export class QueueManager {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.activeJobs = 0;
  }

  /**
   * Adiciona um job à fila
   * @param {Function} fn - Função assíncrona a ser executada
   * @returns {Promise} - Resultado da execução
   */
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  /**
   * Processa próximo job da fila
   */
  async process() {
    // Se já atingiu o limite ou fila vazia, não processa
    if (this.activeJobs >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.activeJobs++;
    const { fn, resolve, reject } = this.queue.shift();

    console.log(`[QueueManager] 🚀 Starting job (active: ${this.activeJobs}, queued: ${this.queue.length})`);

    try {
      const result = await fn();
      resolve(result);
      console.log(`[QueueManager] ✅ Job completed`);
    } catch (error) {
      reject(error);
      console.error(`[QueueManager] ❌ Job failed:`, error.message);
    } finally {
      this.activeJobs--;
      console.log(`[QueueManager] 📊 Jobs active: ${this.activeJobs}, queued: ${this.queue.length}`);

      // Processar próximo job
      this.process();
    }
  }

  /**
   * Retorna tamanho da fila
   */
  size() {
    return this.queue.length;
  }

  /**
   * Retorna número de jobs ativos
   */
  active() {
    return this.activeJobs;
  }

  /**
   * Limpa a fila (não cancela jobs ativos)
   */
  clear() {
    const cleared = this.queue.length;
    this.queue = [];
    console.log(`[QueueManager] 🧹 Cleared ${cleared} queued jobs`);
    return cleared;
  }

  /**
   * Retorna status da fila
   */
  status() {
    return {
      active: this.activeJobs,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}
