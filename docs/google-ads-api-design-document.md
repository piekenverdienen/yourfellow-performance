# Google Ads API Tool Design Document

**Company:** YourFellow
**Tool Name:** YourFellow Performance
**Version:** 1.0
**Date:** January 2026
**Contact:** paul@yourfellow.nl

---

## 1. Executive Summary

YourFellow Performance is an internal marketing platform developed by YourFellow, a digital marketing agency based in the Netherlands. The platform integrates with the Google Ads API to provide automated monitoring, reporting, and optimization insights for our agency team and clients.

**Primary Use Cases:**
- Real-time campaign performance monitoring
- Automated anomaly detection and alerting
- Client-facing performance dashboards
- Historical reporting and trend analysis

---

## 2. Company Background

**Company Name:** YourFellow
**Website:** https://yourfellow.nl
**Industry:** Digital Marketing Agency
**Location:** Netherlands (EU)

YourFellow is a full-service digital marketing agency managing Google Ads campaigns for SMB clients across various industries including e-commerce, B2B services, and local businesses.

---

## 3. Tool Overview

### 3.1 Purpose

YourFellow Performance serves as a unified marketing dashboard that aggregates data from multiple advertising platforms (Google Ads, Meta Ads) and analytics tools (GA4, Search Console) to provide:

1. **Proactive Monitoring:** Detect issues before they impact performance
2. **Unified Reporting:** Single source of truth for all marketing metrics
3. **Operational Efficiency:** Reduce manual data gathering and reporting time

### 3.2 Target Users

| User Type | Description | Access Level |
|-----------|-------------|--------------|
| Agency Team | Internal marketing specialists | Full platform access |
| Clients | Business owners we manage campaigns for | Read-only dashboards |

### 3.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YourFellow Performance                    │
│                     (Next.js Application)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │   Alerts    │  │     Reporting       │ │
│  │   Module    │  │   Module    │  │      Module         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
│                  ┌───────▼───────┐                         │
│                  │  API Service  │                         │
│                  │     Layer     │                         │
│                  └───────┬───────┘                         │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
      ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
      │  Google   │ │   Meta    │ │  GA4 /    │
      │  Ads API  │ │ Graph API │ │  GSC API  │
      └───────────┘ └───────────┘ └───────────┘
```

---

## 4. Google Ads API Integration

### 4.1 Authentication Method

- **OAuth 2.0** for user authentication
- Tokens stored securely in Supabase with AES-256 encryption
- Refresh tokens used to maintain access
- All API calls made server-side (Next.js API routes)

### 4.2 Account Access Structure

```
YourFellow MCC (Manager Account)
    │
    ├── Client Account A
    ├── Client Account B
    ├── Client Account C
    └── ... (all client accounts linked to MCC)
```

All client accounts are linked to our agency MCC. API calls are made at the MCC level with customer_id specified for individual account access.

### 4.3 API Resources Used

| Resource | Method | Purpose | Frequency |
|----------|--------|---------|-----------|
| `customers` | GET | Retrieve account information | Daily |
| `campaigns` | GET | Fetch campaign data and status | Every 15 min |
| `adGroups` | GET | Fetch ad group performance | Every 15 min |
| `ads` | GET | Fetch ad performance and approval status | Every 15 min |
| `adGroupAds` | GET | Monitor ad disapprovals | Every 15 min |
| `metrics` | GET | Performance metrics (clicks, impressions, cost, conversions) | Every 15 min |
| `conversionActions` | GET | Conversion tracking setup verification | Daily |

### 4.4 GAQL Queries Used

**Campaign Performance Query:**
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status != 'REMOVED'
```

**Disapproved Ads Query:**
```sql
SELECT
  ad_group_ad.ad.id,
  ad_group_ad.ad.name,
  ad_group_ad.policy_summary.approval_status,
  ad_group_ad.policy_summary.policy_topic_entries
FROM ad_group_ad
WHERE ad_group_ad.policy_summary.approval_status = 'DISAPPROVED'
```

**Budget Monitoring Query:**
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign_budget.amount_micros,
  metrics.cost_micros
FROM campaign
WHERE segments.date = TODAY
  AND campaign.status = 'ENABLED'
