# 🚀 Deploy Guide - Apify Actor Service → Hostinger VPS

Guia completo de deploy automatizado usando **GitHub Actions + PM2 + SSH**.

---

## 📋 Pré-requisitos

### No seu VPS Hostinger:
- Ubuntu 20.04+ ou Debian 11+
- Acesso SSH (root ou sudo)
- Mínimo 2GB RAM
- Mínimo 10GB disco
- Node.js 20.x (será instalado automaticamente)

### No GitHub:
- Repositório com acesso SSH
- GitHub Actions habilitado
- Secrets configurados (ver abaixo)

---

## 🛠️ Setup Inicial do VPS (Primeira vez)

### 1. Conectar ao VPS via SSH

```bash
ssh root@YOUR_VPS_IP
```

### 2. Executar script de setup

```bash
# Download do script
curl -o setup-vps.sh https://raw.githubusercontent.com/YOUR_USERNAME/sensiblock-monorepo/main/apify-actor-local-service/scripts/setup-vps.sh

# Tornar executável
chmod +x setup-vps.sh

# Executar
./setup-vps.sh
```

**O que o script faz:**
- ✅ Atualiza sistema operacional
- ✅ Instala Node.js 20.x
- ✅ Instala PM2 (gerenciador de processos)
- ✅ Instala Git
- ✅ Instala Chromium e dependências (Playwright)
- ✅ Cria diretório da aplicação (`/var/www/apify-actor-service`)
- ✅ Gera chave SSH para GitHub
- ✅ Clona repositório
- ✅ Instala dependências
- ✅ Configura PM2 startup
- ✅ Inicia serviço
- ✅ Configura firewall

### 3. Adicionar SSH Key ao GitHub

Durante o setup, você verá a chave SSH pública. Copie e adicione em:

👉 **https://github.com/settings/keys**

---

## 🔐 Configurar GitHub Secrets

Acesse seu repositório no GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

### Secrets necessários:

| Secret | Valor | Descrição |
|--------|-------|-----------|
| `VPS_HOST` | `192.168.1.100` | IP do seu VPS Hostinger |
| `VPS_USERNAME` | `root` | Usuário SSH (geralmente `root`) |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` | Conteúdo da chave privada SSH |
| `VPS_PORT` | `22` | Porta SSH (padrão: 22) |

### Como obter a chave privada SSH:

```bash
# No VPS
cat ~/.ssh/id_rsa
```

Copie TODO o conteúdo, incluindo:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...conteúdo da chave...
-----END OPENSSH PRIVATE KEY-----
```

---

## 🚀 Deploy Automático (CI/CD)

### Como funciona:

1. **Push** para branch `main` → Trigger GitHub Actions
2. **Build** e testes rodados automaticamente
3. **Deploy via SSH** para VPS Hostinger
4. **PM2** reinicia serviço automaticamente
5. **Health check** pós-deploy

### Fazer deploy:

```bash
# 1. Fazer mudanças no código
vim server.js

# 2. Commit e push
git add .
git commit -m "feat: Melhoria no scraper"
git push origin main

# 3. Acompanhar deploy
# https://github.com/YOUR_USERNAME/sensiblock-monorepo/actions
```

### Gatilhos de deploy:

O deploy é acionado quando há push para `main` com mudanças em:
- `apify-actor-local-service/**`
- `apify-actor/**`
- `.github/workflows/deploy-apify-service.yml`

### Deploy manual via GitHub Actions:

1. Acesse: **Actions → Deploy Apify Actor Service to Hostinger VPS**
2. Clique em **Run workflow**
3. Selecione branch `main`
4. Clique em **Run workflow**

---

## 🔧 Deploy Manual (Via SSH)

Se preferir fazer deploy manual sem GitHub Actions:

```bash
# No seu computador local
cd apify-actor-local-service
./scripts/deploy-manual.sh YOUR_VPS_IP root
```

---

## 📊 Monitoramento

### No VPS:

```bash
# Status do PM2
pm2 list

# Logs em tempo real
pm2 logs apify-actor-service

# Logs apenas de erros
pm2 logs apify-actor-service --err

# Últimas 100 linhas
pm2 logs apify-actor-service --lines 100

# Métricas de CPU/memória
pm2 monit

# Parar serviço
pm2 stop apify-actor-service

# Reiniciar serviço
pm2 restart apify-actor-service

# Reload (zero-downtime)
pm2 reload apify-actor-service
```

### Via HTTP (de qualquer lugar):

