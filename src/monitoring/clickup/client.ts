import { Logger } from '../utils/logger';
import { AlertData, TaskCreationResult, ClickUpTaskRequest, ClickUpTaskResponse } from './types';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export class ClickUpClientError extends Error {
  constructor(message: string, public statusCode?: number, public details?: unknown) {
    super(message);
    this.name = 'ClickUpClientError';
  }
}

interface ClickUpClientOptions {
  token: string;
  logger: Logger;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class ClickUpClient {
  private token: string;
  private logger: Logger;
  private retryAttempts: number;
  private retryDelayMs: number;

  constructor(options: ClickUpClientOptions) {
    this.token = options.token;
    this.logger = options.logger;
    this.retryAttempts = options.retryAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Create a task in ClickUp
   */
  async createTask(
    listId: string,
    alert: AlertData,
    assigneeId?: string,
    tags?: string[]
  ): Promise<TaskCreationResult> {
    const taskRequest = this.buildTaskRequest(alert, assigneeId, tags);

    try {
      const response = await this.executeWithRetry<ClickUpTaskResponse>(
        `${CLICKUP_API_BASE}/list/${listId}/task`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskRequest)
        }
      );

      this.logger.info(`Created ClickUp task: ${response.name}`, {
        taskId: response.id,
        url: response.url
      });

      return {
        success: true,
        taskId: response.id,
        taskUrl: response.url
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to create ClickUp task`, {
        error: err.message,
        alert: { client: alert.clientName, metric: alert.metric }
      });

      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Search for existing task by name in a list
   */
  async findTaskByName(listId: string, taskName: string): Promise<ClickUpTaskResponse | null> {
    try {
      const response = await this.executeWithRetry<{ tasks: ClickUpTaskResponse[] }>(
        `${CLICKUP_API_BASE}/list/${listId}/task?page=0`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.token
          }
        }
      );

      const existingTask = response.tasks.find(t => t.name === taskName);
      return existingTask || null;
    } catch (error) {
      this.logger.warn(`Failed to search for existing tasks`, {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Create an internal error alert
   */
  async createErrorAlert(
    listId: string,
    errorMessage: string,
    context: Record<string, unknown>
  ): Promise<TaskCreationResult> {
    const date = new Date().toISOString().slice(0, 10);
    const taskRequest: ClickUpTaskRequest = {
      name: `⚠️ [MONITORING ERROR] GA4 Monitoring Failed (${date})`,
      description: this.buildErrorDescription(errorMessage, context),
      priority: 2, // High priority
      tags: ['monitoring-error', 'automated']
    };

    try {
      const response = await this.executeWithRetry<ClickUpTaskResponse>(
        `${CLICKUP_API_BASE}/list/${listId}/task`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskRequest)
        }
      );

      return {
        success: true,
        taskId: response.id,
        taskUrl: response.url
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Build task title based on alert data
   */
  buildTaskTitle(alert: AlertData): string {
    const emoji = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
    return `${emoji} [${alert.severity}] ${alert.clientName} – ${alert.metric} afwijking (${alert.date})`;
  }

  /**
   * Build task request from alert data
   */
  private buildTaskRequest(
    alert: AlertData,
    assigneeId?: string,
    tags?: string[]
  ): ClickUpTaskRequest {
    const request: ClickUpTaskRequest = {
      name: this.buildTaskTitle(alert),
      description: this.buildTaskDescription(alert),
      priority: alert.severity === 'CRITICAL' ? 1 : 2,
      tags: [
        'ga4-alert',
        alert.severity.toLowerCase(),
        alert.metric,
        ...(tags || [])
      ]
    };

    if (assigneeId) {
      request.assignees = [assigneeId];
    }

    return request;
  }

  /**
   * Build task description from alert data
   */
  private buildTaskDescription(alert: AlertData): string {
    const directionSymbol = alert.deltaPct > 0 ? '📈' : alert.deltaPct < 0 ? '📉' : '➡️';
    const deltaPctFormatted = `${alert.deltaPct > 0 ? '+' : ''}${alert.deltaPct.toFixed(1)}%`;

    return `## Samenvatting

| | |
|---|---|
| **Klant** | ${alert.clientName} |
| **Datum** | ${alert.date} |
| **Metric** | ${alert.metric} |
| **Ernst** | ${alert.severity} |

---

## Metingen

| | |
|---|---|
| **Baseline (7d avg)** | ${this.formatMetricValue(alert.metric, alert.baseline)} |
| **Actual (gisteren)** | ${this.formatMetricValue(alert.metric, alert.actual)} |
| **Verschil** | ${directionSymbol} ${deltaPctFormatted} |

---

## Snelle diagnose

${alert.diagnosisHint}

---

## Aanbevolen checks

${alert.checklistItems.map(item => `- [ ] ${item}`).join('\n')}

---

## Bron

- **GA4 Property ID:** ${alert.ga4PropertyId}
- **Query type:** yesterday vs rolling average (7 dagen)
- **Generated:** ${new Date().toISOString()}
`;
  }

  /**
   * Build error description
   */
  private buildErrorDescription(errorMessage: string, context: Record<string, unknown>): string {
    return `## Monitoring Error

De GA4 anomaly monitoring is gefaald met de volgende error:

\`\`\`
${errorMessage}
\`\`\`

### Context

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

### Actie nodig

- [ ] Check of de GA4 API credentials nog geldig zijn
- [ ] Verifieer of de GA4 property IDs correct zijn
- [ ] Check of er rate limiting issues zijn
- [ ] Bekijk de server logs voor meer details

---

*Dit bericht is automatisch gegenereerd door de GA4 monitoring service.*
`;
  }

  /**
   * Format metric value for display
   */
  private formatMetricValue(metric: string, value: number): string {
    switch (metric) {
      case 'engagementRate':
        return `${(value * 100).toFixed(1)}%`;
      case 'purchaseRevenue':
        return `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`;
      default:
        return value.toLocaleString('nl-NL');
    }
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new ClickUpClientError(
            `ClickUp API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;

        // Only retry on network errors or 5xx errors
        const isRetryable =
          !(error instanceof ClickUpClientError) ||
          (error.statusCode && error.statusCode >= 500);

        if (isRetryable && attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(`ClickUp request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            error: lastError.message
          });
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
