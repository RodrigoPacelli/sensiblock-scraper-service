/**
 * Firestore Client
 * Salva artigos classificados no Firestore
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

let db = null;

/**
 * Inicializa Firebase Admin SDK
 */
function initializeFirestore() {
  if (db) return db;

  try {
    // Verifica se já foi inicializado
    const apps = getApps();
    if (apps.length === 0) {
      // Lê SERVICE_ACCOUNT_JSON do ambiente ou arquivo
      const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
      
      if (!serviceAccountJson) {
        throw new Error('SERVICE_ACCOUNT_JSON not found in environment');
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      initializeApp({
        credential: cert(serviceAccount)
      });

      console.log('[Firestore] ✅ Firebase Admin SDK initialized');
    }

    db = getFirestore();
    return db;
  } catch (error) {
    console.error('[Firestore] ❌ Failed to initialize:', error.message);
    throw error;
  }
}

/**
 * Converte URL para ID seguro do Firestore
 */
function urlToDocId(url) {
  if (!url || typeof url !== 'string') {
    return null; // Retorna null se URL inválida
  }
  return url.replace(/[/\#?:]/g, '_').replace(/^https?_+/, '');
}

/**
 * Salva artigos classificados no Firestore
 */
export async function saveClassifiedArticles(articles) {
  try {
    const firestore = initializeFirestore();
    const saved = [];
    const skipped = [];

    for (const article of articles) {
      try {
        // Validar se artigo tem URL
        if (!article.url) {
          console.log(`[Firestore] ⚠️  Skipping article without URL: ${article.title || 'Unknown'}`);
          skipped.push({ reason: 'no_url', title: article.title });
          continue;
        }

        const docId = urlToDocId(article.url);
        if (!docId) {
          console.log(`[Firestore] ⚠️  Invalid URL format: ${article.url}`);
          skipped.push({ reason: 'invalid_url', url: article.url });
          continue;
        }

        const docRef = firestore.collection('classified_news').doc(docId);

        // Verificar se já existe
        const doc = await docRef.get();
        if (doc.exists) {
          skipped.push({ reason: 'duplicate', url: article.url });
          continue;
        }

        // Salvar
        await docRef.set({
          url: article.url,
          title: article.title || '',
          description: article.description || article.text || '',
          topics: article.topics || [],
          source: article.source || '',
          publishedAt: article.publishedAt || new Date().toISOString(),
          processedAt: new Date()
        });

        saved.push(article.url);
      } catch (error) {
        console.error(`[Firestore] Error saving article ${article.url}: ${error.message}`);
      }
    }

    console.log(`[Firestore] ✅ Saved: ${saved.length}, Skipped (duplicates): ${skipped.length}`);
    return { saved: saved.length, total: articles.length };

  } catch (error) {
    console.error('[Firestore] ❌ Error:', error.message);
    throw error;
  }
}
