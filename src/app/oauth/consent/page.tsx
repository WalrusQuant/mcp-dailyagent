"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Check, X, Loader2, ExternalLink } from "lucide-react";
import { groupScopesByCategory, getScopeLabel, getScopeDescription } from "@/lib/oauth-scopes";

interface ConsentData {
  challenge: string;
  client: {
    client_id: string;
    client_name?: string;
    logo_uri?: string;
    client_uri?: string;
    policy_uri?: string;
    tos_uri?: string;
  };
  requested_scope: string[];
  requested_access_token_audience: string[];
  subject: string;
}

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const challenge = searchParams.get("consent_challenge");

  const [consentData, setConsentData] = useState<ConsentData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!challenge) {
      setError("Missing consent_challenge parameter");
      setIsLoading(false);
      return;
    }

    async function fetchConsent() {
      try {
        const res = await fetch(`/api/oauth/consent?consent_challenge=${encodeURIComponent(challenge!)}`);
        const data = await res.json();

        if (data.redirect_to) {
          // Auto-accepted (previously remembered)
          window.location.href = data.redirect_to;
          return;
        }

        if (data.error) {
          setError(data.error);
        } else {
          setConsentData(data);
        }
      } catch (err) {
        console.error("Consent fetch error:", err);
        setError("Failed to load authorization request");
      } finally {
        setIsLoading(false);
      }
    }

    fetchConsent();
  }, [challenge]);

  const handleAction = async (action: "accept" | "reject") => {
    if (!challenge) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge,
          action,
          grantedScopes: action === "accept" ? consentData?.requested_scope : undefined,
        }),
      });

      const data = await res.json();
      if (data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        setError(data.error || "Authorization failed");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Consent action error:", err);
      setError("Failed to process authorization");
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
          Loading authorization request...
        </p>
      </div>
    );
  }

  if (error || !consentData) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <X className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--accent-negative)" }} />
        <p className="text-sm" style={{ color: "var(--accent-negative)" }}>
          {error || "Invalid authorization request"}
        </p>
      </div>
    );
  }

  const clientName = consentData.client.client_name || consentData.client.client_id;

  // Filter out OIDC standard scopes from display
  const displayScopes = consentData.requested_scope.filter(
    (s) => s !== "openid" && s !== "offline_access"
  );
  const groupedScopes = groupScopesByCategory(displayScopes);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-6 h-6" style={{ color: "var(--accent-primary)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Authorize access
          </h1>
        </div>

        <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{clientName}</span>{" "}
          wants to access your Daily Agent account
        </p>

        {consentData.client.client_uri && (
          <a
            href={consentData.client.client_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs mt-1 hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            {consentData.client.client_uri}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Scopes */}
      <div
        className="px-6 py-4"
        style={{ borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }}
      >
        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          This will allow access to:
        </p>

        <div className="space-y-3">
          {Object.entries(groupedScopes).map(([category, scopes]) => (
            <div key={category}>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                {category}
              </p>
              <div className="space-y-1">
                {scopes.map((scopeDef) => (
                  <div
                    key={scopeDef.scope}
                    className="flex items-start gap-2 rounded-lg px-3 py-2"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-positive)" }} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {getScopeLabel(scopeDef.scope)}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {getScopeDescription(scopeDef.scope)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {displayScopes.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Basic access to your account
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 pt-4 flex gap-3">
        <button
          onClick={() => handleAction("reject")}
          disabled={isSubmitting}
          className="flex-1 rounded-lg px-4 py-3 font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
          }}
        >
          Deny
        </button>
        <button
          onClick={() => handleAction("accept")}
          disabled={isSubmitting}
          className="flex-1 rounded-lg px-4 py-3 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: "var(--accent-primary)",
            color: "var(--bg-base)",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Authorize"
          )}
        </button>
      </div>

      {/* Footer links */}
      {(consentData.client.policy_uri || consentData.client.tos_uri) && (
        <div
          className="px-6 pb-4 flex items-center justify-center gap-4 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {consentData.client.policy_uri && (
            <a
              href={consentData.client.policy_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Privacy Policy
            </a>
          )}
          {consentData.client.tos_uri && (
            <a
              href={consentData.client.tos_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Terms of Service
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function OAuthConsentPage() {
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
      <OAuthConsentContent />
    </Suspense>
  );
}
