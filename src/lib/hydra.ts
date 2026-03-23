/**
 * Ory Hydra v2 Admin API client.
 * Handles login/consent challenge flows and token introspection.
 * Uses raw fetch — no SDK dependency.
 */

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;

function getAdminUrl(): string {
  if (!HYDRA_ADMIN_URL) {
    throw new Error("HYDRA_ADMIN_URL environment variable is not set");
  }
  return HYDRA_ADMIN_URL;
}

// --- Types ---

export interface HydraLoginRequest {
  challenge: string;
  client: HydraClient;
  request_url: string;
  requested_scope: string[];
  requested_access_token_audience: string[];
  skip: boolean;
  subject: string;
  oidc_context?: {
    display?: string;
    ui_locales?: string[];
  };
}

export interface HydraConsentRequest {
  challenge: string;
  client: HydraClient;
  requested_scope: string[];
  requested_access_token_audience: string[];
  skip: boolean;
  subject: string;
  login_challenge: string;
  login_session_id: string;
  acr: string;
  context?: Record<string, unknown>;
}

export interface HydraClient {
  client_id: string;
  client_name?: string;
  logo_uri?: string;
  client_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
  scope?: string;
}

export interface HydraRedirect {
  redirect_to: string;
}

export interface HydraIntrospectionResult {
  active: boolean;
  sub?: string;
  client_id?: string;
  scope?: string;
  exp?: number;
  iat?: number;
  aud?: string[];
  token_type?: string;
  token_use?: string;
}

// --- Login Challenge ---

export async function getLoginRequest(challenge: string): Promise<HydraLoginRequest> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Hydra getLoginRequest failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function acceptLogin(
  challenge: string,
  subject: string,
  remember: boolean = true,
  rememberFor: number = 3600
): Promise<HydraRedirect> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        subject,
        remember,
        remember_for: rememberFor,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Hydra acceptLogin failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function rejectLogin(
  challenge: string,
  error: string,
  errorDescription: string
): Promise<HydraRedirect> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/login/reject?login_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        error,
        error_description: errorDescription,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Hydra rejectLogin failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// --- Consent Challenge ---

export async function getConsentRequest(challenge: string): Promise<HydraConsentRequest> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Hydra getConsentRequest failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function acceptConsent(
  challenge: string,
  grantScope: string[],
  grantAccessTokenAudience: string[],
  remember: boolean = true,
  rememberFor: number = 3600
): Promise<HydraRedirect> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_scope: grantScope,
        grant_access_token_audience: grantAccessTokenAudience,
        remember,
        remember_for: rememberFor,
        session: {
          // Include the subject in the access token for downstream use
          access_token: {},
          id_token: {},
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Hydra acceptConsent failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function rejectConsent(
  challenge: string,
  error: string,
  errorDescription: string
): Promise<HydraRedirect> {
  const res = await fetch(
    `${getAdminUrl()}/admin/oauth2/auth/requests/consent/reject?consent_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        error,
        error_description: errorDescription,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Hydra rejectConsent failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// --- Token Introspection ---

export async function introspectToken(token: string): Promise<HydraIntrospectionResult> {
  const res = await fetch(`${getAdminUrl()}/admin/oauth2/introspect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `token=${encodeURIComponent(token)}`,
  });
  if (!res.ok) {
    throw new Error(`Hydra introspectToken failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
