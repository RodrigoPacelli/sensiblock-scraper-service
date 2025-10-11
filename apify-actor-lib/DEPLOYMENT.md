# Deployment e Integração do News Scraper Actor

## 🚀 Deploy no Apify

### 1. Preparação
```bash
# Acesse a pasta do Actor
cd /home/filipe/sensiblock-monorepo/apify-actor

# Instale Apify CLI se não tiver
npm install -g @apify/cli

# Login no Apify
apify login
```

### 2. Deploy
```bash
# Criar novo Actor no Apify
apify create my-news-scraper

# Ou fazer deploy em Actor existente
apify push
```

### 3. Configuração no Apify Console
1. Acesse [console.apify.com](https://console.apify.com)
2. Vá para seu Actor
3. Configure as **Environment Variables** se necessário
4. Teste o Actor com input de exemplo
5. Anote o **Actor ID** para integração

## 🔧 Integração com SensiBlock

### 1. Instalar SDK do Apify no projeto principal
```bash
cd /home/filipe/sensiblock-monorepo
npm install apify-client
```

### 2. Criar serviço de integração

Criar arquivo `/src/services/apify-news-service.ts`:

```typescript
import { ApifyApi } from 'apify-client';

export class ApifyNewsService {
  private client: ApifyApi;
  private actorId: string;

  constructor() {
    this.client = new ApifyApi({
      token: process.env.APIFY_TOKEN!, // Adicionar ao .env
    });
    this.actorId = process.env.APIFY_NEWS_ACTOR_ID!; // Adicionar ao .env
  }

  async collectNews(sites?: string[], maxArticles = 25) {
    try {
      const run = await this.client.actor(this.actorId).call({
        sites: sites || [
          'edition.cnn.com',
          'www.bbc.com',
          'www.reuters.com',
          'www.theguardian.com',
          'www.nytimes.com',
          'apnews.com'
        ],
        maxArticlesPerSite: maxArticles,
        timeout: 45000,
        dateFilter: 'today',
        removeDuplicates: true
      });

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      if (items.length > 0) {
        return items[0]; // Retorna o resultado no formato NewsAPI
      }

      throw new Error('No data returned from Apify Actor');
    } catch (error) {
      console.error('Error calling Apify Actor:', error);
      throw error;
    }
  }
}
```

### 3. Modificar Global News Scheduler

Editar `/src/services/global-news-scheduler.ts`:

```typescript
import { ApifyNewsService } from './apify-news-service';

export class GlobalNewsScheduler {
  private apifyService: ApifyNewsService;

  constructor() {
    this.apifyService = new ApifyNewsService();
  }

  private async collectNews(): Promise<any[]> {
    try {
      console.log('[Scheduler] 🌐 Collecting news via Apify Actor...');

      const result = await this.apifyService.collectNews();

      console.log(`[Scheduler] ✅ Collected ${result.totalResults} articles from ${result.sources.join(', ')}`);

      return result.articles;
    } catch (error) {
      console.error('[Scheduler] ❌ Error collecting news:', error);
      throw error;
    }
  }

  // Resto do código permanece igual
}
```

### 4. Atualizar variáveis de ambiente

Adicionar ao `.env`:
```env
# Apify Configuration
APIFY_TOKEN=your_apify_token_here
APIFY_NEWS_ACTOR_ID=your_actor_id_here
```

### 5. Modificar API endpoint

Editar `/src/app/api/news/global-main-batch/route.ts`:

```typescript
import { ApifyNewsService } from '@/services/apify-news-service';

export async function GET() {
  try {
    const apifyService = new ApifyNewsService();
    const result = await apifyService.collectNews();

    return Response.json({
      success: true,
      articles: result.articles,
      totalResults: result.totalResults,
      sources: result.sources,
      collectedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to collect news', details: error.message },
      { status: 500 }
    );
  }
}
```

## 🧪 Teste Local

```bash
cd /home/filipe/sensiblock-monorepo/apify-actor
node test-local.js
```

## 📊 Monitoramento

### 1. Logs no Apify Console
- Visualize logs em tempo real
- Monitore performance e erros
- Configure alertas

### 2. Métricas importantes
- **Tempo de execução**: ~2-3 minutos
- **Artigos coletados**: 100-150 por execução
- **Taxa de sucesso**: >95%
- **Custo**: ~$0.02-0.05 por execução

## 🔄 Backup e Fallback

### Estratégia de fallback:
```typescript
async function collectNewsWithFallback() {
  try {
    // Tentar Apify primeiro
    return await apifyService.collectNews();
  } catch (error) {
    console.warn('Apify failed, using fallback...');

    // Fallback para RSS feeds ou outras fontes
    return await rssService.collectNews();
  }
}
```

## 💰 Custos Estimados

### Apify Pricing (Free tier: $5/mês):
- **Personal**: $49/mês - 64GB storage, $0.25/GB compute
- **Team**: $499/mês - unlimited storage, $0.25/GB compute

### Uso estimado SensiBlock:
- **Execuções**: 4x/dia = 120/mês
- **Custo por execução**: ~$0.03
- **Total mensal**: ~$3.60 + plano base

**Total estimado: $52.60/mês** (muito menor que NewsAPI.ai premium)

## ✅ Checklist de Deploy

- [ ] Deploy do Actor no Apify
- [ ] Configurar variáveis de ambiente
- [ ] Testar Actor isoladamente
- [ ] Criar serviço de integração
- [ ] Modificar scheduler
- [ ] Atualizar API endpoints
- [ ] Testes end-to-end
- [ ] Configurar monitoramento
- [ ] Deploy em produção