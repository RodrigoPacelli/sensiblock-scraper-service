/**
 * Mock Apify Actor SDK
 *
 * Simula o comportamento do Apify SDK para execução local do actor.
 * Permite rodar o código original do actor sem modificações.
 */

export class MockActor {
  static input = null;
  static output = null;
  static dataStore = [];

  /**
   * Inicializa o actor (mock)
   */
  static async init() {
    console.log('🚀 [MockActor] Actor initialized (local mode)');
  }

  /**
   * Obtém input do actor
   * Lê de environment variable APIFY_INPUT
   */
  static async getInput() {
    if (!this.input && process.env.APIFY_INPUT) {
      try {
        this.input = JSON.parse(process.env.APIFY_INPUT);
        console.log('[MockActor] 📥 Input loaded:', {
          sites: this.input.sites?.length || 0,
          maxArticlesPerSite: this.input.maxArticlesPerSite
        });
      } catch (error) {
        console.error('[MockActor] ❌ Failed to parse APIFY_INPUT:', error.message);
        this.input = {};
      }
    }

    return this.input || {};
  }

  /**
   * Salva dados no dataset (mock)
   * No modo local, armazena em memória e imprime no stdout
   */
  static async pushData(data) {
    this.output = data;
    this.dataStore.push(data);

    console.log('[MockActor] 💾 Data pushed to dataset');
    console.log('[MockActor] 📊 Stats:', {
      totalResults: data.totalResults,
      articlesCount: data.articles?.length || 0,
      sources: data.sources?.join(', ')
    });

    // Output JSON para stdout (será capturado pelo parent process)
    // Usa marcador especial para facilitar parsing
    process.stdout.write('__APIFY_OUTPUT_START__\n');
    process.stdout.write(JSON.stringify(data) + '\n');
    process.stdout.write('__APIFY_OUTPUT_END__\n');

    // Force flush
    await new Promise(resolve => process.stdout.write('', resolve));
  }

  /**
   * Finaliza o actor
   */
  static async exit(code = 0) {
    console.log(`[MockActor] 👋 Actor exiting with code ${code}`);

    if (code === 0) {
      console.log('[MockActor] ✅ Execution successful');
    } else {
      console.error('[MockActor] ❌ Execution failed');
    }

    process.exit(code);
  }

  /**
   * Retorna dados armazenados (para testes)
   */
  static getData() {
    return this.dataStore;
  }

  /**
   * Limpa dados armazenados
   */
  static clearData() {
    this.dataStore = [];
    this.output = null;
    this.input = null;
  }
}

// Export default para compatibilidade
export default MockActor;
