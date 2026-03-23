import { NextRequest, NextResponse } from "next/server";
import { getLoginRequest, acceptLogin, rejectLogin } from "@/lib/hydra";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/oauth/login?login_challenge=X
 * Fetch login request details from Hydra. Used by the login page
 * to check if the user can skip login (already authenticated with Hydra).
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("login_challenge");
  if (!challenge) {
    return NextResponse.json({ error: "Missing login_challenge" }, { status: 400 });
  }

  try {
    const loginRequest = await getLoginRequest(challenge);

    // If Hydra already knows the user (remember=true from previous login),
    // auto-accept and return the redirect URL
    if (loginRequest.skip) {
      const redirect = await acceptLogin(challenge, loginRequest.subject);
      return NextResponse.json({ redirect_to: redirect.redirect_to });
    }

    return NextResponse.json({
      challenge: loginRequest.challenge,
      client: {
        client_id: loginRequest.client.client_id,
        client_name: loginRequest.client.client_name,
        logo_uri: loginRequest.client.logo_uri,
      },
      requested_scope: loginRequest.requested_scope,
      skip: false,
    });
  } catch (err) {
    console.error("OAuth login GET error:", err);
    return NextResponse.json({ error: "Failed to fetch login request" }, { status: 500 });
  }
}

/**
 * POST /api/oauth/login
 * Accept or reject the login challenge after the user authenticates.
 * Body: { challenge: string, action: "accept" | "reject" }
 * The user must have an active Supabase session.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { challenge, action } = body as { challenge: string; action: "accept" | "reject" };

  if (!challenge) {
    return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
  }

  if (action === "reject") {
    try {
      const redirect = await rejectLogin(challenge, "access_denied", "The user denied the login request");
      return NextResponse.json({ redirect_to: redirect.redirect_to });
    } catch (err) {
      console.error("OAuth login reject error:", err);
      return NextResponse.json({ error: "Failed to reject login" }, { status: 500 });
    }
  }

  // Accept: verify the user has an active Supabase session
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Accept login with Supabase user_id as the OAuth subject
    const redirect = await acceptLogin(challenge, user.id);
    return NextResponse.json({ redirect_to: redirect.redirect_to });
  } catch (err) {
    console.error("OAuth login accept error:", err);
    return NextResponse.json({ error: "Failed to accept login" }, { status: 500 });
  }
}
