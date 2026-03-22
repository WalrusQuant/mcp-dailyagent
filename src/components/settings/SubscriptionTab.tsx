"use client";

import { useState, useEffect } from "react";
import { Loader2, CreditCard, Check, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SubscriptionTab() {
  const [plan, setPlan] = useState<string>("free");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, subscription_status")
        .eq("id", user.id)
        .single();

      if (profile) {
        setPlan(profile.plan || "free");
      }
      setIsLoading(false);
    }
    loadPlan();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const isPaid = plan === "active";

  const freeFeatures = [
    "Full dashboard access",
    "All productivity tools",
    "AI suggestions (usage-capped)",
    "Read-only MCP access",
    "1 API key",
    "500 MCP requests/day",
  ];

  const proFeatures = [
    "Everything in Free",
    "MCP write access (create, update, delete)",
    "All MCP prompt templates",
    "Unlimited API keys",
    "10,000 MCP requests/day",
    "Data export (JSON/CSV)",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Subscription
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {isPaid
            ? "You're on the Pro plan. Manage your subscription below."
            : "You're on the free plan. Upgrade to unlock full MCP write access and prompt templates."}
        </p>
      </div>

      {/* Current plan */}
      <div
        className="rounded-lg p-4 flex items-center gap-3"
        style={{
          background: isPaid ? "rgba(212, 165, 116, 0.1)" : "var(--bg-elevated)",
          border: `1px solid ${isPaid ? "rgba(212, 165, 116, 0.3)" : "var(--border-default)"}`,
        }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: isPaid ? "var(--accent-primary)" : "var(--bg-surface)",
          }}
        >
          {isPaid ? (
            <Zap className="w-5 h-5" style={{ color: "var(--bg-base)" }} />
          ) : (
            <CreditCard className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {isPaid ? "Pro Plan" : "Free Plan"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isPaid ? "$20/month" : "$0/month"}
          </p>
        </div>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Free */}
        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--bg-elevated)",
            border: `1px solid ${!isPaid ? "var(--accent-primary)" : "var(--border-default)"}`,
          }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Free
          </h3>
          <ul className="space-y-2">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent-positive)" }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--bg-elevated)",
            border: `1px solid ${isPaid ? "var(--accent-primary)" : "var(--border-default)"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Pro — $20/mo
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}>
              $16/mo annual
            </span>
          </div>
          <ul className="space-y-2">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent-primary)" }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action buttons */}
      {isPaid ? (
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
          }}
        >
          Manage Billing
        </button>
      ) : (
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--accent-primary)",
            color: "var(--bg-base)",
          }}
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro
        </button>
      )}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Stripe checkout and billing portal will be wired up in Phase 7.
      </p>
    </div>
  );
}
