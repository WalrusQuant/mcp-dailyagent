"use client";

import { useState } from "react";
import { User, Key, Plug, CreditCard, Palette, AlertTriangle } from "lucide-react";
import { AccountTab } from "./AccountTab";
import { ApiKeysTab } from "./ApiKeysTab";
import { ConnectionsTab } from "./ConnectionsTab";
import { SubscriptionTab } from "./SubscriptionTab";
import { PreferencesTab } from "./PreferencesTab";
import { DangerZoneTab } from "./DangerZoneTab";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "connections", label: "Connections", icon: Plug },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>("account");

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        <h1
          className="text-xl font-semibold mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Settings
        </h1>

        {/* Tab Navigation */}
        <div
          className="flex gap-1 mb-6 overflow-x-auto no-scrollbar rounded-lg p-1"
          style={{ background: "var(--bg-surface)" }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  color: isActive
                    ? tab.id === "danger"
                      ? "var(--accent-negative)"
                      : "var(--accent-primary)"
                    : "var(--text-muted)",
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div
          className="rounded-lg p-6"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          {activeTab === "account" && <AccountTab />}
          {activeTab === "api-keys" && <ApiKeysTab />}
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "subscription" && <SubscriptionTab />}
          {activeTab === "preferences" && <PreferencesTab />}
          {activeTab === "danger" && <DangerZoneTab />}
        </div>
      </div>
    </div>
  );
}
