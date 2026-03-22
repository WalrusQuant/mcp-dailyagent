"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useModels } from "@/lib/useModels";
import {
  Shield, Eye, EyeOff, Loader2, Check, X, ArrowLeft, Trash2,
  Plus, Star, Pencil, ChevronDown, Power,
} from "lucide-react";
import Link from "next/link";
import type { LLMProvider } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────

interface SettingRow {
  key: string;
  value?: string;
  configured: boolean;
  masked?: string;
  is_encrypted: boolean;
  category: string;
  description: string | null;
  updated_at: string;
}

interface SettingsState {
  settings: SettingRow[];
  envStatus: Record<string, boolean>;
}

interface DbModel {
  id: string;
  model_id: string;
  name: string;
  provider: string;
  description: string;
  type: "chat" | "image";
  context_length: number | null;
  pricing_prompt: number | null;
  pricing_completion: number | null;
  is_default: boolean;
  sort_order: number;
  provider_id: string | null;
  api_model_id: string | null;
}


type StatusType = "db" | "env" | "missing";

// ── StatusBadge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StatusType }) {
  if (status === "db") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
        style={{ background: "var(--accent-positive)", color: "#fff" }}
      >
        <Check className="w-2.5 h-2.5" /> Database
      </span>
    );
  }
  if (status === "env") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
        style={{ background: "#d4a574", color: "#fff" }}
      >
        <Check className="w-2.5 h-2.5" /> Env Fallback
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: "var(--accent-negative, #ef4444)", color: "#fff" }}
    >
      <X className="w-2.5 h-2.5" /> Not Set
    </span>
  );
}

// ── SettingField ───────────────────────────────────────────────────────

