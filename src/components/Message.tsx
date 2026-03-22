"use client";

import { Copy, Check, Pencil, RefreshCw, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { UsageDisplay } from "./UsageDisplay";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  messageIndex?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  modelId?: string;
  onEdit?: (index: number, newContent: string) => void;
  onRegenerate?: (index: number) => void;
  isStreaming?: boolean;
  sources?: Array<{ title: string; url: string }>;
}

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  const isInline = !match && !String(children).includes("\n");

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-sm"
        style={{ background: "var(--inline-code-bg)", color: "var(--text-primary)" }}
        {...props}
      >
        {children}
      </code>
    );
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeString);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div
        className="flex items-center justify-between px-4 py-2 rounded-t-lg"
        style={{
          background: "var(--code-header-bg)",
          border: "1px solid var(--border-default)",
          borderBottom: "none",
        }}
      >
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {language || "code"}
        </span>
        <button
          onClick={copyCode}
          className="transition-colors"
          style={{ color: "var(--text-muted)" }}
          title="Copy code"
        >
          {codeCopied ? (
            <Check className="w-4 h-4" style={{ color: "var(--accent-positive)" }} />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <pre
        className="p-4 rounded-b-lg overflow-x-auto"
        style={{
          background: "var(--code-bg)",
          border: "1px solid var(--border-default)",
          borderTop: "none",
        }}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function SourcesToggle({ sources }: { sources: Array<{ title: string; url: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {sources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-md hover:opacity-80 transition-opacity"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--accent-primary)",
              }}
            >
              {source.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeMarkdown(text: string): string {
  // Fix numbered lists where the number is on its own line followed by content.
  // AI models often output "1.\n\n**Title**\n\ncontent" which CommonMark parses as
  // an empty list item + separate paragraphs. Join them into a single line.
  // Also handles "1.\nTitle" (single newline variant).
  return text.replace(/^(\d+\.)\s*\n\n+/gm, "$1 ");
}

function stripTrailingSources(text: string): string {
  // Remove trailing "Sources:" section that the AI may include
  return text.replace(/\n*(?:#{1,3}\s*)?Sources?:?\s*\n[\s\S]*$/i, "").trimEnd();
}

function linkifyCitations(text: string, sources: Array<{ title: string; url: string }>): string {
  if (!sources || sources.length === 0) return text;
  // Replace [1], [2], etc. with markdown links
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    if (idx >= 0 && idx < sources.length) {
      return `[${num}](${sources[idx].url})`;
    }
    return match;
  });
}

export function Message({
  role,
  content,
  messageIndex,
  promptTokens,
  completionTokens,
  totalCost,
  modelId,
  onEdit,
  onRegenerate,
  isStreaming,
  sources,
}: MessageProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (onEdit && messageIndex !== undefined && editContent.trim() !== content) {
      onEdit(messageIndex, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    if (onRegenerate && messageIndex !== undefined) {
      onRegenerate(messageIndex);
    }
  };

  const isUser = role === "user";

  return (
    <div className="group py-5 px-4">
      <div className="max-w-3xl mx-auto">
        {/* User messages: right-aligned with subtle background */}
        {isUser ? (
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              {isEditing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded-2xl px-4 py-3 resize-none focus:outline-none min-h-[100px] text-sm"
                    style={{
                      background: "var(--bg-user-message)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--accent-primary)",
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                      style={{
                        background: "var(--accent-primary)",
                        color: "var(--bg-base)",
                      }}
                    >
                      Save & Regenerate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                    style={{
                      background: "var(--bg-user-message)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {content}
                  </div>
                  {onEdit && !isEditing && (
                    <div data-touch-action="message" className="absolute -bottom-7 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <button
                        onClick={handleEdit}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Edit message"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Assistant messages: left-aligned, clean text */
          <div>
            <div className="prose prose-sm max-w-none leading-relaxed" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: CodeBlock,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table
                        className="min-w-full rounded-lg"
                        style={{ border: "1px solid var(--border-default)" }}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th
                      className="px-4 py-2 text-left"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      className="px-4 py-2"
                      style={{ borderBottom: "1px solid var(--border-default)" }}
                    >
                      {children}
                    </td>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-primary)" }}
                      className="hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      className="pl-4 my-3 italic"
                      style={{
                        borderLeft: "4px solid var(--accent-primary)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="pl-1">{children}</li>
                  ),
                  h1: ({ children }) => (
                    <h1
                      className="text-xl font-bold mt-4 mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2
                      className="text-lg font-bold mt-3 mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3
                      className="text-base font-bold mt-3 mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => <p className="my-2">{children}</p>,
                  hr: () => (
                    <hr className="my-4" style={{ borderColor: "var(--border-default)" }} />
                  ),
                }}
              >
                {sources && sources.length > 0 ? normalizeMarkdown(stripTrailingSources(linkifyCitations(content, sources))) : normalizeMarkdown(content)}
              </ReactMarkdown>
            </div>

            {/* Usage + actions row */}
            {!isStreaming && content && (
              <div
                className="flex items-center justify-between mt-3 pt-2"
                style={{ borderTop: "1px solid var(--border-default)" }}
              >
                {(promptTokens || completionTokens) ? (
                  <UsageDisplay
                    promptTokens={promptTokens || 0}
                    completionTokens={completionTokens || 0}
                    totalCost={totalCost || 0}
                    modelId={modelId}
                  />
                ) : <div />}
                <div data-touch-action="message" className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    title="Copy"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5" style={{ color: "var(--accent-positive)" }} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {onRegenerate && (
                    <button
                      onClick={handleRegenerate}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sources */}
            {sources && sources.length > 0 && (
              <SourcesToggle sources={sources} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
