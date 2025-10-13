# Changelog - Sensiblock Scraper Service

## [1.1.0] - 2025-10-13

### ✨ Added
- **Suporte a delay/interval**: Endpoints `/scrape` e `/scrape-batch` agora aceitam parâmetros de timing
  - `/scrape`: parâmetro `delay` (ms) para intervalo entre requisições
  - `/scrape-batch`: parâmetro `interval` (ms) para intervalo entre URLs
- **Endpoint /system-metrics**: Novo endpoint para monitoramento de CPU, RAM, uptime
  - Métricas do processo Node.js
  - Métricas do sistema operacional
  - Métricas do scraper (runs, success rate, queue)
- **Helper formatUptime()**: Formata uptime em formato legível (d/h/m/s)

### 🔧 Changed
- **Limites removidos**: `maxArticlesPerSite` e `maxArticlesPerUrl` alterados de 50 para 9999
- **Logs melhorados**: Contador de progresso `[i/total]` no batch scraping
- **Documentação**: JSDoc atualizada com novos parâmetros

### 🎯 Integration
- Repositório agora é standalone, separado do monorepo principal
- Workspace configurado para desenvolvimento simultâneo com sensiblock-monorepo

---

## [1.0.0] - 2025-10-11

### 🚀 Initial Release
- Express server para scraping de notícias
- Queue manager para controle de concorrência
- Endpoints `/scrape` e `/scrape-batch`
- PM2 ecosystem configuration
- Docker support
- VPS deployment scripts