```bash
# Health check
curl http://YOUR_VPS_IP:3005/health

# Métricas
curl http://YOUR_VPS_IP:3005/metrics

# Status da fila
curl http://YOUR_VPS_IP:3005/queue
```

---

## 🔥 Troubleshooting

### 1. Health check falhou após deploy

```bash
# Ver logs
ssh root@YOUR_VPS_IP
pm2 logs apify-actor-service --lines 50

# Verificar se porta está aberta
netstat -tulpn | grep 3005

# Verificar processos
ps aux | grep node
```

### 2. Serviço não inicia

```bash
# Reiniciar PM2
pm2 kill
pm2 start /var/www/apify-actor-service/apify-actor-local-service/ecosystem.config.cjs --env production
pm2 save

# Verificar memória
free -h

# Verificar disco
df -h
```

### 3. GitHub Actions falha no SSH

- Verificar se `VPS_SSH_KEY` está correto (incluindo quebras de linha)
- Verificar se firewall permite conexão na porta 22
- Testar conexão manual: `ssh -i ~/.ssh/id_rsa root@YOUR_VPS_IP`

### 4. Out of memory

```bash
# Aumentar swap (se necessário)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Verificar
free -h
```

### 5. Chromium não encontrado

```bash
# Instalar Chromium manualmente
sudo apt update
sudo apt install -y chromium-browser

# Verificar instalação
which chromium-browser
```

---

## 🔄 Atualizações

### Atualizar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
pm2 restart apify-actor-service
```

### Atualizar PM2

```bash
sudo npm install -g pm2@latest
pm2 update
```

### Atualizar dependências da aplicação

```bash
cd /var/www/apify-actor-service/apify-actor-local-service
npm update
pm2 restart apify-actor-service
```

---

## 📈 Performance

### Configurações recomendadas no VPS:

- **RAM**: Mínimo 2GB (recomendado 4GB)
- **CPU**: Mínimo 2 cores
- **Disco**: Mínimo 10GB (scraping gera logs)
- **Swap**: 2GB (para evitar OOM)

### Limites configurados:

- **Max heap size**: 1GB (Node.js)
- **Max restarts**: 10 vezes
- **Memory restart**: 1GB (PM2 reinicia se exceder)
- **Timeout**: 5 minutos por scrape
- **Concurrent jobs**: 1 (fila sequencial)

---

## 🔒 Segurança

### Firewall configurado automaticamente:

- **Porta 22**: SSH (obrigatório)
- **Porta 3005**: Apify service (aberto)

### Recomendações adicionais:

1. **Mudar porta SSH padrão** (22 → outra)
2. **Desabilitar login root** (criar usuário específico)
3. **Configurar fail2ban** (proteção contra brute force)
4. **SSL/TLS** (se expor serviço publicamente)
5. **Rate limiting** (nginx como proxy reverso)

---

## 📚 Arquivos de Configuração

- **Dockerfile**: Build otimizado para produção
- **ecosystem.config.cjs**: Configuração PM2
- **.github/workflows/deploy-apify-service.yml**: GitHub Actions workflow
- **scripts/setup-vps.sh**: Setup inicial do VPS
- **scripts/deploy-manual.sh**: Deploy manual via SSH

---

## 🆘 Suporte

### Logs úteis:

```bash
# Logs do PM2
pm2 logs apify-actor-service

# Logs do sistema
journalctl -u pm2-root -f

# Logs do GitHub Actions
# https://github.com/YOUR_USERNAME/sensiblock-monorepo/actions
```

### Comandos úteis:

```bash
# Verificar status completo
pm2 show apify-actor-service

# Reiniciar com logs
pm2 restart apify-actor-service --log

# Flush logs (limpar)
pm2 flush

# Métricas em tempo real
curl -s http://localhost:3005/metrics | jq '.'
```

---

## ✅ Checklist de Deploy

- [ ] VPS configurado com `setup-vps.sh`
- [ ] SSH key adicionada ao GitHub
- [ ] GitHub Secrets configurados (`VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY`, `VPS_PORT`)
- [ ] Firewall configurado (portas 22 e 3005)
- [ ] PM2 rodando e salvo
- [ ] Health check retorna 200
- [ ] GitHub Actions workflow executado com sucesso
- [ ] Monitoramento via `pm2 monit` funcional
- [ ] Logs sendo gerados corretamente

---

**🎉 Deploy concluído! Seu scraper está rodando na nuvem.**

Para monitorar: `ssh root@YOUR_VPS_IP "pm2 monit"`
