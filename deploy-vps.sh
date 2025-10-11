#!/bin/bash

# 🚀 Script de Deploy Automatizado - Apify Actor Cloud Service
# Execute este script no VPS para fazer deploy completo

set -e  # Para em caso de erro

echo "=============================================================================="
echo "🚀 Deploy Apify Actor Cloud Service"
echo "=============================================================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações
REPO_URL="https://github.com/sensiblocker/sensiblock-monorepo.git"
BRANCH="developer2"
APP_DIR="/var/www/apify-actor-cloud"
CONTAINER_NAME="apify-actor-cloud-service"
PORT=3005

echo -e "${YELLOW}📋 Configurações:${NC}"
echo "   - Repositório: $REPO_URL"
echo "   - Branch: $BRANCH"
echo "   - Diretório: $APP_DIR"
echo "   - Container: $CONTAINER_NAME"
echo "   - Porta: $PORT"
echo ""

# 1. Parar container existente (se houver)
echo -e "${YELLOW}1. Parando container existente (se houver)...${NC}"
if docker ps -a | grep -q $CONTAINER_NAME; then
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    echo -e "${GREEN}✓ Container parado e removido${NC}"
else
    echo -e "${GREEN}✓ Nenhum container existente${NC}"
fi
echo ""

# 2. Remover imagem antiga (se houver)
echo -e "${YELLOW}2. Removendo imagem Docker antiga...${NC}"
docker rmi apify-cloud:latest 2>/dev/null || echo -e "${GREEN}✓ Nenhuma imagem antiga${NC}"
echo ""

# 3. Criar diretório se não existir
echo -e "${YELLOW}3. Preparando diretório...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR
echo -e "${GREEN}✓ Diretório: $(pwd)${NC}"
echo ""

# 4. Clonar ou atualizar repositório
echo -e "${YELLOW}4. Clonando/atualizando repositório...${NC}"
if [ -d "sensiblock-monorepo/.git" ]; then
    echo "   Repositório já existe, atualizando..."
    cd sensiblock-monorepo
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
    echo -e "${GREEN}✓ Repositório atualizado${NC}"
else
    echo "   Clonando repositório..."
    git clone -b $BRANCH $REPO_URL sensiblock-monorepo
    cd sensiblock-monorepo
    echo -e "${GREEN}✓ Repositório clonado${NC}"
fi
echo ""

# 5. Navegar para diretório do serviço
echo -e "${YELLOW}5. Navegando para diretório do serviço...${NC}"
cd apify-actor-cloud-service
echo -e "${GREEN}✓ Diretório atual: $(pwd)${NC}"
echo ""

# 6. Build da imagem Docker
echo -e "${YELLOW}6. Fazendo build da imagem Docker...${NC}"
echo "   (Isso pode levar alguns minutos...)"
docker build -t apify-cloud:latest -f Dockerfile.easypanel . 2>&1 | tail -20
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ Build concluído com sucesso${NC}"
else
    echo -e "${RED}✗ Erro no build${NC}"
    exit 1
fi
echo ""

# 7. Criar diretório de storage
echo -e "${YELLOW}7. Criando diretório de storage...${NC}"
mkdir -p $APP_DIR/storage
echo -e "${GREEN}✓ Storage pronto${NC}"
echo ""

# 8. Executar container
echo -e "${YELLOW}8. Iniciando container Docker...${NC}"
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $PORT:$PORT \
  -e PORT=$PORT \
  -e NODE_ENV=production \
  -e NODE_OPTIONS="--max-old-space-size=1024" \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  -e LOG_LEVEL=info \
  -e PROXY_PROVIDER=none \
  -v $APP_DIR/storage:/app/storage \
  apify-cloud:latest

echo -e "${GREEN}✓ Container iniciado${NC}"
echo ""

# 9. Aguardar inicialização
echo -e "${YELLOW}9. Aguardando inicialização (10s)...${NC}"
sleep 10
echo -e "${GREEN}✓ Pronto${NC}"
echo ""

# 10. Verificar status
echo -e "${YELLOW}10. Verificando status...${NC}"
echo ""
echo "   📊 Status do container:"
docker ps | grep $CONTAINER_NAME || echo -e "${RED}   ✗ Container não está rodando${NC}"
echo ""

# 11. Health check
echo -e "${YELLOW}11. Verificando health check...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$PORT/health || echo "FAILED")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passou!${NC}"
    echo ""
    echo "   📋 Resposta do health check:"
    echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check falhou${NC}"
    echo "   Resposta: $HEALTH_RESPONSE"
    echo ""
    echo "   📋 Últimas 30 linhas de log:"
    docker logs --tail 30 $CONTAINER_NAME
    exit 1
fi
echo ""

# 12. Resumo final
echo "=============================================================================="
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo "=============================================================================="
echo ""
echo "📡 Serviço rodando em:"
echo "   - http://localhost:$PORT"
echo "   - http://31.97.131.161:$PORT (externo)"
echo ""
echo "🔗 Endpoints disponíveis:"
echo "   - Health: http://localhost:$PORT/health"
echo "   - Metrics: http://localhost:$PORT/metrics"
echo "   - Queue: http://localhost:$PORT/queue"
echo ""
echo "📋 Comandos úteis:"
echo "   - Ver logs:      docker logs -f $CONTAINER_NAME"
echo "   - Parar:         docker stop $CONTAINER_NAME"
echo "   - Reiniciar:     docker restart $CONTAINER_NAME"
echo "   - Status:        docker ps | grep $CONTAINER_NAME"
echo "   - Health check:  curl http://localhost:$PORT/health"
echo ""
echo "=============================================================================="
