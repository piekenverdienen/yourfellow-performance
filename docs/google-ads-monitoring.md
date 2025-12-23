# Google Ads Monitoring

## Overview

Dit document beschrijft de Google Ads monitoring integratie voor YourFellow Performance. De monitoring detecteert fundamentele issues in Google Ads accounts en toont deze als Critical Alerts op de homepage en in het alerts-dashboard.

## Scope: Laag 1 (Fundamentals)

De huidige implementatie richt zich op fundamentele issues:
- **Geen** performance optimalisatie (ROAS, CPA)
- **Geen** bidding logica
- **Geen** automatische fixes
- **Geen** workflow builder

## Connection Status

Per klant wordt de Google Ads connectie status bijgehouden:

| Status | Betekenis | Monitoring Actief |
|--------|-----------|-------------------|
| `connected` | OAuth voltooid, customer_id geverifieerd | Ja |
| `pending` | OAuth gestart, wacht op verificatie | Nee |
| `not_connected` | Geen Google Ads koppeling | Nee |

### UI Gedrag per Status

- **not_connected**: Toon CTA "Koppel Google Ads"
- **pending**: Toon "Monitoring wordt geactiveerd..."
- **connected**: Checks actief, alerts worden gegenereerd

## Actieve Checks

### Check 1: Afgekeurde Advertenties (Disapproved Ads)

**Prioriteit**: Hoogste impact, duidelijk, policy-gedreven

**Doel**: Detecteer advertenties die zijn afgekeurd door Google

**GAQL Query**:
```sql
SELECT
  ad_group_ad.ad.id,
  ad_group_ad.ad.name,
  ad_group.name,
  campaign.name,
  ad_group_ad.policy_summary.approval_status,
  ad_group_ad.policy_summary.policy_topic_entries
FROM ad_group_ad
WHERE ad_group_ad.policy_summary.approval_status != 'APPROVED'
  AND ad_group_ad.policy_summary.approval_status != 'APPROVED_LIMITED'
```

**Alert Output**:
```json
{
  "type": "fundamental",
  "channel": "google_ads",
  "severity": "high",
  "title": "Google Ads: advertenties afgekeurd",
  "short_description": "3 advertenties afgekeurd",
  "impact": "Campagnes leveren momenteel niet",
  "suggested_actions": [
    "Controleer policy topics in Google Ads",
    "Pas advertentietekst aan",
    "Dien advertenties opnieuw in ter review"
  ]
}
```

### Check 2: Campagnes Actief Maar Geen Delivery

**Doel**: Detecteer campagnes die "aan" staan maar geen impressies genereren

**Criteria**:
- Campaign status = ENABLED
- Impressions = 0 (laatste 24 uur)
- Campagne > 24 uur actief

**GAQL Query**:
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.start_date,
  metrics.impressions
FROM campaign
WHERE campaign.status = 'ENABLED'
  AND segments.date DURING YESTERDAY
```

**Alert Output**:
```json
{
  "type": "fundamental",
  "channel": "google_ads",
  "severity": "high",
  "title": "Google Ads: campagnes zonder impressies",
  "short_description": "2 campagnes actief maar geen delivery",
  "impact": "Budget wordt niet besteed, geen bereik",
  "suggested_actions": [
    "Controleer campagne-instellingen",
    "Check biedingen en budget",
    "Controleer targeting en ad groep status"
  ]
}
```

## Database Schema

### Google Ads Connection (per client)

Opgeslagen in `clients.settings.googleAds`:

```typescript
interface GoogleAdsSettings {
  // Connection
  status: 'connected' | 'pending' | 'not_connected';
  customerId?: string;          // Google Ads Customer ID (xxx-xxx-xxxx)
  loginCustomerId?: string;     // MCC account ID (indien van toepassing)
  refreshToken?: string;        // OAuth refresh token (encrypted)
  lastVerifiedAt?: string;      // ISO timestamp

  // Monitoring
  monitoringEnabled?: boolean;
  checkInterval?: number;       // Default: 30 minuten

  // Thresholds
  thresholds?: {
    noDeliveryHours?: number;   // Default: 24 uur
  };
}
```

### Alerts Table

Alerts worden opgeslagen in de `alerts` tabel:

```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Alert identification
  type VARCHAR(50) NOT NULL,           -- 'fundamental', 'performance', etc.
  channel VARCHAR(50) NOT NULL,        -- 'google_ads', 'meta', 'website', etc.
  check_id VARCHAR(100) NOT NULL,      -- 'disapproved_ads', 'no_delivery', etc.

  -- Severity & Status
  severity VARCHAR(20) NOT NULL,       -- 'critical', 'high', 'medium', 'low'
  status VARCHAR(20) DEFAULT 'open',   -- 'open', 'acknowledged', 'resolved'

  -- Content
  title VARCHAR(255) NOT NULL,
  short_description TEXT,
  impact TEXT,
  suggested_actions JSONB,             -- Array of action strings
  details JSONB,                        -- Check-specific details

  -- Deduplication
  fingerprint VARCHAR(255) NOT NULL,   -- client_id + check_id + date

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, fingerprint)
);

