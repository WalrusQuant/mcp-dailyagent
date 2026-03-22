"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Monitor, Loader2, Check, AlertTriangle, History, ChevronRight, Shield, DollarSign } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useModels } from "@/lib/useModels";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isAdmin, chatModels: availableChatModels } = useModels();

  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const promptTimeout = useRef<NodeJS.Timeout>(undefined);

  // Memory notes state
  const [memoryNotes, setMemoryNotes] = useState("");
  const [savedMemoryNotes, setSavedMemoryNotes] = useState("");
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const memoryTimeout = useRef<NodeJS.Timeout>(undefined);

  // AI feature toggle state
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [savedBriefingEnabled, setSavedBriefingEnabled] = useState(true);
  const [isSavingToggle, setIsSavingToggle] = useState(false);

  // AI Model config state
  const [aiModelConfig, setAiModelConfig] = useState<Record<string, string>>({});
  const [savedAiModelConfig, setSavedAiModelConfig] = useState<Record<string, string>>({});
  const [isSavingModels, setIsSavingModels] = useState(false);
  const [modelsSaved, setModelsSaved] = useState(false);
  const modelsTimeout = useRef<NodeJS.Timeout>(undefined);

  // Account management state
  const supabase = createClient();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    setEmailError("");
    setEmailSuccess(false);
    if (!newEmail || !newEmail.includes("@")) {
      setEmailError("Enter a valid email address");
      return;
    }
    setIsSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailSuccess(true);
      setNewEmail("");
      setTimeout(() => setEmailSuccess(false), 5000);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Delete account failed:", err);
      setIsDeleting(false);
    }
  };

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  const loadProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setSystemPrompt(data.systemPrompt || "");
        setSavedPrompt(data.systemPrompt || "");
        setMemoryNotes(data.memoryNotes || "");
        setSavedMemoryNotes(data.memoryNotes || "");
        setBriefingEnabled(data.briefingEnabled ?? true);
        setSavedBriefingEnabled(data.briefingEnabled ?? true);
        setAiModelConfig(data.aiModelConfig ?? {});
        setSavedAiModelConfig(data.aiModelConfig ?? {});
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (res.ok) {
        setSavedPrompt(systemPrompt);
        setPromptSaved(true);
        if (promptTimeout.current) clearTimeout(promptTimeout.current);
        promptTimeout.current = setTimeout(() => setPromptSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save system prompt:", err);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSaveMemory = async () => {
    setIsSavingMemory(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryNotes }),
      });
      if (res.ok) {
        setSavedMemoryNotes(memoryNotes);
        setMemorySaved(true);
        if (memoryTimeout.current) clearTimeout(memoryTimeout.current);
        memoryTimeout.current = setTimeout(() => setMemorySaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save memory notes:", err);
    } finally {
      setIsSavingMemory(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        <h1 className="text-2xl font-semibold mb-8" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>

        {/* Chat History */}
        <Link
          href="/history"
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-8 transition-colors"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <History className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
          <div className="flex-1">
            <div className="text-sm font-medium">Chat History</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Browse, search, and bulk delete conversations
            </div>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        </Link>

        {/* Usage & Costs */}
        <Link
          href="/usage"
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-8 transition-colors"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <DollarSign className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
          <div className="flex-1">
            <div className="text-sm font-medium">Usage & Costs</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              API credits, token usage, and cost breakdown by model
            </div>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        </Link>

        {/* Admin Settings */}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-8 transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <Shield className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
            <div className="flex-1">
              <div className="text-sm font-medium">Admin Settings</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                API keys, models, web search, site branding
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </Link>
        )}

        {/* Theme */}
        <section className="mb-8">
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Appearance
          </h2>
          <div className="flex gap-3">
            {themes.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl transition-colors flex-1"
                  style={{
                    background: isActive ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: `1px solid ${isActive ? "var(--accent-primary)" : "var(--border-default)"}`,
                    color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* System Prompt */}
        <section className="mb-8">
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            System Prompt
          </h2>
          <div className="space-y-3">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Custom instructions for the AI... Leave empty to use the default."
              rows={6}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {systemPrompt ? "Custom prompt active" : "Using default prompt"}
              </p>
              <div className="flex items-center gap-2">
                {systemPrompt && (
                  <button
                    onClick={() => {
                      setSystemPrompt("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Reset to default
                  </button>
                )}
                <button
                  onClick={handleSavePrompt}
                  disabled={isSavingPrompt || systemPrompt === savedPrompt}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                >
                  {isSavingPrompt ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : promptSaved ? (
                    <>
                      <Check className="w-3 h-3" />
                      Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Memory Notes */}
        <section className="mb-8">
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Memory Notes
          </h2>
          <div className="space-y-3">
            <textarea
              value={memoryNotes}
              onChange={(e) => setMemoryNotes(e.target.value)}
              placeholder="Tell the AI about yourself — preferences, context, recurring projects..."
              rows={6}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {memoryNotes ? "Included in every chat as context" : "No memory notes set"}
              </p>
              <div className="flex items-center gap-2">
                {memoryNotes && (
                  <button
                    onClick={() => setMemoryNotes("")}
                    className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSaveMemory}
                  disabled={isSavingMemory || memoryNotes === savedMemoryNotes}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                >
                  {isSavingMemory ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : memorySaved ? (
                    <>
                      <Check className="w-3 h-3" />
                      Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* AI Assistant */}
        <section className="mb-8">
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            AI Assistant
          </h2>
          <div className="space-y-3">
            {/* Daily briefing toggle */}
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Daily briefing
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Show AI-generated daily briefing on dashboard
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={briefingEnabled}
                onClick={async () => {
                  const next = !briefingEnabled;
                  setBriefingEnabled(next);
                  setIsSavingToggle(true);
                  try {
                    const res = await fetch("/api/profile", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ briefingEnabled: next }),
                    });
                    if (res.ok) {
                      setSavedBriefingEnabled(next);
                    } else {
                      setBriefingEnabled(savedBriefingEnabled);
                    }
                  } catch {
                    setBriefingEnabled(savedBriefingEnabled);
                  } finally {
                    setIsSavingToggle(false);
                  }
                }}
                disabled={isSavingToggle}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                style={{
                  background: briefingEnabled ? "var(--accent-primary)" : "var(--bg-elevated)",
                }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full transition-transform"
                  style={{
                    background: "var(--bg-base)",
                    transform: briefingEnabled ? "translateX(24px)" : "translateX(4px)",
                  }}
                />
              </button>
            </div>

            {/* Model overrides */}
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                Model overrides
              </p>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                Override the model used for each AI feature. Leave as default to use the system model.
              </p>
              <div className="space-y-3">
                {(["briefing", "insights", "assist", "tools"] as const).map((task) => {
                  const labels: Record<string, string> = {
                    briefing: "Daily Briefing",
                    insights: "Insights",
                    assist: "In-Tool Assist",
                    tools: "Tool Calling",
                  };
                  return (
                    <div key={task}>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                        {labels[task]}
                      </label>
                      <select
                        value={aiModelConfig[task] || ""}
                        onChange={(e) => setAiModelConfig((prev) => ({ ...prev, [task]: e.target.value }))}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none"
                        style={{
                          background: "var(--bg-base)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-default)",
                        }}
                      >
                        <option value="">Default</option>
                        {availableChatModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      setIsSavingModels(true);
                      try {
                        const cleaned: Record<string, string> = {};
                        for (const [k, v] of Object.entries(aiModelConfig)) {
                          if (v.trim()) cleaned[k] = v.trim();
                        }
                        const payload = Object.keys(cleaned).length > 0 ? cleaned : null;
                        const res = await fetch("/api/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ aiModelConfig: payload }),
                        });
                        if (res.ok) {
                          setSavedAiModelConfig(aiModelConfig);
                          setModelsSaved(true);
                          if (modelsTimeout.current) clearTimeout(modelsTimeout.current);
                          modelsTimeout.current = setTimeout(() => setModelsSaved(false), 2000);
                        }
                      } catch (err) {
                        console.error("Failed to save AI models:", err);
                      } finally {
                        setIsSavingModels(false);
                      }
                    }}
                    disabled={isSavingModels || JSON.stringify(aiModelConfig) === JSON.stringify(savedAiModelConfig)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                  >
                    {isSavingModels ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : modelsSaved ? (
                      <>
                        <Check className="w-3 h-3" />
                        Saved
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="mb-8">
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Account
          </h2>
          <div className="space-y-6">
            {/* Change Password */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                Change Password
              </h3>
              <div className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  minLength={6}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                />
                {passwordError && (
                  <p className="text-xs" style={{ color: "var(--accent-negative)" }}>{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-xs" style={{ color: "var(--accent-positive)" }}>Password updated successfully</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={isSavingPassword || !newPassword || !confirmPassword}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                  >
                    {isSavingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : "Update Password"}
                  </button>
                </div>
              </div>
            </div>

            {/* Change Email */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
                Change Email
              </h3>
              <div className="space-y-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                />
                {emailError && (
                  <p className="text-xs" style={{ color: "var(--accent-negative)" }}>{emailError}</p>
                )}
                {emailSuccess && (
                  <p className="text-xs" style={{ color: "var(--accent-positive)" }}>
                    Verification email sent. Check both your old and new email.
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleChangeEmail}
                    disabled={isSavingEmail || !newEmail}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                  >
                    {isSavingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : "Update Email"}
                  </button>
                </div>
              </div>
            </div>

            {/* Delete Account */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--accent-negative)" }} />
                <h3 className="text-sm font-medium" style={{ color: "var(--accent-negative)" }}>
                  Delete Account
                </h3>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                This will permanently delete all your conversations, messages, and generated images.
                This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: "rgba(248, 113, 113, 0.1)",
                    color: "var(--accent-negative)",
                    border: "1px solid rgba(248, 113, 113, 0.3)",
                  }}
                >
                  Delete my account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-base)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(248, 113, 113, 0.3)",
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                      className="px-4 py-1.5 rounded-lg text-xs transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE" || isDeleting}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                      style={{
                        background: "var(--accent-negative)",
                        color: "white",
                      }}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Permanently Delete"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
