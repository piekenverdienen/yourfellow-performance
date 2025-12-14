# Deployment Guide - performance.yourfellow.nl

Complete handleiding voor het deployen van YourFellow Performance naar productie.

## Quick Start

```bash
# 1. Push naar GitHub
git push origin main

# 2. Deploy via Vercel CLI (optioneel)
npx vercel --prod
```

## Stap-voor-stap Deployment

### 1. GitHub Repository

Zorg dat de code op GitHub staat:
```bash
git remote add origin https://github.com/piekenverdienen/yourfellow-performance.git
git push -u origin main
```

### 2. Vercel Project Setup

1. Ga naar [vercel.com/new](https://vercel.com/new)
2. Importeer de GitHub repository `piekenverdienen/yourfellow-performance`
3. Vercel detecteert automatisch Next.js
4. Klik "Deploy" (eerste deployment kan nog zonder env vars)

### 3. Environment Variables in Vercel

Ga naar **Project Settings > Environment Variables** en voeg toe:

| Variable | Type | Voorbeeld |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Plain | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sensitive | `eyJ...` |
| `ANTHROPIC_API_KEY` | Sensitive | `sk-ant-api03-...` |
| `OPENAI_API_KEY` | Sensitive | `sk-...` (voor DALL-E) |
| `NEXT_PUBLIC_APP_URL` | Plain | `https://performance.yourfellow.nl` |

> **Tip:** Gebruik Vercel's "Sensitive" type voor API keys - deze worden versleuteld opgeslagen.

### 4. Custom Domain: performance.yourfellow.nl

#### In Vercel:
1. Ga naar **Project Settings > Domains**
2. Voeg toe: `performance.yourfellow.nl`
3. Vercel toont de benodigde DNS records

#### DNS Configuratie (bij je domein provider):

Voeg een **CNAME record** toe:

```
Type:   CNAME
Name:   performance
Value:  cname.vercel-dns.com
TTL:    300 (of Auto)
```

> **Let op:** DNS propagatie kan tot 48 uur duren, maar is meestal binnen 5-30 minuten actief.

#### Verificatie:
```bash
# Check of DNS correct is ingesteld
dig performance.yourfellow.nl CNAME

# Of via nslookup
nslookup performance.yourfellow.nl
```

### 5. SSL Certificaat

Vercel regelt automatisch een SSL certificaat via Let's Encrypt zodra:
- DNS correct is geconfigureerd
- Het domein wijst naar Vercel

Geen handmatige actie nodig.

## Supabase Productie Setup

### 1. Nieuw Supabase Project (aanbevolen)

Maak een apart productie project aan op [supabase.com](https://supabase.com):

1. Kies regio: **Frankfurt (eu-central-1)** - dichtst bij Nederland
2. Stel een sterk database wachtwoord in
3. Bewaar de API keys veilig

### 2. Database Schema

Voer de SQL scripts uit in de SQL Editor:

```bash
# Volgorde:
1. supabase-setup.sql          # Basis tabellen
2. supabase-chat-setup.sql     # Chat functionaliteit
3. supabase-workflows.sql      # Workflow builder
```

### 3. Authentication

Configureer in **Authentication > URL Configuration**:

```
Site URL:           https://performance.yourfellow.nl
Redirect URLs:      https://performance.yourfellow.nl/**
```

## Post-Deployment Checklist

- [ ] Site laadt correct op https://performance.yourfellow.nl
- [ ] SSL certificaat is actief (geen browser waarschuwingen)
- [ ] Login/registratie werkt
- [ ] AI generatie werkt (test met een simpele prompt)
- [ ] Supabase connectie stabiel

## Troubleshooting

### "DNS not configured"
- Wacht 5-30 minuten na DNS wijziging
- Controleer of CNAME correct is: `dig performance.yourfellow.nl CNAME`

### "500 Internal Server Error"
- Check Vercel logs: **Project > Deployments > [deployment] > Functions**
- Meestal missende environment variables

### "Supabase connection failed"
- Controleer of IP niet geblokkeerd is in Supabase
- Verifieer dat de URL en anon key correct zijn

### Rebuild forceren
```bash
# Via Vercel CLI
npx vercel --prod --force

# Of via dashboard: Deployments > Redeploy
```

## Monitoring

### Vercel Analytics
Activeer in **Project Settings > Analytics** voor:
- Page views
- Web Vitals (LCP, FID, CLS)
- Geografische data

### Error Tracking (optioneel)
Overweeg Sentry integratie voor productie error tracking.

## Kosten Indicatie

| Service | Free Tier | Geschatte kosten |
|---------|-----------|------------------|
| Vercel | 100GB bandwidth/maand | Gratis voor klein team |
| Supabase | 500MB database | Gratis tot ~10k requests/dag |
| Anthropic | Pay-per-use | ~$3/1M tokens (Claude Haiku) |
| OpenAI | Pay-per-use | ~$0.04/image (DALL-E 3) |

## Vragen?

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
