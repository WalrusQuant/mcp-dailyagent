interface ExportMessage {
  role: string;
  content: string;
  created_at?: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_cost?: number | null;
  sources?: Array<{ title: string; url: string }> | null;
}

interface ExportConversation {
  id: string;
  title: string;
  model?: string;
  created_at: string;
  updated_at: string;
}

export function exportAsMarkdown(
  conversation: ExportConversation,
  messages: ExportMessage[]
): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    "",
    `**Model:** ${conversation.model || "Unknown"}`,
    `**Date:** ${new Date(conversation.created_at).toLocaleDateString()}`,
    "",
    "---",
    "",
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "You" : "Assistant";
    const timestamp = msg.created_at
      ? new Date(msg.created_at).toLocaleString()
      : "";

    lines.push(`**${role}**${timestamp ? ` (${timestamp})` : ""}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function exportAsJson(
  conversation: ExportConversation,
  messages: ExportMessage[]
): string {
  return JSON.stringify(
    {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        prompt_tokens: m.prompt_tokens,
        completion_tokens: m.completion_tokens,
        total_cost: m.total_cost,
        sources: m.sources,
      })),
      exported_at: new Date().toISOString(),
    },
    null,
    2
  );
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
