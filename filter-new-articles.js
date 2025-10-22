/**
 * Filter New Articles
 * Remove artigos que já existem no Firestore ANTES de enviar para IA
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db = null;

/**
 * Inicializa Firebase (reutilizar do firestore-client)
 */
function initializeFirestore() {
  if (db) return db;

  try {
    const apps = getApps();
    if (apps.length === 0) {
      const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
      
      if (!serviceAccountJson) {
        throw new Error('SERVICE_ACCOUNT_JSON not found in environment');
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount)
      });

      console.log('[FilterNew] ✅ Firebase Admin SDK initialized');
    }

    db = getFirestore();
    return db;
  } catch (error) {
    console.error('[FilterNew] ❌ Failed to initialize:', error.message);
    throw error;
  }
}

/**
 * Converte URL para ID seguro
 */
function urlToDocId(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  return url.replace(/[/\#?:]/g, '_').replace(/^https?_+/, '');
}

/**
 * Filtra apenas artigos NOVOS (que NÃO existem no Firestore)
 */
export async function filterNewArticles(articles) {
  try {
    const firestore = initializeFirestore();
    const newArticles = [];
    const existing = [];

    console.log(`[FilterNew] 🔍 Checking ${articles.length} articles against Firestore...`);

    // Verificar cada artigo no Firestore
    for (const article of articles) {
      if (!article.url) {
        continue; // Skip sem URL
      }

      const docId = urlToDocId(article.url);
      if (!docId) {
        continue;
      }

      const docRef = firestore.collection('classified_news').doc(docId);
      const doc = await docRef.get();

      if (doc.exists) {
        existing.push(article.url);
      } else {
        newArticles.push(article);
      }
    }

    console.log(`[FilterNew] ✅ ${newArticles.length} new, ${existing.length} already exist`);

    return {
      newArticles,
      existingCount: existing.length
    };

  } catch (error) {
    console.error('[FilterNew] ❌ Error:', error.message);
    // Em caso de erro, retornar todos os artigos (fallback seguro)
    return {
      newArticles: articles,
      existingCount: 0
    };
  }
}
