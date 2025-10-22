/**
 * AI Classifier Client
 * Integra com o microserviço de classificação de notícias
 */

const CLASSIFIER_API = 'https://classify-ktx25vu2da-uc.a.run.app';

/**
 * Classifica um artigo usando a API de IA
 */
async function classifyArticle(article) {
  try {
    const response = await fetch(`${CLASSIFIER_API}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: article.title || article.headline || '',
        contentExtract: article.description || article.content || article.text || '',
        url: article.url || article.link || '' // ✅ NOVO: Enviar URL para classificar vídeos
      }),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Classifier API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Classification failed');
    }

    return data.topics || [];
  } catch (error) {
    console.error(`[AI Classifier] Error classifying article: ${error.message}`);
    return []; // Retorna array vazio em caso de erro
  }
}

/**
 * Classifica múltiplos artigos em batch (máx 10 por vez)
 * Retorna artigos originais + tópicos classificados
 */
async function classifyBatch(articles) {
  const BATCH_SIZE = 10;
  const classifiedArticles = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await fetch(`${CLASSIFIER_API}/classify-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: batch.map(a => ({
            headline: a.title || a.headline || '',
            contentExtract: a.description || a.content || a.text || '',
            url: a.url || a.link || '' // ✅ NOVO: Enviar URL para classificar vídeos
          }))
        }),
        signal: AbortSignal.timeout(30000) // 30s timeout for batch
      });

      if (!response.ok) {
        throw new Error(`Classifier API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.results) {
        // IMPORTANTE: Mesclar tópicos com dados originais do artigo
        for (let j = 0; j < batch.length; j++) {
          const original = batch[j];
          const classification = data.results[j];
          
          classifiedArticles.push({
            ...original, // Mantém URL, title, description, etc.
            topics: classification?.topics || []
          });
        }
      } else {
        // Se batch falhar, classifica individualmente
        console.warn('[AI Classifier] Batch failed, falling back to individual classification');
        for (const article of batch) {
          const topics = await classifyArticle(article);
          classifiedArticles.push({ ...article, topics });
        }
      }
    } catch (error) {
      console.error(`[AI Classifier] Batch error: ${error.message}`);
      // Fallback: classifica individualmente
      for (const article of batch) {
        const topics = await classifyArticle(article);
        classifiedArticles.push({ ...article, topics });
      }
    }

    // Rate limiting entre batches
    if (i + BATCH_SIZE < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return classifiedArticles;
}

export { classifyArticle, classifyBatch };
