"use client";

import { useState } from "react";
import { Copy, Terminal, Monitor, Laptop } from "lucide-react";

const MCP_ENDPOINT = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`
  : "https://dailyagent.dev/api/mcp";

export function ConnectionsTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeCodeConfig = JSON.stringify(
    {
      mcpServers: {
        "daily-agent": {
          url: MCP_ENDPOINT,
          headers: {
            Authorization: "Bearer YOUR_API_KEY",
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          MCP Connections
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Connect your AI client to Daily Agent via MCP. Generate an API key first, then follow the instructions for your client.
        </p>
      </div>

      {/* MCP Endpoint */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          MCP Endpoint
        </label>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 text-sm px-3 py-2 rounded font-mono"
            style={{
              background: "var(--bg-base)",
              color: "var(--accent-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {MCP_ENDPOINT}
          </code>
          <button
            onClick={() => handleCopy(MCP_ENDPOINT, "endpoint")}
            className="p-2 rounded-lg transition-colors"
            style={{ color: copied === "endpoint" ? "var(--accent-positive)" : "var(--text-muted)" }}
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Claude Code */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Claude Code
          </h3>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Add this to your <code className="px-1 rounded" style={{ background: "var(--bg-base)" }}>settings.json</code> or project <code className="px-1 rounded" style={{ background: "var(--bg-base)" }}>.mcp.json</code>:
        </p>
        <div className="relative">
          <pre
            className="text-xs p-3 rounded font-mono overflow-x-auto"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {claudeCodeConfig}
          </pre>
          <button
            onClick={() => handleCopy(claudeCodeConfig, "claude-code")}
            className="absolute top-2 right-2 p-1.5 rounded transition-colors"
            style={{
              background: "var(--bg-elevated)",
              color: copied === "claude-code" ? "var(--accent-positive)" : "var(--text-muted)",
            }}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Replace <code className="px-1 rounded" style={{ background: "var(--bg-base)" }}>YOUR_API_KEY</code> with your actual API key from the API Keys tab.
        </p>
      </div>

      {/* Claude Desktop */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Claude Desktop
          </h3>
        </div>
        <ol className="text-xs space-y-2" style={{ color: "var(--text-muted)" }}>
          <li>1. Open Claude Desktop → Settings → Connectors</li>
          <li>2. Click &quot;Add Connector&quot;</li>
          <li>3. Enter the MCP endpoint URL above</li>
          <li>4. Authenticate when prompted (or use API key)</li>
        </ol>
      </div>

      {/* Generic / Other */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Laptop className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Other MCP Clients
          </h3>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Any MCP-compatible client can connect using:
        </p>
        <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
          <li>Endpoint: <code className="px-1 rounded" style={{ background: "var(--bg-base)", color: "var(--accent-primary)" }}>{MCP_ENDPOINT}</code></li>
          <li>Transport: Streamable HTTP</li>
          <li>Auth: Bearer token (API key or OAuth)</li>
        </ul>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        MCP connections will be fully operational once the MCP server is built in Phase 6.
      </p>
    </div>
  );
}
