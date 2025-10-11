# 🚀 Quickstart Guide - Apify Actor Local

Guia rápido para testar a integração do Apify Actor Local com o SensiBlock.

## ⚡ Teste Rápido (5 minutos)

### 1. Instalar Dependências

```bash
cd /home/filipe/sensiblock-monorepo/apify-actor-local-service
npm install

cd ../apify-actor
npm install
```

### 2. Iniciar Serviço

```bash
cd ../apify-actor-local-service
./start.sh
```

Você deve ver:
```
🚀 Apify Actor Local Service
================================================================================
📡 Server running on: http://localhost:3005
...
```

### 3. Testar Health Check

Em outro terminal:
```bash
curl http://localhost:3005/health
```

Deve retornar status `"healthy"`.

### 4. Executar Primeiro Scrape

```bash
curl -X POST http://localhost:3005/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "sites": ["edition.cnn.com"],
    "maxArticlesPerSite": 10
  }'
```

**Tempo esperado**: 2-3 minutos

**Resultado esperado**: JSON com array de artigos da CNN.

### 5. Integrar com SensiBlock

Adicione ao `.env.development`:
```bash
APIFY_LOCAL_URL=http://localhost:3005
NEWS_PROVIDER=apify-local
```

Reinicie o Next.js:
```bash
# Terminal do Next.js
npm run dev
```

### 6. Testar via UI

Acesse: `http://localhost:3000/`

O sistema agora usará o Apify Local para buscar notícias.

## 🧪 Troubleshooting Rápido

### Problema: Port 3005 já em uso
```bash
./stop.sh
./start.sh
```

### Problema: Actor timeout ou memória
Edite `package.json`:
```json
"scripts": {
  "start": "NODE_OPTIONS='--max-old-space-size=512' node server.js"
}
```

### Problema: Dependências faltando
```bash
npm install
cd ../apify-actor && npm install
```

## 📊 Verificar Se Está Funcionando

### Check 1: Service Health
```bash
curl http://localhost:3005/health | jq
```

Deve mostrar:
- `"status": "healthy"`
- Métricas de memória
- Queue status

### Check 2: Executar Scrape
```bash
time curl -X POST http://localhost:3005/scrape \
  -H "Content-Type: application/json" \
  -d '{"sites": ["edition.cnn.com"], "maxArticlesPerSite": 10}'
```

Deve retornar JSON com:
- `"status": "ok"`
- Array `articles` com ~10 artigos
- `"totalResults": 10`
- `"sources": ["CNN"]`

### Check 3: Métricas
```bash
curl http://localhost:3005/metrics
```

Deve mostrar:
- `totalRuns > 0`
- `successfulRuns > 0`
- `successRate: "100.00%"` (se tudo OK)

## 🎯 Próximos Passos

1. ✅ Serviço rodando
2. ✅ Primeiro scrape bem-sucedido
3. ⬜ Integrar com UI do SensiBlock
4. ⬜ Testar múltiplos portais
5. ⬜ Monitorar performance

## 💡 Dicas

- **Mantenha o serviço rodando**: Deixe em terminal separado
- **Monitore memória**: `free -h` durante execução
- **Logs em tempo real**: Acompanhe no terminal do serviço
- **Para jobs**: Use `./stop.sh` para parar gracefully

## 📞 Comandos Úteis

```bash
# Ver logs em tempo real
tail -f /home/filipe/sensiblock-monorepo/apify-actor-local-service/server.log

# Status da fila
watch -n 2 'curl -s http://localhost:3005/queue'

# Métricas
watch -n 5 'curl -s http://localhost:3005/metrics'

# Forçar parada
lsof -ti:3005 | xargs kill -9
```

---

**Tempo total**: ~5 minutos
**Próximo passo**: Integrar com UI do SensiBlock
