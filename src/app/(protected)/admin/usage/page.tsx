"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Trash2, Plus, Pencil, Shield,
} from "lucide-react";
import Link from "next/link";
import { FormModal } from "@/components/shared/FormModal";
import type { UsageLimit } from "@/types/database";

interface UserUsage {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  monthlyBudget: number | null;
  currentMonthCost: number;
  currentMonthMessages: number;
  currentMonthTokens: number;
  limits: UsageLimit[];
  status: "ok" | "warning" | "exceeded";
}

interface LimitWithEmail extends UsageLimit {
  user_email: string | null;
}

function StatusBadge({ status }: { status: "ok" | "warning" | "exceeded" }) {
  const colors: Record<string, { bg: string; text: string }> = {
    ok: { bg: "var(--accent-positive)", text: "#fff" },
    warning: { bg: "#f59e0b", text: "#fff" },
    exceeded: { bg: "#ef4444", text: "#fff" },
  };
  const c = colors[status];
  return (
    <span
      className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export default function AdminUsagePage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [limits, setLimits] = useState<LimitWithEmail[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<LimitWithEmail | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formUserId, setFormUserId] = useState<string>("");
  const [formLimitType, setFormLimitType] = useState<"cost" | "tokens">("cost");
  const [formLimitValue, setFormLimitValue] = useState("");
  const [formPeriod, setFormPeriod] = useState<"daily" | "monthly">("monthly");
  const [formMode, setFormMode] = useState<"hard" | "soft">("hard");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, limitsRes] = await Promise.all([
        fetch("/api/admin/usage"),
        fetch("/api/admin/limits"),
      ]);

      if (usageRes.status === 403 || limitsRes.status === 403) {
        router.push("/chat");
        return;
      }

      const usageData = await usageRes.json();
      const limitsData = await limitsRes.json();

      setUsers(usageData.users || []);
      setLimits(Array.isArray(limitsData) ? limitsData : []);
      setAllProfiles(
        (usageData.users || []).map((u: UserUsage) => ({ id: u.id, email: u.email }))
      );
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAddModal = () => {
    setEditingLimit(null);
    setFormUserId("");
    setFormLimitType("cost");
    setFormLimitValue("");
    setFormPeriod("monthly");
    setFormMode("hard");
    setShowLimitModal(true);
  };

  const openEditModal = (limit: LimitWithEmail) => {
    setEditingLimit(limit);
    setFormUserId(limit.user_id || "");
    setFormLimitType(limit.limit_type);
    setFormLimitValue(String(limit.limit_value));
    setFormPeriod(limit.period);
    setFormMode(limit.mode);
    setShowLimitModal(true);
  };

  const handleSaveLimit = async () => {
    setSaving(true);
    try {
      if (editingLimit) {
        await fetch("/api/admin/limits", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingLimit.id,
            limit_value: Number(formLimitValue),
            mode: formMode,
            active: true,
          }),
        });
      } else {
        await fetch("/api/admin/limits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: formUserId || null,
            limit_type: formLimitType,
            limit_value: Number(formLimitValue),
            period: formPeriod,
            mode: formMode,
          }),
        });
      }
      setShowLimitModal(false);
      fetchData();
    } catch (error) {
      console.error("Failed to save limit:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLimit = async (id: string) => {
    if (!confirm("Delete this limit?")) return;
    await fetch(`/api/admin/limits?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleToggleActive = async (limit: LimitWithEmail) => {
    await fetch("/api/admin/limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: limit.id, active: !limit.active }),
    });
    fetchData();
  };

  const sortedUsers = [...users].sort((a, b) => b.currentMonthCost - a.currentMonthCost);

  const inputStyle = {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  };

  const labelStyle = { color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 as const };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Usage & Limits
            </h1>
          </div>
        </div>

        {/* Users Usage Table */}
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            User Usage (Current Month)
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    {["Email", "Cost", "Messages", "Tokens", "Budget", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-medium"
                        style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-default)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                        <div className="flex items-center gap-1.5">
                          {u.email}
                          {u.isAdmin && (
                            <Shield className="w-3 h-3" style={{ color: "var(--accent-primary)" }} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                        {formatCost(u.currentMonthCost)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                        {u.currentMonthMessages}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                        {formatTokens(u.currentMonthTokens)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {u.monthlyBudget ? formatCost(u.monthlyBudget) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                    </tr>
                  ))}
                  {sortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Limits Management */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Usage Limits
            </h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent-primary)", color: "#fff" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Limit
            </button>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    {["Scope", "Type", "Value", "Period", "Mode", "Active", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-medium"
                        style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-default)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {limits.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border-default)", opacity: l.active ? 1 : 0.5 }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                        {l.user_email || "Global Default"}
                      </td>
                      <td className="px-4 py-3 capitalize" style={{ color: "var(--text-primary)" }}>
                        {l.limit_type}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                        {l.limit_type === "cost" ? `$${Number(l.limit_value).toFixed(2)}` : formatTokens(Number(l.limit_value))}
                      </td>
                      <td className="px-4 py-3 capitalize" style={{ color: "var(--text-primary)" }}>
                        {l.period}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase"
                          style={{
                            background: l.mode === "hard" ? "#ef4444" : "#f59e0b",
                            color: "#fff",
                          }}
                        >
                          {l.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(l)}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: l.active ? "var(--accent-positive)" : "var(--bg-elevated)",
                            color: l.active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {l.active ? "Yes" : "No"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(l)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLimit(l.id)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: "#ef4444" }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {limits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                        No limits configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Limit Form Modal */}
      {showLimitModal && (
        <FormModal
          title={editingLimit ? "Edit Limit" : "Add Usage Limit"}
          onClose={() => setShowLimitModal(false)}
        >
          <div className="space-y-4">
            {!editingLimit && (
              <>
                <div>
                  <label className="block mb-1" style={labelStyle}>Scope</label>
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  >
                    <option value="">Global Default</option>
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.email}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1" style={labelStyle}>Type</label>
                    <select
                      value={formLimitType}
                      onChange={(e) => setFormLimitType(e.target.value as "cost" | "tokens")}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    >
                      <option value="cost">Cost ($)</option>
                      <option value="tokens">Tokens</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1" style={labelStyle}>Period</label>
                    <select
                      value={formPeriod}
                      onChange={(e) => setFormPeriod(e.target.value as "daily" | "monthly")}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    >
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block mb-1" style={labelStyle}>
                Value {formLimitType === "cost" ? "($)" : "(tokens)"}
              </label>
              <input
                type="number"
                step={formLimitType === "cost" ? "0.01" : "1000"}
                min="0"
                value={formLimitValue}
                onChange={(e) => setFormLimitValue(e.target.value)}
                placeholder={formLimitType === "cost" ? "10.00" : "1000000"}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block mb-1" style={labelStyle}>Mode</label>
              <select
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as "hard" | "soft")}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              >
                <option value="hard">Hard (blocks requests)</option>
                <option value="soft">Soft (warning only)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLimitModal(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLimit}
                disabled={saving || !formLimitValue || Number(formLimitValue) <= 0}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "#fff" }}
              >
                {saving ? "Saving..." : editingLimit ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
