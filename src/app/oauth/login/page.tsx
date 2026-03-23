"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, Loader2 } from "lucide-react";

function OAuthLoginContent() {
  const searchParams = useSearchParams();
  const challenge = searchParams.get("login_challenge");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);

  const supabase = createClient();

  const acceptAndRedirect = useCallback(
    async (loginChallenge: string) => {
      const res = await fetch(`/api/oauth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge: loginChallenge, action: "accept" }),
      });
      const data = await res.json();
      if (data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        throw new Error(data.error || "Failed to accept login");
      }
    },
    []
  );

  useEffect(() => {
    if (!challenge) {
      setError("Missing login_challenge parameter");
      setIsLoading(false);
      return;
    }

    async function init() {
      try {
        // Check if Hydra says we can skip (user already remembered)
        const loginRes = await fetch(`/api/oauth/login?login_challenge=${encodeURIComponent(challenge!)}`);
        const loginData = await loginRes.json();

        if (loginData.redirect_to) {
          // Hydra skip — auto redirect
          window.location.href = loginData.redirect_to;
          return;
        }

        if (loginData.client?.client_name) {
          setClientName(loginData.client.client_name);
        }

        // Check if user already has a Supabase session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Already logged in — accept the challenge automatically
          await acceptAndRedirect(challenge!);
          return;
        }

        // No session — show login form
        setIsLoading(false);
      } catch (err) {
        console.error("OAuth login init error:", err);
        setError("Failed to initialize authorization flow");
        setIsLoading(false);
      }
    }

    init();
  }, [challenge, supabase.auth, acceptAndRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;

    setError("");
    setIsSubmitting(true);

    try {
      // Authenticate with Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      // Accept the Hydra login challenge
      await acceptAndRedirect(challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={{ color: "var(--accent-primary)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Checking authentication...
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <Shield className="w-6 h-6" style={{ color: "var(--accent-primary)" }} />
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Sign in to authorize
        </h1>
      </div>

      {clientName && (
        <p className="text-center text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{clientName}</span>{" "}
          wants to access your Daily Agent account
        </p>
      )}

      {!clientName && (
        <p className="text-center text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Sign in to continue with authorization
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="text-sm rounded-lg p-3"
            style={{
              color: "var(--accent-negative)",
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg px-4 py-3 font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          style={{
            background: "var(--accent-primary)",
            color: "var(--bg-base)",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Authorizing...
            </>
          ) : (
            "Sign in & authorize"
          )}
        </button>
      </form>
    </div>
  );
}

export default function OAuthLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--accent-primary)" }} />
        </div>
      }
    >
      <OAuthLoginContent />
    </Suspense>
  );
}