```

---

## 5. Features & Functionality

### 5.1 Performance Dashboard

**Description:** Real-time overview of all Google Ads accounts and campaigns.

**Data Displayed:**
- Account-level metrics (spend, clicks, conversions, ROAS)
- Campaign status and delivery indicators
- Trend comparisons (vs. previous period)
- Budget utilization percentages

**API Usage:** Read-only GET requests to fetch performance data.

### 5.2 Automated Monitoring & Alerts

**Description:** Continuous monitoring system that detects anomalies and issues.

**Alert Types:**

| Alert | Trigger Condition | Severity |
|-------|-------------------|----------|
| Ad Disapproved | `approval_status = DISAPPROVED` | High |
| Budget Depleted | `cost_micros >= budget_amount_micros * 0.95` | Medium |
| Conversion Drop | Conversions decreased >30% vs. 7-day average | High |
| Impression Drop | Impressions decreased >50% vs. previous day | Medium |
| No Delivery | Campaign enabled but 0 impressions for 24h | Critical |

**Notification Channels:**
- In-app notification center
- Email alerts to account managers
- ClickUp task creation for critical issues

### 5.3 Client Reporting

**Description:** Automated generation of performance reports for clients.

**Report Contents:**
- Executive summary with key metrics
- Campaign-level performance breakdown
- Trend analysis and insights
- Recommendations (human-written)

**Frequency:** Weekly and monthly automated reports.

---

## 6. Data Handling & Security

### 6.1 Data Storage

| Data Type | Storage Location | Retention |
|-----------|------------------|-----------|
| OAuth Tokens | Supabase (encrypted) | Until revoked |
| Performance Metrics | Supabase | 24 months |
| Alert History | Supabase | 12 months |
| Cached API Responses | Redis | 15 minutes |

### 6.2 Security Measures

- **Encryption:** AES-256 for data at rest, TLS 1.3 for data in transit
- **Access Control:** Role-based permissions (owner, admin, editor, viewer)
- **Data Isolation:** Row Level Security (RLS) ensures client data separation
- **Audit Logging:** All data access logged for compliance
- **Infrastructure:** EU-based data centers (GDPR compliant)

### 6.3 Compliance

- GDPR compliant (EU data residency)
- Data Processing Agreements with all clients
- Right to deletion supported
- No data sharing with third parties

---

## 7. API Usage Estimates

### 7.1 Request Volume

| Metric | Estimate |
|--------|----------|
| Client Accounts Managed | 20-50 |
| API Requests per Day | 5,000 - 15,000 |
| Peak Requests per Hour | 1,000 |
| Operations Ratio | 99% read / 1% write |

### 7.2 Request Distribution

- **Monitoring polls:** 70% of requests (automated every 15 min)
- **Dashboard loads:** 20% of requests (user-initiated)
- **Report generation:** 10% of requests (scheduled)

### 7.3 Rate Limiting Strategy

- Respect all Google Ads API rate limits
- Implement exponential backoff on errors
- Cache responses for 15 minutes to reduce duplicate calls
- Batch requests where possible using GAQL

---

## 8. User Interface Mockups

### 8.1 Main Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  YourFellow Performance                      [Client ▼] 👤  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Spend   │ │  Clicks  │ │  Conv.   │ │   ROAS   │       │
│  │ €12,450  │ │  8,234   │ │   156    │ │   4.2x   │       │
│  │  ▲ +12%  │ │  ▲ +8%   │ │  ▲ +15%  │ │  ▲ +0.3  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  Campaigns                                    [+ Filter]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ● Brand Campaign          €2,100   1,234    32      │   │
│  │ ● Shopping - All Products €5,400   4,521    89      │   │
│  │ ● Performance Max         €3,200   1,876    28      │   │
│  │ ○ Display Remarketing     €1,750     603     7      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ Active Alerts (2)                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 Ad disapproved: "Summer Sale 2024" - Policy      │   │
│  │ 🟡 Budget 92% depleted: Shopping campaign           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Alerts Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Alerts                                    [Filter ▼]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Today                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 CRITICAL  Ad Disapproved           10:32 AM      │   │
│  │    Client: Webshop ABC                              │   │
│  │    Ad "Free Shipping" violated policy: Misleading   │   │
│  │    [View Ad] [Acknowledge] [Resolve]                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟡 MEDIUM   Budget Alert              09:15 AM      │   │
│  │    Client: Restaurant XYZ                           │   │
│  │    Daily budget 92% spent by 9 AM                   │   │
│  │    [View Campaign] [Acknowledge]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Development & Maintenance

### 9.1 Development Team

| Role | Responsibility |
|------|----------------|
| Lead Developer | API integration, backend development |
| Frontend Developer | Dashboard UI, data visualization |
| Marketing Team | Feature requirements, testing |

### 9.2 Testing Approach

- Development environment with test MCC account
- Staging environment with limited production data
- All API integrations tested before production deployment

### 9.3 Monitoring & Logging

- API request/response logging for debugging
- Error tracking with automatic alerting
- Performance monitoring for API latency

---

## 10. Contact Information

**Primary Contact:**
Paul
Email: paul@yourfellow.nl
Role: Lead Developer / Owner

**Company:**
YourFellow
Website: https://yourfellow.nl
Location: Netherlands

---

## Appendix A: Sample API Response Handling

```typescript
// Example: Fetching campaign performance
async function getCampaignPerformance(customerId: string) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
    ORDER BY metrics.cost_micros DESC
  `;

  const response = await googleAdsClient.search({
    customer_id: customerId,
    query: query,
  });

  return response.results.map(row => ({
    id: row.campaign.id,
    name: row.campaign.name,
    status: row.campaign.status,
    impressions: row.metrics.impressions,
    clicks: row.metrics.clicks,
    cost: row.metrics.cost_micros / 1_000_000,
    conversions: row.metrics.conversions,
  }));
}
```

---

*Document prepared for Google Ads API Standard Access Application*
