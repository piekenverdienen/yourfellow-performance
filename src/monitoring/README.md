# GA4 Anomaly Monitoring Service

Automatische monitoring van Google Analytics 4 data met anomaly detection en ClickUp alerts.

## Features

- **Dagelijkse monitoring** van GA4 metrics (sessions, users, engagement, conversions, revenue)
- **Anomaly detection** met configureerbare drempels (WARNING ±20%, CRITICAL ±40%)
- **Zero-value alerts** voor kritieke metrics (sessions, conversions, revenue)
- **ClickUp integratie** voor automatische taak-aanmaak bij afwijkingen
- **Idempotent** - geen duplicate alerts per dag
- **Multi-client** ondersteuning met per-client configuratie
- **Dry-run mode** voor testen zonder ClickUp tasks

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Google Analytics 4 property met Data API toegang
- ClickUp account met API token

### 2. Setup Google Analytics

1. Maak een [Google Cloud service account](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Enable de [GA4 Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)
3. Download de JSON key
4. Voeg het service account email toe als viewer in je GA4 property (Admin > Property Access Management)

### 3. Setup ClickUp

1. Ga naar [ClickUp App Settings](https://app.clickup.com/settings/apps)
2. Genereer een Personal API Token
3. Noteer de List ID waar alerts moeten komen (URL: `app.clickup.com/[workspace]/v/li/[LIST_ID]`)

### 4. Configuratie

```bash
# Kopieer de voorbeeld config
cp config/monitoring.example.json config/monitoring.json
```

Edit `config/monitoring.json`:

```json
{
  "global": {
    "defaultThresholds": {
      "warning": 20,
      "critical": 40,
      "minBaseline": 20
    },
    "baselineWindowDays": 7,
    "minDaysForPercentageAlerts": 3
  },
  "clients": [
    {
      "id": "client-example",
      "name": "Example Client",
      "ga4PropertyId": "123456789",
      "timezone": "Europe/Amsterdam",
      "metrics": {
        "sessions": true,
        "totalUsers": true,
        "engagementRate": true,
        "conversions": true,
        "purchaseRevenue": false
      },
      "keyEventName": "purchase",
      "clickup": {
        "listId": "your-list-id",
        "assigneeId": "optional-user-id"
      }
    }
  ]
}
```

### 5. Environment Variables

```bash
# In .env.local
GA4_CREDENTIALS='{"type":"service_account",...}'  # Hele JSON key
CLICKUP_TOKEN=pk_xxxxx
STORE_PATH=./data/fingerprints.json
DRY_RUN=false
LOG_LEVEL=info
```

### 6. Run

```bash
# Dry run (geen ClickUp tasks)
npx ts-node src/monitoring/run.ts --dry-run

# Productie run
npx ts-node src/monitoring/run.ts --config ./config/monitoring.json
```

## Configuration Reference

### Global Config

| Parameter | Default | Description |
|-----------|---------|-------------|
| `defaultThresholds.warning` | 20 | % afwijking voor WARNING |
| `defaultThresholds.critical` | 40 | % afwijking voor CRITICAL |
| `defaultThresholds.minBaseline` | 20 | Minimum baseline voor % alerts |
| `baselineWindowDays` | 7 | Dagen voor rolling average |
| `minDaysForPercentageAlerts` | 3 | Minimum dagen data vereist |

### Client Config

| Parameter | Required | Description |
|-----------|----------|-------------|
| `id` | ✅ | Unieke client identifier |
| `name` | ✅ | Display naam |
| `ga4PropertyId` | ✅ | GA4 property ID (numeriek) |
| `timezone` | ❌ | Default: Europe/Amsterdam |
| `metrics.sessions` | ❌ | Monitor sessions (default: true) |
| `metrics.totalUsers` | ❌ | Monitor users (default: true) |
| `metrics.engagementRate` | ❌ | Monitor engagement (default: true) |
| `metrics.conversions` | ❌ | Monitor conversions (default: false) |
| `metrics.purchaseRevenue` | ❌ | Monitor revenue (default: false) |
| `keyEventName` | * | Vereist als conversions=true |
| `thresholds` | ❌ | Override per-metric thresholds |
| `clickup.listId` | ✅ | ClickUp list voor alerts |
| `clickup.assigneeId` | ❌ | Auto-assign aan user |
| `clickup.tags` | ❌ | Extra tags voor tasks |

## Alert Rules

### Percentage Afwijkingen

| Severity | Trigger |
|----------|---------|
| WARNING | ≥20% afwijking van 7-dagen baseline |
| CRITICAL | ≥40% afwijking van 7-dagen baseline |

### Zero-Value Alerts (altijd CRITICAL)

- `sessions = 0` terwijl baseline > 0
- `conversions = 0` terwijl baseline > 0
- `purchaseRevenue = 0` terwijl baseline > 0

### Guardrails

- Geen alerts als baseline < minBaseline (default: 20)
- Geen % alerts als < 3 dagen data beschikbaar
- Zero-value alerts werken altijd (ook bij weinig data)

## ClickUp Task Format

```
🚨 [CRITICAL] Client Name – sessions afwijking (2024-01-15)

## Samenvatting
| Klant | Client Name |
| Datum | 2024-01-15 |
| Metric | sessions |
| Ernst | CRITICAL |

## Metingen
| Baseline (7d avg) | 1.234 |
| Actual (gisteren) | 567 |
| Verschil | 📉 -54.0% |

## Snelle diagnose
Significante daling in sessies. Check recente campagne-wijzigingen...

## Aanbevolen checks
- [ ] Analyseer traffic bronnen in GA4
- [ ] Check Google Search Console
- [ ] Review actieve campagnes
...
```

## Scheduling

### Cron (Linux/Mac)

```bash
# Dagelijks om 08:00
0 8 * * * cd /path/to/project && npx ts-node src/monitoring/run.ts >> /var/log/ga4-monitoring.log 2>&1
```

### GitHub Actions

```yaml
name: GA4 Monitoring
on:
  schedule:
    - cron: '0 7 * * *'  # 08:00 CET
jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx ts-node src/monitoring/run.ts
        env:
          GA4_CREDENTIALS: ${{ secrets.GA4_CREDENTIALS }}
          CLICKUP_TOKEN: ${{ secrets.CLICKUP_TOKEN }}
```

## Development

### Run Tests

```bash
npm test -- src/monitoring
```

### Project Structure

```
src/monitoring/
├── config/          # Config schema & loader
├── ga4/             # GA4 Data API client
├── evaluator/       # Anomaly detection logic
├── clickup/         # ClickUp API client
├── store/           # Fingerprint store (idempotency)
├── utils/           # Logger
├── index.ts         # Main orchestrator
└── run.ts           # CLI entry point
```

## Troubleshooting

### "GA4_CREDENTIALS is required"

Zorg dat de volledige JSON key als string in de env var staat (niet als bestandspad).

### "Permission denied" op GA4

Voeg het service account email toe als viewer in GA4: Admin > Property Access Management.

### Duplicate alerts

Fingerprints worden opgeslagen in `STORE_PATH`. Delete dit bestand om opnieuw te beginnen.

### Rate limiting

De service batcht requests en heeft retry logic. Bij persistent rate limiting, verhoog `retryDelayMs` in config.
