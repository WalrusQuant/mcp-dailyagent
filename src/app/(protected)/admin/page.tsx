"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Shield, Eye, EyeOff, Loader2, Check, X, Trash2, Plus, Save,
} from "lucide-react";

interface AppModel {
  id: string;
  model_id: string;
  name: string;
  description: string;
  is_default: boolean;
  sort_order: number;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Models state
  const [models, setModels] = useState<AppModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelDesc, setNewModelDesc] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  // Loading
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Check admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      supabase.from("profiles").select("is_admin").eq("id", user.id).single().then(({ data }) => {
        const admin = data?.is_admin === true;
        setIsAdmin(admin);
        if (!admin) router.push("/dashboard");
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load API key status
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;
      const data = await res.json();
      const orKey = data.settings?.find((s: { key: string; configured: boolean; masked?: string }) => s.key === "openrouter_api_key");
      if (orKey) {
        setApiKeyConfigured(orKey.configured);
        setApiKeyMasked(orKey.masked || "");
      }
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // Load models
  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const { data, error } = await supabase
        .from("app_models")
        .select("id, model_id, name, description, is_default, sort_order")
        .order("sort_order", { ascending: true });
      if (!error && data) setModels(data);
    } finally {
      setIsLoadingModels(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettings();
    loadModels();
  }, [loadSettings, loadModels]);

  // Save API key
  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "openrouter_api_key", value: apiKey.trim(), category: "api_keys" }),
      });
      if (res.ok) {
        setApiKey("");
        await loadSettings();
      }
    } finally {
      setSavingKey(false);
    }
  };

  // Test API key
  const handleTestKey = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest && !apiKeyConfigured) return;
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", apiKey: keyToTest || undefined }),
      });
      setTestResult(await res.json());
    } catch {
      setTestResult({ success: false, error: "Request failed" });
    } finally {
      setTestingKey(false);
    }
  };

  // Add model
  const handleAddModel = async () => {
    if (!newModelId.trim() || !newModelName.trim()) return;
    setSavingModel(true);
    try {
      const { error } = await supabase.from("app_models").insert({
        model_id: newModelId.trim(),
        name: newModelName.trim(),
        description: newModelDesc.trim() || "",
        provider: "openrouter",
        type: "chat",
        is_default: models.length === 0,
        sort_order: models.length,
      });
      if (!error) {
        setNewModelId("");
        setNewModelName("");
        setNewModelDesc("");
        setShowAddModel(false);
        await loadModels();
      }
    } finally {
      setSavingModel(false);
    }
  };

  // Delete model
  const handleDeleteModel = async (id: string) => {
    const { error } = await supabase.from("app_models").delete().eq("id", id);
    if (!error) setModels((prev) => prev.filter((m) => m.id !== id));
  };

  // Set default model
  const handleSetDefault = async (id: string) => {
    // Unset all defaults first
    await supabase.from("app_models").update({ is_default: false }).neq("id", "");
    await supabase.from("app_models").update({ is_default: true }).eq("id", id);
    await loadModels();
  };

  if (isAdmin === undefined || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Admin</h1>
        </div>

        {/* OpenRouter API Key */}
        <section
          className="rounded-xl p-5 space-y-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              OpenRouter API Key
            </h2>
            {apiKeyConfigured ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "var(--accent-positive)", color: "#fff" }}
              >
                <Check className="w-2.5 h-2.5" /> Connected
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "var(--accent-negative)", color: "#fff" }}
              >
                <X className="w-2.5 h-2.5" /> Not Set
              </span>
            )}
          </div>

          {apiKeyConfigured && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Current: {apiKeyMasked}
            </p>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none pr-8"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={savingKey || !apiKey.trim()}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
            <button
              onClick={handleTestKey}
              disabled={testingKey}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
            >
              {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
            </button>
          </div>

          {testResult && (
            <div
              className="text-xs px-2 py-1.5 rounded"
              style={{
                color: testResult.success ? "var(--accent-positive)" : "var(--accent-negative)",
                background: testResult.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              }}
            >
              {testResult.success ? "Connection successful" : testResult.error || "Connection failed"}
            </div>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Get your API key from{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent-primary)" }}
            >
              openrouter.ai/keys
            </a>
            . This key is used for all AI features (briefings, insights, reviews, journal prompts).
          </p>
        </section>

        {/* Models */}
        <section
          className="rounded-xl p-5 space-y-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Models
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                OpenRouter models used for AI features. The default model is used for briefings, insights, and suggestions.
              </p>
            </div>
            <button
              onClick={() => setShowAddModel(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {isLoadingModels ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : models.length === 0 ? (
            <div
              className="rounded-lg p-6 text-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No models configured. Add an OpenRouter model to enable AI features.
              </p>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Example: <code style={{ color: "var(--accent-primary)" }}>google/gemini-2.5-flash-preview</code>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {m.name}
                      </span>
                      {m.is_default && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {m.model_id}
                    </p>
                    {m.description && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {m.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {!m.is_default && (
                      <button
                        onClick={() => handleSetDefault(m.id)}
                        className="px-2 py-1 rounded text-xs font-medium transition-colors"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-default)" }}
                        title="Set as default"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteModel(m.id)}
                      className="p-2 rounded-lg transition-colors hover:opacity-80"
                      style={{ color: "var(--accent-negative)" }}
                      title="Remove model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add Model Modal */}
        {showAddModel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div
              className="w-full max-w-md rounded-xl p-6"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Add Model
                </h3>
                <button
                  onClick={() => { setShowAddModel(false); setNewModelId(""); setNewModelName(""); setNewModelDesc(""); }}
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder="google/gemini-2.5-flash-preview"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-base)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                    autoFocus
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    The OpenRouter model ID (e.g. google/gemini-2.5-flash-preview)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Gemini 2.5 Flash"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-base)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newModelDesc}
                    onChange={(e) => setNewModelDesc(e.target.value)}
                    placeholder="Fast, cheap model for AI suggestions"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-base)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => { setShowAddModel(false); setNewModelId(""); setNewModelName(""); setNewModelDesc(""); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddModel}
                    disabled={savingModel || !newModelId.trim() || !newModelName.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                  >
                    {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Add Model
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
