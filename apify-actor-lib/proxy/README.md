# 🔒 Sistema Modular de Proxy - Apify Actor

Sistema plugável de proxy que permite trocar facilmente entre diferentes provedores ou rodar sem proxy.

---

## 🎯 Features

- ✅ **Modular**: Adicione novos provedores facilmente
- ✅ **Plugável**: Troque de provedor com 1 variável de ambiente
- ✅ **Sem proxy**: Rode sem proxy quando não precisar
- ✅ **Estatísticas**: Tracking automático de uso e custo
- ✅ **Type-safe**: Interface base garante consistência

---

## 🚀 Uso Rápido

### 1. Configurar variável de ambiente

```bash
# No arquivo .env
PROXY_PROVIDER=none  # 'none' | 'iproyal' | 'zyte'
```

### 2. Rodar o actor

```bash
cd apify-actor
npm start
```

O sistema **detecta automaticamente** qual proxy usar e configura tudo!

---

## 📋 Provedores Disponíveis

### 1. **NoProxy** (Padrão)

Conexão direta sem proxy.

**Quando usar:**
- Desenvolvimento local
- Sites que não bloqueiam
- Testes rápidos

**Configuração:**
```env
PROXY_PROVIDER=none
```

**Custo:** $0/mês

---

### 2. **IPRoyal**

Proxies residenciais com 32M IPs.

**Quando usar:**
- Sites simples (HTML estático)
- Orçamento limitado
- Controle total sobre proxy

**Configuração:**
```env
PROXY_PROVIDER=iproyal
IPROYAL_ENABLED=true
IPROYAL_SERVER=geo.iproyal.com:32325
IPROYAL_USERNAME=customer-YOUR_USERNAME
IPROYAL_PASSWORD=your_password
IPROYAL_ROTATION=true
IPROYAL_SESSION_DURATION=600000
IPROYAL_PRICE_PER_GB=1.75
```

**Custo:** $1.75-$7/GB (~$17.50/mês com 50% OFF)

**Links:**
- Criar conta: https://iproyal.com/
- Código de desconto: **IPR50** (50% OFF por 9 meses)

---

### 3. **Zyte Smart Proxy Manager**

Proxy inteligente com AI, CAPTCHA bypass automático.

**Quando usar:**
- Sites com CAPTCHA (NYT, BBC)
- Sites com JS pesado (SPAs)
- Geo-blocking
- Máxima taxa de sucesso

**Configuração:**
```env
PROXY_PROVIDER=zyte
ZYTE_ENABLED=true
ZYTE_API_KEY=your_zyte_api_key_here
ZYTE_STATIC_BYPASS=true
ZYTE_PROFILE=desktop
ZYTE_DEFAULT_TIER=1
ZYTE_DEFAULT_REQUEST_TYPE=http
```

**Dependências adicionais:**
```bash
npm install playwright-extra zyte-smartproxy-plugin \
  puppeteer-extra-plugin-stealth @cliqz/adblocker-playwright
```

**Custo:** $0.06-$15.98/1000 requests (~$1-50/mês)

**Links:**
- Criar conta: https://app.zyte.com/o/signup ($5 free)
- Docs: https://docs.zyte.com/zyte-api/
- GitHub: https://github.com/zytedata/zyte-smartproxy-plugin

---

## 🔧 Exemplos de Uso

### Exemplo 1: Sem proxy (desenvolvimento)

```bash
# .env
PROXY_PROVIDER=none

# Rodar
npm start
```

**Output:**
```
🔒 Proxy Configuration:
   Provider: NoProxy
   Enabled: true
   Valid: true
   Config: { mode: 'direct', cost: '$0.00/mês' }
```

---

### Exemplo 2: IPRoyal (produção simples)

```bash
# .env
PROXY_PROVIDER=iproyal
IPROYAL_ENABLED=true
IPROYAL_SERVER=geo.iproyal.com:32325
IPROYAL_USERNAME=customer-myuser
IPROYAL_PASSWORD=mypass123
IPROYAL_ROTATION=true

# Rodar
npm start
```

**Output:**
```
🔒 Proxy Configuration:
   Provider: IPRoyal
   Enabled: true
   Valid: true
   Config: {
     server: 'geo.iproyal.com:32325',
     username: 'customer-***',
     rotation: true,
     sessionDuration: '600s',
     pricePerGB: '$1.75/GB'
   }

📊 Proxy Usage Statistics:
{
  "provider": "IPRoyal",
  "totalRequests": 50,
  "successfulRequests": 48,
  "successRate": "96.00%",
  "totalBandwidthGB": "0.120",
  "estimatedCost": "$0.2100"
}
```

---

### Exemplo 3: Zyte (sites complexos)

```bash
# .env
PROXY_PROVIDER=zyte
ZYTE_ENABLED=true
ZYTE_API_KEY=your_key_here
ZYTE_STATIC_BYPASS=true

# Rodar
npm start
```

