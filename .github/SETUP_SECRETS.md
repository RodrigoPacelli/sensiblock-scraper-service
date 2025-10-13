# GitHub Secrets Configuration

Para habilitar o deploy automático via GitHub Actions, você precisa configurar os seguintes secrets no repositório.

## 🔐 Secrets Necessários

Navegue até: **Settings → Secrets and variables → Actions → New repository secret**

### 1. `VPS_HOST`
- **Descrição**: IP ou hostname da VPS Hostinger
- **Valor**: `31.97.131.161`

### 2. `VPS_USERNAME`
- **Descrição**: Usuário SSH da VPS
- **Valor**: `root`

### 3. `VPS_SSH_KEY`
- **Descrição**: Chave privada SSH para autenticação
- **Como obter**:
  ```bash
  cat ~/.ssh/id_rsa
  ```
  Copie TODA a saída, incluindo:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...conteúdo da chave...
  -----END OPENSSH PRIVATE KEY-----
  ```

### 4. `VPS_PORT` (Opcional)
- **Descrição**: Porta SSH (padrão: 22)
- **Valor**: `22`
- **Nota**: Se não configurado, usa porta 22 por padrão

---

## ✅ Como Configurar

### Via Interface Web do GitHub

1. Acesse o repositório: https://github.com/RodrigoPacelli/sensiblock-scraper-service
2. Clique em **Settings** (engrenagem no topo)
3. No menu lateral esquerdo, clique em **Secrets and variables** → **Actions**
4. Clique em **New repository secret**
5. Adicione cada secret listado acima

### Via GitHub CLI

```bash
# VPS_HOST
gh secret set VPS_HOST --body "31.97.131.161" --repo RodrigoPacelli/sensiblock-scraper-service

# VPS_USERNAME
gh secret set VPS_USERNAME --body "root" --repo RodrigoPacelli/sensiblock-scraper-service

# VPS_SSH_KEY (da sua chave privada)
gh secret set VPS_SSH_KEY --body "$(cat ~/.ssh/id_rsa)" --repo RodrigoPacelli/sensiblock-scraper-service

# VPS_PORT (opcional)
gh secret set VPS_PORT --body "22" --repo RodrigoPacelli/sensiblock-scraper-service
```

---

## 🚀 Workflow de Deploy

Após configurar os secrets, o deploy automático será acionado em:

### Push na branch `master`
```bash
git push origin master
```

### Trigger manual (via GitHub)
1. Acesse **Actions** no repositório
2. Selecione **Deploy Scraper Service to Hostinger VPS**
3. Clique em **Run workflow**
4. Selecione branch `master`
5. Clique em **Run workflow**

---

## 📊 Logs do Deploy

Você pode acompanhar o progresso do deploy em:

https://github.com/RodrigoPacelli/sensiblock-scraper-service/actions

Cada deploy mostrará:
- ✅ Checkout do código
- ✅ Setup Node.js
- ✅ Install dependencies
- ✅ Test service startup
- ✅ Deploy to VPS
- ✅ Health check
- ✅ Service metrics

---

## 🔧 Path na VPS

O serviço está localizado em:
```
/var/www/apify-actor-service/
```

Gerenciado por PM2 com o nome: `apify-actor-cloud`

---

## ⚠️ Segurança

- **NUNCA** commite as chaves SSH no repositório
- Os secrets são criptografados pelo GitHub
- Apenas colaboradores com permissão de escrita podem ver/editar secrets
- Use chaves SSH dedicadas para CI/CD (não sua chave pessoal principal)

---

## 🐛 Troubleshooting

### Deploy falha com "Permission denied"
→ Verifique se a chave SSH está correta no secret `VPS_SSH_KEY`

### Health check falha (HTTP status != 200)
→ Verifique os logs do PM2 na VPS:
```bash
ssh root@31.97.131.161
pm2 logs apify-actor-cloud --lines 100
```

### Deploy não é acionado
→ Verifique se há mudanças em arquivos que não estão em `paths-ignore` no workflow
