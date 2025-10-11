/**
 * Local Execution Wrapper for Apify Actor
 *
 * Este wrapper injeta o MockActor no global antes de importar main.js,
 * permitindo rodar o código original sem modificações.
 *
 * Uso:
 *   APIFY_INPUT='{"sites":["edition.cnn.com"],"maxArticlesPerSite":50}' node main-local-wrapper.js
 */

import { MockActor } from '../apify-actor-local-service/mock-apify-actor.js';

// Inject mock into global scope
global.Actor = MockActor;

console.log('[Wrapper] 🔧 MockActor injected into global scope');
console.log('[Wrapper] 📥 Input from ENV:', process.env.APIFY_INPUT ? 'Present' : 'Missing');

// Import and execute the original main.js
console.log('[Wrapper] 🚀 Loading main.js...\n');

// Dynamic import to ensure mock is in place
await import('./main.js');