**Output:**
```
🔒 Proxy Configuration:
   Provider: Zyte
   Enabled: true
   Valid: true
   Config: {
     apiKey: 'abc123...',
     staticBypass: true,
     profile: 'desktop',
     pluginLoaded: true
   }

✅ [Zyte] Smart Proxy plugin configurado
   - API Key: abc123...
   - Static Bypass: true
   - Profile: desktop

📊 Proxy Usage Statistics:
{
  "provider": "Zyte",
  "totalRequests": 50,
  "successfulRequests": 50,
  "successRate": "100.00%",
  "estimatedCost": "$0.0065",
  "zyteInfo": {
    "pluginLoaded": true,
    "estimatedRequests": 50,
    "avgCostPerRequest": "$0.000130"
  }
}
```

---

## 🔀 Trocar de Provedor

É super simples! Apenas **mude 1 variável**:

```bash
# De NoProxy para IPRoyal
PROXY_PROVIDER=iproyal  # ← Só isso!

# De IPRoyal para Zyte
PROXY_PROVIDER=zyte  # ← Só isso!

# Voltar para NoProxy
PROXY_PROVIDER=none  # ← Só isso!
```

**Sem precisar mudar código!** 🎉

---

## 📊 Comparação de Provedores

| Critério | NoProxy | IPRoyal | Zyte |
|----------|---------|---------|------|
| **Custo/mês** | $0 | $8.75-35 | $1-50 |
| **Setup** | 0 linhas | 5 variáveis | 5 variáveis + npm |
| **CAPTCHA bypass** | ❌ | ❌ | ✅ Automático |
| **Rotação** | N/A | ✅ Manual | ✅ AI |
| **Taxa de sucesso** | 60-80% | 85-95% | 95-99% |
| **Ideal para** | Dev/Testes | Sites simples | Sites complexos |

---

## 🏗️ Arquitetura

```
apify-actor/proxy/
├── base-provider.js           # Interface abstrata
├── no-proxy-provider.js       # Sem proxy
├── iproyal-provider.js        # IPRoyal
├── zyte-provider.js           # Zyte
├── proxy-factory.js           # Seletor automático
├── index.js                   # Export central
└── README.md                  # Este arquivo
```

### Fluxo:

```
main.js
   │
   ├─ setupProxy(chromium)
   │     │
   │     ├─ ProxyFactory.getProvider()
   │     │     │
   │     │     ├─ Lê PROXY_PROVIDER do .env
   │     │     ├─ Cria instância do provedor
   │     │     └─ Valida configuração
   │     │
   │     ├─ provider.setupLauncher(chromium)
   │     │     └─ Configura launcher (Zyte modifica, outros não)
   │     │
   │     └─ provider.getPlaywrightConfig()
   │           └─ Retorna config de proxy (IPRoyal) ou null (Zyte/None)
   │
   └─ PlaywrightCrawler({
         launcher: configuredChromium,
         launchOptions: { proxy: proxyConfig }
      })
```

---

## 🆕 Adicionar Novo Provedor

Quer adicionar um novo provedor (Bright Data, Smartproxy, etc)?

### 1. Criar classe que estende `BaseProxyProvider`

```javascript
// apify-actor/proxy/brightdata-provider.js

import { BaseProxyProvider } from './base-provider.js';

export class BrightDataProxyProvider extends BaseProxyProvider {
  constructor(config = {}) {
    super('BrightData', config);

    this.apiKey = config.apiKey || process.env.BRIGHTDATA_API_KEY;
    this.enabled = config.enabled ?? (process.env.BRIGHTDATA_ENABLED === 'true');
  }

  getPlaywrightConfig() {
    if (!this.enabled || !this.apiKey) return null;

    return {
      server: `http://brd.superproxy.io:22225`,
      username: `brd-customer-${this.apiKey}`,
      password: this.apiKey
    };
  }

  calculateCost(estimatedMB, metadata = {}) {
    // $10.5/GB
    return (estimatedMB / 1024) * 10.5;
  }

  isValid() {
    return this.enabled && !!this.apiKey;
  }

  sanitizeConfig() {
    return {
      apiKey: this.apiKey ? '***configured***' : 'not set',
      server: 'brd.superproxy.io:22225'
    };
  }
}
```

### 2. Registrar na Factory

```javascript
// apify-actor/proxy/proxy-factory.js

import { BrightDataProxyProvider } from './brightdata-provider.js';