interface SettingFieldProps {
  label: string;
  settingKey: string;
  settings: SettingRow[];
  envStatus: Record<string, boolean>;
  isSecret?: boolean;
  testProvider?: string;
  placeholder?: string;
  onSave: (key: string, value: string, category: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  category: string;
}

function SettingField({
  label, settingKey, settings, envStatus, isSecret, testProvider,
  placeholder, onSave, onDelete, category,
}: SettingFieldProps) {
  const existing = settings.find((s) => s.key === settingKey);
  const hasEnvFallback = envStatus[settingKey] || false;
  const status: StatusType = existing?.configured ? "db" : hasEnvFallback ? "env" : "missing";

  const [value, setValue] = useState(existing?.value || "");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isSecret && existing?.value) setValue(existing.value);
  }, [existing, isSecret]);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(settingKey, value.trim(), category);
      if (isSecret) setValue("");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testProvider) return;
    const testKey = value.trim() || undefined;
    if (!testKey && !existing?.configured && !hasEnvFallback) return;
    setTesting(true);
    setTestResult(null);
    try {
      if (!testKey) { setTestResult({ success: false, error: "Enter a key to test" }); return; }
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: testProvider, apiKey: testKey }),
      });
      setTestResult(await res.json());
    } catch {
      setTestResult({ success: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existing?.configured) return;
    setDeleting(true);
    try { await onDelete(settingKey); } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</label>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {existing?.configured && (
            <button onClick={handleDelete} disabled={deleting} className="p-1 rounded transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }} title="Remove (revert to env fallback)">
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      {isSecret && existing?.configured && (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>Current: {existing.masked}</div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={isSecret && !showSecret ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none pr-8"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          />
          {isSecret && (
            <button onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        <button onClick={handleSave} disabled={saving || !value.trim()} className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </button>
        {testProvider && (
          <button onClick={handleTest} disabled={testing} className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
          </button>
        )}
      </div>
      {testResult && (
        <div className="text-xs px-2 py-1 rounded" style={{ color: testResult.success ? "var(--accent-positive)" : "var(--accent-negative, #ef4444)", background: testResult.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
          {testResult.success ? "Connection successful" : testResult.error || "Connection failed"}
        </div>
      )}
    </div>
  );
}

// ── AdminPage ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, chatModels: availableChatModels, refresh } = useModels();

  // App settings state
  const [state, setState] = useState<SettingsState | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provider state
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "", type: "openai-compatible" as LLMProvider["type"],
    base_url: "", api_key_setting: "",
    supports_tools: true, supports_images: false, supports_streaming: true,
  });
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  // Model management state
  const [models, setModels] = useState<DbModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [addType, setAddType] = useState<"chat" | "image">("chat");
  const [isSaving, setIsSaving] = useState(false);
  const [formModelId, setFormModelId] = useState("");
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPricingPrompt, setFormPricingPrompt] = useState("");
  const [formPricingCompletion, setFormPricingCompletion] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formApiModelId, setFormApiModelId] = useState("");

  // Search settings state
  const [searchModel, setSearchModel] = useState("");
  const [savedSearchModel, setSavedSearchModel] = useState("");
  const [searchModelOpen, setSearchModelOpen] = useState(false);
  const searchModelRef = useRef<HTMLDivElement>(null);
  const [searchResultsBasic, setSearchResultsBasic] = useState(10);
  const [savedSearchResultsBasic, setSavedSearchResultsBasic] = useState(10);
  const [searchResultsAdvanced, setSearchResultsAdvanced] = useState(20);
  const [savedSearchResultsAdvanced, setSavedSearchResultsAdvanced] = useState(20);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>(undefined);

  const searchSettingsChanged =
    searchModel !== savedSearchModel ||
    searchResultsBasic !== savedSearchResultsBasic ||
    searchResultsAdvanced !== savedSearchResultsAdvanced;

  // Redirect non-admins
  useEffect(() => {
    if (isAdmin === false) router.push("/settings");
  }, [isAdmin, router]);

  // Close search model dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchModelRef.current && !searchModelRef.current.contains(e.target as Node)) {
        setSearchModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Load data ──

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        if (res.status === 403) { router.push("/settings"); return; }
        throw new Error("Failed to load settings");
      }
      setState(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoadingSettings(false);
    }
  }, [router]);

  const loadProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    try {
      const res = await fetch("/api/admin/providers");
      if (res.ok) setProviders(await res.json());
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setIsLoadingProviders(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const rawRes = await fetch("/api/models/raw");
      if (rawRes.ok) setModels(await rawRes.json());
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  const loadSearchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setSearchModel(data.searchModel || "");
        setSavedSearchModel(data.searchModel || "");
        setSearchResultsBasic(data.searchResultsBasic ?? 10);
        setSavedSearchResultsBasic(data.searchResultsBasic ?? 10);
        setSearchResultsAdvanced(data.searchResultsAdvanced ?? 20);
        setSavedSearchResultsAdvanced(data.searchResultsAdvanced ?? 20);
      }
    } catch (err) {
      console.error("Failed to load search settings:", err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadProviders();
    loadModels();
    loadSearchSettings();
  }, [loadSettings, loadProviders, loadModels, loadSearchSettings]);

  // ── App settings handlers ──

  const handleSaveSetting = async (key: string, value: string, category: string) => {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, category }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Save failed"); }
    await loadSettings();
  };

  const handleDeleteSetting = async (key: string) => {
    const res = await fetch("/api/admin/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Delete failed"); }
    await loadSettings();
  };

  // ── Provider handlers ──

  const resetProviderForm = () => {
    setProviderForm({ name: "", type: "openai-compatible", base_url: "", api_key_setting: "", supports_tools: true, supports_images: false, supports_streaming: true });
    setShowProviderForm(false);
    setEditingProviderId(null);
  };

  const startEditingProvider = (p: LLMProvider) => {
    setEditingProviderId(p.id);
    setProviderForm({
      name: p.name, type: p.type, base_url: p.base_url || "",
      api_key_setting: p.api_key_setting || "",
      supports_tools: p.supports_tools, supports_images: p.supports_images,
      supports_streaming: p.supports_streaming,
    });
    setShowProviderForm(true);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerForm.name || !providerForm.type) return;
    setIsSavingProvider(true);
    try {
      if (editingProviderId) {
        const res = await fetch("/api/admin/providers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProviderId, ...providerForm }),
        });
        if (res.ok) { resetProviderForm(); await loadProviders(); }
      } else {
        const res = await fetch("/api/admin/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(providerForm),
        });
        if (res.ok) { resetProviderForm(); await loadProviders(); }
      }
    } catch (err) { console.error("Failed to save provider:", err); }
    finally { setIsSavingProvider(false); }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers?id=${id}`, { method: "DELETE" });
      if (res.ok) { setProviders((prev) => prev.filter((p) => p.id !== id)); }
    } catch (err) { console.error("Failed to delete provider:", err); }
  };

  const handleToggleProvider = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_enabled: enabled }),
      });
      if (res.ok) {
        setProviders((prev) => prev.map((p) => p.id === id ? { ...p, is_enabled: enabled } : p));
      }
    } catch (err) { console.error("Failed to toggle provider:", err); }
  };

  // ── Model handlers ──

  const resetForm = () => {
    setFormModelId(""); setFormName(""); setFormProvider(""); setFormDescription("");
    setFormPricingPrompt(""); setFormPricingCompletion(""); setFormProviderId(""); setFormApiModelId("");
    setShowModelForm(false); setEditingModelId(null);
  };

  const startEditing = (model: DbModel) => {
    setEditingModelId(model.id);
    setAddType(model.type);
    setFormModelId(model.model_id);
    setFormName(model.name);
    setFormProvider(model.provider);
    setFormDescription(model.description || "");
    setFormPricingPrompt(model.pricing_prompt != null ? String(model.pricing_prompt) : "");
    setFormPricingCompletion(model.pricing_completion != null ? String(model.pricing_completion) : "");
    setFormProviderId(model.provider_id || "");
    setFormApiModelId(model.api_model_id || "");
    setShowModelForm(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModelId || !formName || !formProvider) return;
    setIsSaving(true);
    try {
      if (editingModelId) {
        const res = await fetch("/api/models", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingModelId, model_id: formModelId, name: formName, provider: formProvider,
            description: formDescription,
            pricing_prompt: formPricingPrompt ? parseFloat(formPricingPrompt) : null,
            pricing_completion: formPricingCompletion ? parseFloat(formPricingCompletion) : null,
            provider_id: formProviderId || null,
            api_model_id: formApiModelId || null,
          }),
        });
        if (res.ok) { resetForm(); await loadModels(); await refresh(); }
      } else {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: formModelId, name: formName, provider: formProvider,
            description: formDescription, type: addType,
            pricingPrompt: formPricingPrompt ? parseFloat(formPricingPrompt) : null,
            pricingCompletion: formPricingCompletion ? parseFloat(formPricingCompletion) : null,
            providerId: formProviderId || null,
            apiModelId: formApiModelId || null,
          }),
        });
        if (res.ok) { resetForm(); await loadModels(); await refresh(); }
      }
    } catch (err) {
      console.error("Failed to save model:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    try {
      const res = await fetch(`/api/models?id=${id}`, { method: "DELETE" });
      if (res.ok) { setModels((prev) => prev.filter((m) => m.id !== id)); await refresh(); }
    } catch (err) { console.error("Failed to delete model:", err); }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch("/api/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setDefault: true }),
      });
      if (res.ok) { await loadModels(); await refresh(); }
    } catch (err) { console.error("Failed to set default:", err); }
  };

  // ── Search handlers ──

  const handleSaveSearch = async () => {
    setIsSavingSearch(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchModel: searchModel || null, searchResultsBasic, searchResultsAdvanced }),
      });
      if (res.ok) {
        setSavedSearchModel(searchModel);
        setSavedSearchResultsBasic(searchResultsBasic);
        setSavedSearchResultsAdvanced(searchResultsAdvanced);
        setSearchSaved(true);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => setSearchSaved(false), 2000);
      }
    } catch (err) { console.error("Failed to save search settings:", err); }
    finally { setIsSavingSearch(false); }
  };

  const searchModelLabel = searchModel
    ? availableChatModels.find((m) => m.id === searchModel)?.name || searchModel
    : "None (use raw search)";

  // ── Derived ──

  const chatModelsList = models.filter((m) => m.type === "chat");
  const imageModelsList = models.filter((m) => m.type === "image");

  const getProviderName = (providerId: string | null) => {
    if (!providerId) return null;
    return providers.find((p) => p.id === providerId)?.name || null;
  };

  const renderModelList = (modelList: DbModel[], type: "chat" | "image") => (
    <div className="space-y-2">
      {modelList.map((model) => (
        <div key={model.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{model.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{model.provider}</span>
              {model.is_default && (
                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}>Default</span>
              )}
              {getProviderName(model.provider_id) && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-base)", color: "var(--text-muted)", border: "1px solid var(--border-default)" }}>
                  {getProviderName(model.provider_id)}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {model.api_model_id ? `${model.api_model_id} (${model.model_id})` : model.model_id}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-3">
            {!model.is_default && (
              <button onClick={() => handleSetDefault(model.id)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Set as default">
                <Star className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => startEditing(model)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Edit model">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => handleDeleteModel(model.id)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Remove model">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() => { setAddType(type); setEditingModelId(null); setShowModelForm(true); }}
        className="flex items-center gap-2 px-4 py-3 rounded-xl w-full transition-colors text-sm"
        style={{ border: "1px dashed var(--border-default)", color: "var(--text-muted)" }}
      >
        <Plus className="w-4 h-4" /> Add {type === "chat" ? "chat" : "image"} model
      </button>
    </div>
  );

  // ── Loading / error states ──

  if (isAdmin === undefined || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: "var(--accent-negative, #ef4444)" }}>{error}</p>
      </div>
    );
  }

  if (!state) return null;

  // ── Render ──

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0" style={{ background: "var(--bg-base)" }}>
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 rounded-lg transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Admin Settings</h1>
        </div>
      </div>

      <Link
        href="/admin/usage"
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--accent-primary)" }}
      >
        <Shield className="w-4 h-4" />
        Usage & Limits — View user usage stats and manage rate/cost limits
      </Link>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Configure application settings. Values saved here take priority over environment variables.
        Removing a setting reverts to the env var fallback.
      </p>

      {/* API Keys */}
      <section className="rounded-xl p-5 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>API Keys</h2>
        <SettingField label="OpenRouter API Key" settingKey="openrouter_api_key" settings={state.settings} envStatus={state.envStatus} isSecret testProvider="openrouter" placeholder="sk-or-v1-..." onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="api_keys" />
        <SettingField label="Anthropic API Key" settingKey="anthropic_api_key" settings={state.settings} envStatus={state.envStatus} isSecret testProvider="anthropic" placeholder="sk-ant-..." onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="api_keys" />
        <SettingField label="Google AI API Key" settingKey="google_api_key" settings={state.settings} envStatus={state.envStatus} isSecret testProvider="google" placeholder="AI..." onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="api_keys" />
        <SettingField label="OpenAI API Key" settingKey="openai_api_key" settings={state.settings} envStatus={state.envStatus} isSecret testProvider="openai" placeholder="sk-..." onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="api_keys" />
        <SettingField label="Tavily API Key" settingKey="tavily_api_key" settings={state.settings} envStatus={state.envStatus} isSecret testProvider="tavily" placeholder="tvly-..." onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="api_keys" />
      </section>

      {/* LLM Providers */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>LLM Providers</h2>
        {isLoadingProviders ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} /></div>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", opacity: p.is_enabled ? 1 : 0.6 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{p.type}</span>
                    {!p.is_enabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-negative, #ef4444)", color: "#fff" }}>Disabled</span>
                    )}
                  </div>
                  {p.base_url && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{p.base_url}</p>}
                  {p.api_key_setting && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Key: {p.api_key_setting}</p>}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => handleToggleProvider(p.id, !p.is_enabled)} className="p-2 rounded-lg transition-colors" style={{ color: p.is_enabled ? "var(--accent-positive)" : "var(--text-muted)" }} title={p.is_enabled ? "Disable" : "Enable"}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => startEditingProvider(p)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Edit provider">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteProvider(p.id)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Remove provider">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => { resetProviderForm(); setShowProviderForm(true); }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl w-full transition-colors text-sm"
              style={{ border: "1px dashed var(--border-default)", color: "var(--text-muted)" }}
            >
              <Plus className="w-4 h-4" /> Add provider
            </button>
          </div>
        )}
      </section>

      {/* Chat Models */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Chat Models</h2>
        {isLoadingModels ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} /></div>
        ) : renderModelList(chatModelsList, "chat")}
      </section>

      {/* Image Models */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Image Models</h2>
        {isLoadingModels ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} /></div>
        ) : renderModelList(imageModelsList, "image")}
      </section>

      {/* Search */}
      <section className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Search</h2>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Search Model</label>
          <div ref={searchModelRef} className="relative">
            <button type="button" onClick={() => setSearchModelOpen(!searchModelOpen)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none text-left flex items-center justify-between"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              <span>{searchModelLabel}</span>
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)", transform: searchModelOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
            </button>
            {searchModelOpen && (
              <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <button type="button" onClick={() => { setSearchModel(""); setSearchModelOpen(false); }}
                  className="w-full px-4 py-2.5 text-sm text-left transition-colors"
                  style={{ color: searchModel === "" ? "var(--accent-primary)" : "var(--text-primary)", background: searchModel === "" ? "var(--bg-elevated)" : undefined }}
                >None (use raw search)</button>
                {availableChatModels.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setSearchModel(m.id); setSearchModelOpen(false); }}
                    className="w-full px-4 py-2.5 text-sm text-left transition-colors"
                    style={{ color: searchModel === m.id ? "var(--accent-primary)" : "var(--text-primary)", background: searchModel === m.id ? "var(--bg-elevated)" : undefined }}
                  >{m.name}</button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            A fast model to optimize queries and summarize results before the main model sees them.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Basic search results</label>
            <input type="number" min={1} max={50} value={searchResultsBasic}
              onChange={(e) => setSearchResultsBasic(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Advanced search results</label>
            <input type="number" min={1} max={50} value={searchResultsAdvanced}
              onChange={(e) => setSearchResultsAdvanced(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveSearch} disabled={isSavingSearch || !searchSettingsChanged}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            {isSavingSearch ? <Loader2 className="w-3 h-3 animate-spin" /> : searchSaved ? <><Check className="w-3 h-3" /> Saved</> : "Save"}
          </button>
        </div>
      </section>

      {/* Site Branding */}
      <section className="rounded-xl p-5 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Site Branding</h2>
        <SettingField label="Site Name" settingKey="site_name" settings={state.settings} envStatus={state.envStatus} placeholder="Daily Agent" onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="branding" />
        <SettingField label="Site Description" settingKey="site_description" settings={state.settings} envStatus={state.envStatus} placeholder="Your AI productivity agent" onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="branding" />
      </section>

      {/* Security */}
      <section className="rounded-xl p-5 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Security</h2>
        <SettingField label="Signup Secret" settingKey="signup_secret" settings={state.settings} envStatus={state.envStatus} isSecret placeholder="Access code for new signups" onSave={handleSaveSetting} onDelete={handleDeleteSetting} category="security" />
      </section>
    </div>

    {/* Add/Edit Provider Modal */}
    {showProviderForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {editingProviderId ? "Edit" : "Add"} Provider
            </h3>
            <button onClick={resetProviderForm} className="p-1" style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSaveProvider} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name</label>
              <input type="text" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} placeholder="OpenAI Direct" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
              <select value={providerForm.type} onChange={(e) => setProviderForm({ ...providerForm, type: e.target.value as LLMProvider["type"] })} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            {providerForm.type === "openai-compatible" && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Base URL</label>
                <input type="text" value={providerForm.base_url} onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })} placeholder="https://api.openai.com/v1" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>API Key Setting</label>
              <input type="text" value={providerForm.api_key_setting} onChange={(e) => setProviderForm({ ...providerForm, api_key_setting: e.target.value })} placeholder="openai_api_key" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                References a key in the API Keys section above (e.g., anthropic_api_key)
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Capabilities</label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={providerForm.supports_tools} onChange={(e) => setProviderForm({ ...providerForm, supports_tools: e.target.checked })} />
                  Tools
                </label>
                <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={providerForm.supports_images} onChange={(e) => setProviderForm({ ...providerForm, supports_images: e.target.checked })} />
                  Images
                </label>
                <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={providerForm.supports_streaming} onChange={(e) => setProviderForm({ ...providerForm, supports_streaming: e.target.checked })} />
                  Streaming
                </label>
              </div>
            </div>
            <button type="submit" disabled={isSavingProvider || !providerForm.name}
              className="w-full py-2.5 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {isSavingProvider ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editingProviderId ? "Save Changes" : "Add Provider"}
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Add/Edit Model Modal */}
    {showModelForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {editingModelId ? "Edit" : "Add"} {addType === "chat" ? "Chat" : "Image"} Model
            </h3>
            <button onClick={resetForm} className="p-1" style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSaveModel} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Model ID</label>
              <input type="text" value={formModelId} onChange={(e) => setFormModelId(e.target.value)} placeholder="anthropic/claude-sonnet-4.5" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Internal identifier used in the app (e.g., anthropic/claude-sonnet-4.5)
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Display Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Claude Sonnet 4.5" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Provider Label</label>
              <input type="text" value={formProvider} onChange={(e) => setFormProvider(e.target.value)} placeholder="Anthropic" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>LLM Provider</label>
              <select value={formProviderId} onChange={(e) => setFormProviderId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
                <option value="">Default (first enabled provider)</option>
                {providers.filter((p) => p.is_enabled).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Which provider routes API calls for this model
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>API Model ID (optional)</label>
              <input type="text" value={formApiModelId} onChange={(e) => setFormApiModelId(e.target.value)} placeholder="claude-sonnet-4-5-20250514" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Override the model ID sent to the provider API. Leave blank to use Model ID.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description of the model" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
            </div>
            {addType === "chat" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Prompt $/M tokens</label>
                  <input type="number" step="0.01" value={formPricingPrompt} onChange={(e) => setFormPricingPrompt(e.target.value)} placeholder="3.00" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Completion $/M tokens</label>
                  <input type="number" step="0.01" value={formPricingCompletion} onChange={(e) => setFormPricingCompletion(e.target.value)} placeholder="15.00" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                </div>
              </div>
            )}
            <button type="submit" disabled={isSaving || !formModelId || !formName || !formProvider}
              className="w-full py-2.5 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editingModelId ? "Save Changes" : "Add Model"}
            </button>
          </form>
        </div>
      </div>
    )}
    </div>
  );
}