CREATE INDEX idx_alerts_client_status ON alerts(client_id, status);
CREATE INDEX idx_alerts_channel ON alerts(channel);
CREATE INDEX idx_alerts_severity ON alerts(severity);
```

## API Endpoints

### Homepage: Critical Issues Summary

```
GET /api/alerts/summary
```

**Query Parameters**:
- `client_id` (optional): Filter op specifieke klant

**Filter toegepast**:
- type = 'fundamental'
- severity IN ('critical', 'high')
- status = 'open'

**Response**:
```json
{
  "total_critical": 5,
  "by_channel": {
    "google_ads": {
      "count": 3,
      "items": [
        {
          "id": "uuid",
          "title": "Advertenties afgekeurd",
          "short_description": "3 advertenties afgekeurd",
          "severity": "high",
          "check_id": "disapproved_ads",
          "detected_at": "2024-01-15T10:30:00Z"
        }
      ]
    },
    "meta": { "count": 2, "items": [...] }
  }
}
```

### Alerts Overview

```
GET /api/alerts
```

**Query Parameters**:
- `client_id` (optional)
- `channel` (optional): 'google_ads', 'meta', 'website', 'tracking'
- `type` (optional): 'fundamental', 'performance'
- `status` (optional): 'open', 'acknowledged', 'resolved'
- `severity` (optional): 'critical', 'high', 'medium', 'low'

**Response**:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "type": "fundamental",
      "channel": "google_ads",
      "check_id": "disapproved_ads",
      "severity": "high",
      "status": "open",
      "title": "Google Ads: advertenties afgekeurd",
      "short_description": "3 advertenties afgekeurd",
      "impact": "Campagnes leveren momenteel niet",
      "suggested_actions": ["..."],
      "details": {
        "disapproved_count": 3,
        "policy_topics": ["MISLEADING_CLAIMS", "HEALTH_IN_DANGEROUS_ACTS"]
      },
      "detected_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "per_page": 20
  }
}
```

### Update Alert Status

```
PATCH /api/alerts/:id
```

**Request Body**:
```json
{
  "status": "acknowledged" | "resolved"
}
```

## Check Architecture

Alle Google Ads checks leven in:
```
/src/monitoring/checks/google_ads/
  ├── index.ts              # Check registry
  ├── base-check.ts         # Base class
  ├── disapproved-ads.ts    # Check 1
  └── no-delivery.ts        # Check 2
```

### Check Interface

```typescript
interface GoogleAdsCheck {
  id: string;
  name: string;
  description: string;

  run(client: GoogleAdsClient, clientConfig: ClientConfig): Promise<CheckResult>;
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  count: number;
  platform: 'google_ads';
  details: Record<string, unknown>;
  alertData?: AlertData;
}

interface AlertData {
  title: string;
  short_description: string;
  impact: string;
  suggested_actions: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}
```

## Scheduler

Google Ads monitoring draait op een interval van 30 minuten:

```typescript
// Cron job: elke 30 minuten
// 0,30 * * * *

async function runGoogleAdsMonitoring() {
  const clients = await getConnectedClients();

  for (const client of clients) {
    try {
      await runChecksForClient(client);
    } catch (error) {
      // Log intern, GEEN alert voor klant
      logger.error(`Monitoring failed for ${client.name}`, error);
    }
  }
}
```

## Chat Integration

In chat-context worden actieve Google Ads alerts toegevoegd als samenvatting:

```typescript
interface ChatContext {
  // ... existing context
  activeAlerts?: {
    google_ads?: {
      critical_count: number;
      high_count: number;
      summary: string; // "2 kritieke issues: 3 afgekeurde advertenties"
    };
  };
}
```

De chat kan dan:
- Issues uitleggen
- Acties voorstellen
- Context behouden over de alerts

## Environment Variables

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-oauth-client-id
GOOGLE_ADS_CLIENT_SECRET=your-oauth-client-secret

# Optioneel: MCC account voor agency access
GOOGLE_ADS_LOGIN_CUSTOMER_ID=xxx-xxx-xxxx
```

## OAuth Flow

1. User klikt "Koppel Google Ads"
2. Redirect naar Google OAuth consent screen
3. User authoriseert toegang (read-only)
4. Callback ontvangt authorization code
5. Server wisselt code voor refresh token
6. Refresh token wordt encrypted opgeslagen
7. Status wordt `pending` → verificatie van customer_id
8. Bij succes: status wordt `connected`

## Toekomstige Uitbreidingen (niet in scope)

- Performance alerts (ROAS, CPA drops)
- Budget pacing alerts
- Search term rapport anomalies
- Competitor bidding detection
- Automatische fixes (MCC alleen)