// No método registerProviders():
this.providers.set('brightdata', new BrightDataProxyProvider({
  enabled: process.env.BRIGHTDATA_ENABLED === 'true',
  apiKey: process.env.BRIGHTDATA_API_KEY
}));
```

### 3. Usar!

```bash
# .env
PROXY_PROVIDER=brightdata
BRIGHTDATA_ENABLED=true
BRIGHTDATA_API_KEY=your_key_here
```

**Pronto!** 🎉

---

## 📝 Variáveis de Ambiente

### Globais

| Variável | Opções | Padrão | Descrição |
|----------|--------|--------|-----------|
| `PROXY_PROVIDER` | `none`, `iproyal`, `zyte` | `none` | Qual provedor usar |

### IPRoyal

| Variável | Tipo | Padrão | Descrição |
|----------|------|--------|-----------|
| `IPROYAL_ENABLED` | boolean | `false` | Habilitar IPRoyal |
| `IPROYAL_SERVER` | string | `geo.iproyal.com:32325` | Servidor proxy |
| `IPROYAL_USERNAME` | string | - | Username (formato: `customer-USER`) |
| `IPROYAL_PASSWORD` | string | - | Senha |
| `IPROYAL_ROTATION` | boolean | `true` | Rotação de sessão |
| `IPROYAL_SESSION_DURATION` | number | `600000` | Duração da sessão (ms) |
| `IPROYAL_PRICE_PER_GB` | number | `1.75` | Preço por GB (para custo estimado) |

### Zyte

| Variável | Tipo | Padrão | Descrição |
|----------|------|--------|-----------|
| `ZYTE_ENABLED` | boolean | `false` | Habilitar Zyte |
| `ZYTE_API_KEY` | string | - | API key do Zyte |
| `ZYTE_STATIC_BYPASS` | boolean | `true` | Bypass para assets estáticos |
| `ZYTE_PROFILE` | string | `desktop` | Perfil (`desktop` ou `mobile`) |
| `ZYTE_DEFAULT_TIER` | number | `1` | Tier padrão (1-5) |
| `ZYTE_DEFAULT_REQUEST_TYPE` | string | `http` | Tipo (`http` ou `browser`) |

---

## 🐛 Troubleshooting

### Problema: "Provider não encontrado"

**Erro:**
```
⚠️  Proxy provider "iproyyal" não encontrado, usando NoProxy
```

**Solução:**
Verifique o nome do provider (typo):
```bash
PROXY_PROVIDER=iproyal  # Correto (sem typo)
```

---

### Problema: "Provider inválido, usando NoProxy"

**Erro:**
```
⚠️  IPRoyal server não configurado (IPROYAL_SERVER), usando NoProxy
```

**Solução:**
Configure todas as variáveis obrigatórias:
```bash
IPROYAL_ENABLED=true
IPROYAL_SERVER=geo.iproyal.com:32325
IPROYAL_USERNAME=customer-myuser
IPROYAL_PASSWORD=mypassword
```

---

### Problema: Zyte plugin não carrega

**Erro:**
```
❌ [Zyte] Erro ao carregar plugin: Cannot find module 'zyte-smartproxy-plugin'
```

**Solução:**
Instale as dependências do Zyte:
```bash
cd apify-actor
npm install playwright-extra zyte-smartproxy-plugin \
  puppeteer-extra-plugin-stealth @cliqz/adblocker-playwright
```

---

### Problema: Custo estimado está errado

O custo é **estimado** baseado em:
- IPRoyal: `estimatedMB × IPROYAL_PRICE_PER_GB`
- Zyte: `requests × tier_price`

Para precisão, use:
- IPRoyal: Dashboard oficial
- Zyte: https://app.zyte.com/o/billing

---

## 📚 Links Úteis

### Documentação
- Comparação Zyte vs IPRoyal: `/docs/PROXY_COMPARISON_ZYTE_VS_IPROYAL.md`
- Arquitetura do sistema: Este README

### IPRoyal
- Site: https://iproyal.com/
- Pricing: https://iproyal.com/pricing/residential-proxies/
- Código desconto: **IPR50** (50% OFF)

### Zyte
- Site: https://www.zyte.com/
- Docs: https://docs.zyte.com/
- Pricing: https://www.zyte.com/pricing/
- Plugin GitHub: https://github.com/zytedata/zyte-smartproxy-plugin
- Signup ($5 free): https://app.zyte.com/o/signup

---

## ✅ Checklist de Setup

### NoProxy (Desenvolvimento)
- [ ] Configurar `PROXY_PROVIDER=none`
- [ ] Rodar `npm start`
- [ ] Verificar logs mostram "NoProxy"

### IPRoyal (Produção simples)
- [ ] Criar conta em https://iproyal.com/
- [ ] Usar código **IPR50** para 50% OFF
- [ ] Obter credenciais (server, username, password)
- [ ] Configurar variáveis `IPROYAL_*` no `.env`
- [ ] Configurar `PROXY_PROVIDER=iproyal`
- [ ] Rodar e verificar stats de custo

### Zyte (Produção complexa)
- [ ] Criar conta em https://app.zyte.com/o/signup
- [ ] Obter API key
- [ ] Instalar dependências extras (`playwright-extra`, `zyte-smartproxy-plugin`)
- [ ] Configurar variáveis `ZYTE_*` no `.env`
- [ ] Configurar `PROXY_PROVIDER=zyte`
- [ ] Verificar plugin carregou corretamente

---

**🎉 Sistema modular de proxy implementado!**

Troque de provedor com 1 variável, sem mudanças no código!
