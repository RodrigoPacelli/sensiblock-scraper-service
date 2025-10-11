# Apify Actor Cloud Service

Serviço Node.js que executa o Apify Actor **na nuvem (Hostinger VPS)**, integrando-o ao sistema modular de news providers do SensiBlock.

## 🎯 Objetivo

Rodar o código do Apify Actor (`apify-actor/main.js`) em produção na nuvem via HTTP API, **com deploy automatizado via GitHub Actions**, permitindo scraping 24/7 de portais internacionais (CNN, BBC, Reuters, Guardian, NYT, AP News).

## 🔄 Diferença entre Local vs Cloud

- **`apify-actor-local-service/`**: Desenvolvimento local (localhost:3005)
- **`apify-actor-cloud-service/`**: Produção na nuvem (VPS Hostinger) ← **VOCÊ ESTÁ AQUI**

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│         SensiBlock App (Next.js) - Port 3000                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  NewsProviderFactory → ApifyLocalProvider              │ │
│  │  Calls HTTP API → http://localhost:3005/scrape         │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP POST
                        ▼
┌─────────────────────────────────────────────────────────────┐
│      Apify Actor Local Service - Port 3005                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express Server (server.js)                            │ │
│  │  - Queue Manager (1 concurrent job)                    │ │
│  │  - Health Check + Metrics                              │ │
│  │  - Spawn child process → apify-actor/main.js           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Componentes

### 1. **server.js**
Express server principal:
- **Endpoint `/scrape`**: Executa scraping (POST)
- **Endpoint `/health`**: Health check + métricas (GET)
- **Endpoint `/queue`**: Status da fila (GET)
- **Endpoint `/metrics`**: Estatísticas gerais (GET)
- **Queue system**: Máximo 1 job simultâneo
- **Memory limit**: 1GB por job
- **Timeout**: 5 minutos por execução

### 2. **queue-manager.js**
Gerenciador de fila:
- Controla concorrência (1 job por vez)
- Evita sobrecarga de memória
- Processa jobs sequencialmente

### 3. **mock-apify-actor.js**
Mock do Apify SDK:
- Simula `Actor.init()`, `Actor.getInput()`, `Actor.pushData()`
- Permite rodar código original do actor sem modificações
- Output via marcadores especiais no stdout

## 🚀 Instalação

```bash
cd apify-actor-local-service

# Instalar dependências do serviço
npm install

# Instalar dependências do actor (se necessário)
cd ../apify-actor
npm install
```

## ▶️ Uso

### Iniciar Serviço

```bash
cd apify-actor-local-service
./start.sh
# ou
npm start
```

Saída esperada:
```
🚀 Apify Actor Local Service
================================================================================
📡 Server running on: http://localhost:3005
🏥 Health check: http://localhost:3005/health
📊 Metrics: http://localhost:3005/metrics
📋 Queue status: http://localhost:3005/queue

⚙️  Configuration:
   - Max concurrent scrapers: 1
   - Memory limit per job: 1GB
   - Timeout per job: 5 minutes
   - Actor path: ../apify-actor/main.js
================================================================================
```

### Parar Serviço

```bash
./stop.sh
```

### Testar Manualmente

```bash
# Health check
curl http://localhost:3005/health

# Scrape CNN
curl -X POST http://localhost:3005/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "sites": ["edition.cnn.com"],
    "maxArticlesPerSite": 50
  }'

# Status da fila
curl http://localhost:3005/queue

# Métricas
curl http://localhost:3005/metrics
```

## 🔗 Integração com SensiBlock

### 1. Configurar variável de ambiente

Adicionar ao `.env.development`:
```bash
# Apify Local Service
APIFY_LOCAL_URL=http://localhost:3005

# Usar apify-local como provider padrão (opcional)
NEWS_PROVIDER=apify-local
```

### 2. Usar no código

O provider já está registrado automaticamente. Apenas configure a variável de ambiente:

```typescript
// Será usado automaticamente se NEWS_PROVIDER=apify-local
const factory = NewsProviderFactory.getInstance();
const provider = factory.getActiveProvider();

const result = await provider.fetchNews({
  domains: ['cnn.com', 'bbc.com'],
  maxArticles: 50
});
```

## 📊 Portais Suportados

- **CNN** (edition.cnn.com)
- **BBC** (www.bbc.com)
- **Reuters** (www.reuters.com)
- **The Guardian** (www.theguardian.com)
- **New York Times** (www.nytimes.com)
- **AP News** (apnews.com)

## ⚡ Performance

- **Tempo por execução**: 2-5 minutos (1 site)
- **Memória**: ~800MB-1.2GB por job
- **Throughput**: ~2-3 scrapes/hora (fila limitada)
- **Artigos**: 50-500 por execução
- **Custo**: **$0** (gratuito, local)

## 🔧 Troubleshooting

### Erro: Port 3005 already in use
```bash
./stop.sh
./start.sh
```

### Erro: Cannot find module 'express'
```bash
npm install
```

### Erro: Actor timeout
- Aumentar timeout em `server.js` (linha 151)
- Reduzir `maxArticlesPerSite`

### Erro: Out of memory
- Reduzir `NODE_OPTIONS --max-old-space-size` em `package.json`
- Verificar memória disponível: `free -h`

## 📝 Logs

O serviço loga automaticamente:
- ✅ Jobs completados
- ❌ Jobs falhados
- 📊 Estatísticas de artigos
- ⏱️ Duração de execução
- 🧠 Uso de memória

## 🛠️ Desenvolvimento

### Modo watch (auto-reload)
```bash
npm run dev
```

### Debug
Habilitar logs verbosos no `server.js`:
```javascript
const env = {
  ...process.env,
  DEBUG: '*'
};
```

## 🔒 Segurança

- Serviço roda apenas localhost (não exposto publicamente)
- Sem autenticação necessária (uso interno)
- Child processes isolados
- Memory limits aplicados

## 📈 Monitoramento

### Health Check
```bash
curl http://localhost:3005/health
```

Resposta:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "queue": {
    "active": 0,
    "queued": 0,
    "maxConcurrent": 1
  },
  "metrics": {
    "totalRuns": 5,
    "successfulRuns": 4,
    "failedRuns": 1,
    "successRate": "80.00%"
  },
  "memory": {
    "heapUsed": "45MB",
    "heapTotal": "128MB",
    "rss": "156MB"
  }
}
```

## 📚 Próximos Passos

1. ✅ Serviço local funcional
2. ✅ Integração com sistema de providers
3. 🔄 Adicionar mais portais (brasileiros via Firecrawl)
4. 🔄 Implementar caching de resultados
5. 🔄 Dashboard de monitoramento

## 🤝 Contribuindo

Este é um serviço interno do SensiBlock. Para modificações, siga o padrão de código existente e teste localmente antes de fazer commit.

---

**Desenvolvido para SensiBlock** | Execução local gratuita de Apify Actors
