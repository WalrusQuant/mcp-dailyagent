import { NextRequest, NextResponse } from "next/server";
import { getConsentRequest, acceptConsent, rejectConsent } from "@/lib/hydra";
import { VALID_SCOPES } from "@/lib/oauth-scopes";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/oauth/consent?consent_challenge=X
 * Fetch consent request details from Hydra.
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("consent_challenge");
  if (!challenge) {
    return NextResponse.json({ error: "Missing consent_challenge" }, { status: 400 });
  }

  try {
    const consentRequest = await getConsentRequest(challenge);

    // If consent was previously granted and remembered, auto-accept
    if (consentRequest.skip) {
      const redirect = await acceptConsent(
        challenge,
        consentRequest.requested_scope,
        consentRequest.requested_access_token_audience
      );
      return NextResponse.json({ redirect_to: redirect.redirect_to });
    }

    // Filter to valid scopes only
    const validRequestedScopes = consentRequest.requested_scope.filter(
      (s) => VALID_SCOPES.includes(s) || s === "openid" || s === "offline_access"
    );

    return NextResponse.json({
      challenge: consentRequest.challenge,
      client: {
        client_id: consentRequest.client.client_id,
        client_name: consentRequest.client.client_name,
        logo_uri: consentRequest.client.logo_uri,
        client_uri: consentRequest.client.client_uri,
        policy_uri: consentRequest.client.policy_uri,
        tos_uri: consentRequest.client.tos_uri,
      },
      requested_scope: validRequestedScopes,
      requested_access_token_audience: consentRequest.requested_access_token_audience,
      subject: consentRequest.subject,
      skip: false,
    });
  } catch (err) {
    console.error("OAuth consent GET error:", err);
    return NextResponse.json({ error: "Failed to fetch consent request" }, { status: 500 });
  }
}

/**
 * POST /api/oauth/consent
 * Accept or reject the consent challenge.
 * Body: { challenge, action: "accept" | "reject", grantedScopes?: string[] }
 */
export async function POST(request: NextRequest) {
  let body: { challenge?: string; action?: string; grantedScopes?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { challenge, action, grantedScopes } = body;

  if (!challenge || typeof challenge !== "string") {
    return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
  }

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action, must be 'accept' or 'reject'" }, { status: 400 });
  }

  // Verify the user is authenticated via Supabase
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (action === "reject") {
    try {
      const redirect = await rejectConsent(
        challenge,
        "access_denied",
        "The user denied the consent request"
      );
      return NextResponse.json({ redirect_to: redirect.redirect_to });
    } catch (err) {
      console.error("OAuth consent reject error:", err);
      return NextResponse.json({ error: "Failed to reject consent" }, { status: 500 });
    }
  }

  // Accept consent
  try {
    const consentRequest = await getConsentRequest(challenge);

    // Verify the authenticated user matches the consent subject
    if (consentRequest.subject !== user.id) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    // Validate granted scopes are a subset of what was requested
    const requestedScopes = consentRequest.requested_scope;
    const scopesToGrant = grantedScopes ?? requestedScopes;
    const invalidScopes = scopesToGrant.filter((s) => !requestedScopes.includes(s));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Scope escalation denied: ${invalidScopes.join(", ")}` },
        { status: 400 }
      );
    }

    const redirect = await acceptConsent(
      challenge,
      scopesToGrant,
      consentRequest.requested_access_token_audience,
      true,  // remember
      3600   // remember for 1 hour
    );

    return NextResponse.json({ redirect_to: redirect.redirect_to });
  } catch (err) {
    console.error("OAuth consent accept error:", err);
    return NextResponse.json({ error: "Failed to accept consent" }, { status: 500 });
  }
}
