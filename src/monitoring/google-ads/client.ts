import { Logger } from '../utils/logger';
import type {
  GoogleAdsCredentials,
  GoogleAdsClientConfig,
  GaqlResponse,
  GoogleAdsOAuthTokens,
  GoogleAdsCustomerInfo,
  GoogleAdsServiceAccountCredentials,
  GoogleAdsOAuthCredentials,
} from './types';

const GOOGLE_ADS_API_VERSION = 'v22';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export class GoogleAdsClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GoogleAdsClientError';
  }
}

interface GoogleAdsClientOptions {
  credentials: GoogleAdsCredentials;
  customerId: string;
  logger: Logger;
  retryAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Google Ads API Client
 * Read-only client for monitoring purposes
 */
export class GoogleAdsClient {
  private credentials: GoogleAdsCredentials;
  private customerId: string;
  private logger: Logger;
  private retryAttempts: number;
  private retryDelayMs: number;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(options: GoogleAdsClientOptions) {
    this.credentials = options.credentials;
    this.customerId = options.customerId.trim().replace(/-/g, ''); // Remove spaces and dashes
    this.logger = options.logger;
    this.retryAttempts = options.retryAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    // Determine auth type and get token accordingly
    if (this.isServiceAccountCredentials(this.credentials)) {
      return this.getServiceAccountToken(this.credentials);
    } else {
      return this.getOAuthToken(this.credentials as GoogleAdsOAuthCredentials);
    }
  }

  /**
   * Check if credentials are for a service account
   */
  private isServiceAccountCredentials(
    creds: GoogleAdsCredentials
  ): creds is GoogleAdsServiceAccountCredentials {
    return 'type' in creds && creds.type === 'service_account';
  }

  /**
   * Get access token using OAuth refresh token
   */
  private async getOAuthToken(credentials: GoogleAdsOAuthCredentials): Promise<string> {
    this.logger.debug('Refreshing Google Ads access token via OAuth');

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GoogleAdsClientError(
        `Failed to refresh access token: ${response.status}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return this.accessToken!;
  }

  /**
   * Get access token using service account JWT
   */
  private async getServiceAccountToken(
    credentials: GoogleAdsServiceAccountCredentials
  ): Promise<string> {
    this.logger.debug('Getting Google Ads access token via Service Account');

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const jwt = await this.createServiceAccountJWT(
      credentials.serviceAccountEmail,
      credentials.privateKey,
      now
    );

    // Exchange JWT for access token
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GoogleAdsClientError(
        `Failed to get service account token: ${response.status}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return this.accessToken!;
  }

  /**
   * Create a signed JWT for service account authentication
   */
  private async createServiceAccountJWT(
    email: string,
    privateKey: string,
    now: number
  ): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: email,
      scope: GOOGLE_ADS_SCOPE,
      aud: OAUTH_TOKEN_URL,
      iat: now,
      exp: now + 3600, // 1 hour
    };

    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Sign the token
    const signature = await this.signWithRS256(unsignedToken, privateKey);

    return `${unsignedToken}.${signature}`;
  }

  /**
   * Base64 URL encode a string
   */
  private base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Sign data with RS256 using the private key
   */
  private async signWithRS256(data: string, privateKey: string): Promise<string> {
    // Use Web Crypto API for signing
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Parse the PEM private key
    const pemContents = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
      .replace(/-----END RSA PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const binaryKey = Buffer.from(pemContents, 'base64');

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      dataBuffer
    );

    // Convert to base64url
    const signatureB64 = Buffer.from(signature).toString('base64');
    return signatureB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Execute a GAQL query
   */
  async query(gaql: string): Promise<GaqlResponse> {
    const accessToken = await this.getAccessToken();

    const loginCustomerId = this.credentials.loginCustomerId?.trim().replace(/-/g, '');
    const url = `${GOOGLE_ADS_API_BASE}/customers/${this.customerId}/googleAds:searchStream`;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'developer-token': this.credentials.developerToken,
        };

        if (loginCustomerId) {
          headers['login-customer-id'] = loginCustomerId;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: gaql }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new GoogleAdsClientError(
            `Google Ads API error: ${response.status}`,
            response.status,
            errorBody
          );
        }

        // Parse streaming response (can be NDJSON or JSON array)
        const text = await response.text();
        const results: unknown[] = [];

        this.logger.debug('Raw API response', {
          responseLength: text.length,
          responsePreview: text.substring(0, 500),
        });

        // Try parsing as JSON array first (v22 format)
        try {
          const jsonData = JSON.parse(text);
          if (Array.isArray(jsonData)) {
            // Response is a JSON array of batches
            for (const batch of jsonData) {
              if (batch.results) {
                results.push(...batch.results);
              }
            }
          } else if (jsonData.results) {
            // Single response object
            results.push(...jsonData.results);
          }
        } catch {
          // Fallback: Parse as NDJSON (newline-delimited JSON)
          const lines = text.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.results) {
                results.push(...parsed.results);
              }
            } catch {
              // Skip invalid lines
            }
          }
        }

        this.logger.debug('Parsed results', { resultCount: results.length });

        return {
          results: results as GaqlResponse['results'],
          fieldMask: '',
          requestId: response.headers.get('x-goog-request-id') || '',
        };
      } catch (error) {
        lastError = error as Error;

        // Only retry on network errors or 5xx errors
        const isRetryable =
          !(error instanceof GoogleAdsClientError) ||
          (error.statusCode && error.statusCode >= 500);

        if (isRetryable && attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(`Google Ads request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            error: lastError.message,
          });
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * Check if the connection is valid
   */
  async verifyConnection(): Promise<boolean> {
    try {
      // Simple query to verify access
      await this.query(`
        SELECT customer.id, customer.descriptive_name
        FROM customer
        LIMIT 1
      `);
      return true;
    } catch (error) {
      this.logger.error('Failed to verify Google Ads connection', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<GoogleAdsCustomerInfo | null> {
    // Don't catch errors here - let them propagate for better debugging
    const response = await this.query(`
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `);

    if (response.results.length === 0) {
      return null;
    }

    const row = response.results[0] as {
      customer: {
        id: string;
        descriptiveName: string;
        currencyCode: string;
        timeZone: string;
      };
    };

    return {
      customerId: row.customer.id,
      descriptiveName: row.customer.descriptiveName,
      currencyCode: row.customer.currencyCode,
      timeZone: row.customer.timeZone,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * OAuth helper functions for Google Ads
 */
export class GoogleAdsOAuth {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get the OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<GoogleAdsOAuthTokens> {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GoogleAdsClientError(
        `Failed to exchange code for tokens: ${response.status}`,
        response.status,
        error
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }
}
