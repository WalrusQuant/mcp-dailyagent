"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Send, Square, Loader2, Globe, Download, Paperclip, Bot, MessageSquare as MessageSquareIcon } from "lucide-react";
import { Message } from "./Message";
import { FileAttachment } from "./FileUpload";
import { Message as MessageType } from "@/types/database";
import { withRetry } from "@/lib/retry";
import { FolderOpen } from "lucide-react";
import { calculateCost } from "@/lib/cost";
import { useModelContext } from "@/lib/model-context";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { exportAsMarkdown, exportAsJson, downloadFile, slugify } from "@/lib/export";
import { ToolCallCard } from "./ToolCallCard";
import { ModelSelector } from "./ModelSelector";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  attachments?: FileAttachment[];
  sources?: Array<{ title: string; url: string }>;
}

interface ChatProps {
  conversationId?: string;
  initialModel?: string;
}

const SUGGESTED_PROMPTS = [
  "Write an email",
  "Explain a concept",
  "Help me brainstorm",
  "Summarize something",
];

interface SearchStatus {
  phase: "searching" | "summarizing" | "done" | "thinking" | "timeout";
  sources?: Array<{ title: string; url: string }>;
}

function ThinkingIndicator({ searchStatus }: { searchStatus?: SearchStatus }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isTimeout = searchStatus?.phase === "timeout";
  const isStale = elapsed >= 45;

  const label =
    isTimeout
      ? "Search timed out, generating response..."
      : searchStatus?.phase === "searching"
        ? "Searching the web..."
        : searchStatus?.phase === "summarizing"
          ? "Summarizing results..."
          : isStale
            ? "Still working..."
            : "Thinking...";

  return (
    <div className="py-5 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isStale || isTimeout ? "var(--text-muted)" : "var(--accent-primary)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {label} {elapsed}s
          </span>
        </div>
        {isStale && !searchStatus && (
          <p className="text-xs mt-1.5 ml-4" style={{ color: "var(--text-muted)" }}>
            This is taking longer than usual. You can stop and try again.
          </p>
        )}
        {searchStatus?.sources && searchStatus.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-4">
            {searchStatus.sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded-md transition-opacity hover:opacity-80"
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
    </div>
  );
}

export function Chat({ conversationId, initialModel }: ChatProps) {
  const { chatModels, selectedModel, setSelectedModel } = useModelContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!conversationId);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [webSearchMode, setWebSearchMode] = useState<"off" | "basic" | "advanced">("off");
  const [chatMode, setChatMode] = useState<"agent" | "chat">("agent");
  const [searchStatus, setSearchStatus] = useState<SearchStatus | undefined>(undefined);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string } | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<{ id: string; name: string; arguments: Record<string, unknown> } | null>(null);
  const [toolCallStatus, setToolCallStatus] = useState<"pending" | "approved" | "rejected" | "executing" | "done">("pending");
  const [toolCallResult, setToolCallResult] = useState<{ summary: string } | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullMessageRef = useRef("");
  const streamingConvIdRef = useRef<string | null>(null);
  const searchSourcesRef = useRef<Array<{ title: string; url: string }>>([]);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (initialModel) setSelectedModel(initialModel);
  }, [initialModel, setSelectedModel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showTypingIndicator]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const [msgRes, convRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}/messages`),
        fetch(`/api/conversations/${conversationId}`),
      ]);

      if (msgRes.ok) {
        const data: MessageType[] = await msgRes.json();
        setMessages(
          data.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            promptTokens: m.prompt_tokens ?? undefined,
            completionTokens: m.completion_tokens ?? undefined,
            totalCost: m.total_cost ?? undefined,
            sources: m.sources ?? undefined,
          }))
        );
      }

      if (convRes.ok) {
        const conv = await convRes.json();
        if (conv.project_id) {
          try {
            const projRes = await fetch(`/api/projects/${conv.project_id}`);
            if (projRes.ok) {
              const proj = await projRes.json();
              setProjectInfo({ id: proj.id, name: proj.name });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [conversationId, loadMessages]);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const partialContent = fullMessageRef.current.replace(/\n?\[\[USAGE:[\s\S]*$/, "");
    const convId = streamingConvIdRef.current;
    const sources = searchSourcesRef.current;

    if (partialContent && convId) {
      fetch("/api/messages/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          content: partialContent,
          role: "assistant",
          sources: sources.length > 0 ? sources : undefined,
        }),
      }).catch(console.error);

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: partialContent };
        }
        return updated;
      });
    } else {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }

    fullMessageRef.current = "";
    streamingConvIdRef.current = null;
    searchSourcesRef.current = [];
    setIsLoading(false);
    setShowTypingIndicator(false);
    setSearchStatus(undefined);
    requestInFlightRef.current = false;
  }, []);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (isLoading) cancelStream();
      },
    },
  ]);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  const handleExport = async (format: "markdown" | "json") => {
    setShowExportMenu(false);
    if (!activeConversationId) return;

    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/messages`);
      if (!res.ok) return;
      const msgs = await res.json();

      const conv = {
        id: activeConversationId,
        title: "Conversation",
        model: selectedModel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try to get conversation metadata
      try {
        const convRes = await fetch(`/api/conversations/${activeConversationId}`);
        if (convRes.ok) {
          const convData = await convRes.json();
          conv.title = convData.title || conv.title;
          conv.model = convData.model || conv.model;
          conv.created_at = convData.created_at || conv.created_at;
          conv.updated_at = convData.updated_at || conv.updated_at;
        }
      } catch { /* use defaults */ }

      const slug = slugify(conv.title);
      const date = new Date().toISOString().slice(0, 10);

      if (format === "markdown") {
        const content = exportAsMarkdown(conv, msgs);
        downloadFile(content, `${slug}-${date}.md`, "text/markdown");
      } else {
        const content = exportAsJson(conv, msgs);
        downloadFile(content, `${slug}-${date}.json`, "application/json");
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleToolApprove = async () => {
    if (!pendingToolCall || !activeConversationId) return;
    setToolCallStatus("executing");
    try {
      const res = await fetch("/api/chat/tool-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: pendingToolCall.name, arguments: pendingToolCall.arguments }),
      });
      const data = await res.json();
      setToolCallResult(data.result);
      setToolCallStatus("done");

      // Send follow-up message with tool result so AI can respond
      const toolResultMessage: ChatMessage = {
        role: "assistant",
        content: `[Tool executed: ${pendingToolCall.name}] ${data.result.summary}`,
      };
      setMessages((prev) => [...prev, toolResultMessage]);

      // Reset tool call state after a brief delay
      setTimeout(() => setPendingToolCall(null), 2000);
    } catch (err) {
      console.error("Tool execution failed:", err);
      setToolCallStatus("done");
      setToolCallResult({ summary: "Execution failed" });
    }
  };

  const handleToolReject = () => {
    setToolCallStatus("rejected");
    setTimeout(() => setPendingToolCall(null), 1500);
  };

  const createConversation = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (response.ok) {
        const conversation = await response.json();
        return conversation.id;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
    return null;
  };

  const sendMessage = async (
    convId: string,
    messagesToSend: ChatMessage[],
    userAttachments?: FileAttachment[]
  ) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    streamingConvIdRef.current = convId;
    fullMessageRef.current = "";
    searchSourcesRef.current = [];

    setIsLoading(true);
    setShowTypingIndicator(true);

    try {
      const apiMessages = messagesToSend.map((msg, idx) => {
        if (idx === messagesToSend.length - 1 && userAttachments?.length) {
          const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
            { type: "text", text: msg.content },
          ];

          for (const attachment of userAttachments) {
            if (attachment.type === "image" && attachment.base64) {
              content.push({
                type: "image_url",
                image_url: { url: attachment.base64 },
              });
            }
          }

          return { role: msg.role, content };
        }
        return { role: msg.role, content: msg.content };
      });

      const response = await withRetry(
        () =>
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: apiMessages,
              model: selectedModel,
              conversationId: convId,
              webSearch: webSearchMode !== "off",
              searchDepth: webSearchMode !== "off" ? webSearchMode : undefined,
              mode: chatMode,
            }),
            signal,
          }),
        {
          maxRetries: 3,
          shouldRetry: (error) => {
            if (error instanceof DOMException && error.name === "AbortError") return false;
            return true;
          },
        }
      );

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let fullMessage = "";
      let receivedFirstChunk = false;
      let buffer = ""; // Buffer for parsing search status events
      let lastRenderTime = 0;
      const RENDER_INTERVAL_MS = 30;

      setSearchStatus(undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let searchDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;

        // Parse search status events (delimited by STX \x02 and ETX \x03)
        while (true) {
          const stx = buffer.indexOf("\x02SEARCH:");
          const etx = stx !== -1 ? buffer.indexOf("\x03", stx) : -1;

          if (stx === -1 || etx === -1) break; // No complete event yet

          const eventBody = buffer.slice(stx + 8, etx); // after "\x02SEARCH:"
          const colonIdx = eventBody.indexOf(":");
          const phase = colonIdx !== -1 ? eventBody.slice(0, colonIdx) : eventBody;
          const payload = colonIdx !== -1 ? eventBody.slice(colonIdx + 1) : "";

          let sources: SearchStatus["sources"];
          if (payload) {
            try { sources = JSON.parse(payload); } catch { /* ignore */ }
          }
          if (sources && sources.length > 0) {
            searchSourcesRef.current = sources;
          }

          if (phase === "done") {
            setSearchStatus(undefined);
            searchDone = true;
          } else {
            setSearchStatus({ phase: phase as SearchStatus["phase"], sources });
          }

          // Remove the event from the buffer
          buffer = buffer.slice(0, stx) + buffer.slice(etx + 1);
        }

        // Parse tool call events
        while (true) {
          const toolStx = buffer.indexOf("\x02TOOL_CALL:");
          const toolEtx = toolStx !== -1 ? buffer.indexOf("\x03", toolStx) : -1;
          if (toolStx === -1 || toolEtx === -1) break;

          const json = buffer.slice(toolStx + 11, toolEtx);
          try {
            const toolCall = JSON.parse(json);
            setPendingToolCall(toolCall);
            setToolCallStatus("pending");
            setToolCallResult(undefined);
          } catch { /* ignore parse error */ }

          buffer = buffer.slice(0, toolStx) + buffer.slice(toolEtx + 1);
        }

        // Don't pass content to fullMessage until search events are done
        if (!searchDone && buffer.indexOf("\x02") !== -1) continue;
        if (!searchDone && buffer.length === 0) continue;
        searchDone = true;

        const newContent = buffer.slice(fullMessage.length);
        if (newContent) {
          fullMessage += newContent;
          fullMessageRef.current = fullMessage;

          // Throttled render: update UI at most every 30ms to smooth chunk bursts
          const now = performance.now();
          if (now - lastRenderTime >= RENDER_INTERVAL_MS) {
            lastRenderTime = now;
            const displayContent = fullMessage.replace(/\n?\[\[USAGE:[\s\S]*$/, "");
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: displayContent,
              };
              return updated;
            });
          }
        }

        if (!receivedFirstChunk && fullMessage.length > 0) {
          receivedFirstChunk = true;
          setShowTypingIndicator(false);
        }
      }

      // Final pass — grab any remaining buffer content
      if (buffer.length > fullMessage.length) {
        fullMessage = buffer;
      }

      assistantMessage = fullMessage;

      // Final render with complete content
      const finalContent = fullMessage.replace(/\n?\[\[USAGE:[\s\S]*$/, "");
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: finalContent,
        };
        return updated;
      });

      // Parse usage info
      try {
        const usageMatch = assistantMessage.match(/\n\[\[USAGE:(.*)\]\]$/);
        if (usageMatch) {
          const usage = JSON.parse(usageMatch[1]);
          const cleanContent = assistantMessage.replace(/\n\[\[USAGE:.*\]\]$/, "");
          const currentModel = chatModels.find((m) => m.id === selectedModel);
          const cost = calculateCost(usage.prompt_tokens, usage.completion_tokens, currentModel?.pricing);

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: cleanContent,
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalCost: cost,
              sources: usage.sources,
            };
            return updated;
          });
        }
      } catch {
        // Usage parsing failed
      }

      // Reset web search after use
      setWebSearchMode("off");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setShowTypingIndicator(false);
      setSearchStatus(undefined);
      requestInFlightRef.current = false;
      abortControllerRef.current = null;
      fullMessageRef.current = "";
      const finalConvId = streamingConvIdRef.current;
      streamingConvIdRef.current = null;
      searchSourcesRef.current = [];
      // Targeted title update instead of full sidebar refresh
      if (finalConvId) {
        setTimeout(() => {
          fetch(`/api/conversations/${finalConvId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data?.title && data.title !== "New Chat") {
                window.dispatchEvent(
                  new CustomEvent("conversation-title-updated", {
                    detail: { id: finalConvId, title: data.title },
                  })
                );
              }
            })
            .catch(() => {});
        }, 2000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);

    let convId: string | undefined = activeConversationId;

    // Auto-create conversation if none exists
    if (!convId) {
      const newId = await createConversation();
      convId = newId ?? undefined;
      if (!convId) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Failed to create conversation. Please try again." },
        ]);
        return;
      }
      setActiveConversationId(convId);
      // Update URL without full navigation
      window.history.replaceState(null, "", `/chat/${convId}`);
      // Tell sidebar to refresh
      window.dispatchEvent(new Event("conversations-updated"));
    }

    await sendMessage(convId, newMessages, userMessage.attachments);
  };

  const truncateMessages = async (convId: string, keepCount: number) => {
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepCount }),
      });
    } catch (error) {
      console.error("Failed to truncate messages:", error);
    }
  };

  const handleEdit = async (index: number, newContent: string) => {
    if (!activeConversationId) return;
    // Delete messages from edit point onward in DB
    await truncateMessages(activeConversationId, index);

    const editedMessages = messages.slice(0, index);
    const editedUserMessage: ChatMessage = { role: "user", content: newContent };
    const newMessages = [...editedMessages, editedUserMessage];

    setMessages(newMessages);
    await sendMessage(activeConversationId, newMessages);
  };

  const handleRegenerate = async (index: number) => {
    if (!activeConversationId) return;
    // Delete the assistant message (and anything after) in DB
    await truncateMessages(activeConversationId, index);

    const userMessages = messages.slice(0, index);

    setMessages(userMessages);
    await sendMessage(activeConversationId, userMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;

    e.preventDefault();
    const files = imageItems
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    const processed = await Promise.all(
      files.map(async (file) => {
        if (file.size > 10 * 1024 * 1024) return null;
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        return { id, file, preview: base64, type: "image" as const, base64 };
      })
    );

    const valid: FileAttachment[] = processed.filter((f): f is NonNullable<typeof f> => f !== null);
    if (valid.length > 0) {
      setAttachments((prev) => [...prev, ...valid].slice(0, 5));
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const maxSizeMB = 10;

    const processed = await Promise.all(
      files.map(async (file) => {
        if (file.size > maxSizeMB * 1024 * 1024) return null;
        const isImage = file.type.startsWith("image/");
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        let base64: string | undefined;
        let preview = "";

        if (isImage) {
          const reader = new FileReader();
          const result = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          base64 = result;
          preview = result;
        }

        return { id, file, preview, type: isImage ? "image" : "file", base64 } as FileAttachment;
      })
    );

    const valid = processed.filter((f): f is FileAttachment => f !== null);
    setAttachments((prev) => [...prev, ...valid].slice(0, 5));
    e.target.value = "";
  };

  if (isLoadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      {!hasMessages ? (
        /* Empty state — centered layout */
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <h1
              className="text-2xl md:text-3xl font-semibold text-center mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              What can I help you with?
            </h1>

            {/* Input area */}
            <form onSubmit={handleSubmit}>
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-4">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative flex items-center gap-2 rounded-lg p-1.5"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      {att.type === "image" ? (
                        <Image src={att.preview} alt={att.file.name} width={40} height={40} className="w-10 h-10 object-cover rounded" unoptimized />
                      ) : (
                        <div
                          className="w-10 h-10 flex items-center justify-center rounded text-xs"
                          style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
                        >
                          {att.file.name.split(".").pop()?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs max-w-[80px] truncate" style={{ color: "var(--text-secondary)" }}>
                        {att.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="p-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="rounded-2xl shadow-sm transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Message..."
                  className="w-full bg-transparent resize-none focus:outline-none px-4 pt-4 pb-2 min-h-[56px] max-h-[200px] text-sm"
                  style={{ color: "var(--text-primary)" }}
                  rows={1}
                />
                <div className="flex items-center justify-between px-3 pb-3">
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.txt,.md,.json,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode((m) => m === "agent" ? "chat" : "agent")}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors"
                      style={{
                        color: chatMode === "agent" ? "var(--accent-primary)" : "var(--text-muted)",
                        background: chatMode === "agent" ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent",
                      }}
                      title={`Mode: ${chatMode}`}
                    >
                      {chatMode === "agent" ? <Bot className="w-4 h-4" /> : <MessageSquareIcon className="w-4 h-4" />}
                      <span>{chatMode === "agent" ? "Agent" : "Chat"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebSearchMode((m) => m === "off" ? "basic" : m === "basic" ? "advanced" : "off")}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors"
                      style={{
                        color: webSearchMode !== "off" ? "var(--accent-primary)" : "var(--text-muted)",
                        background: webSearchMode !== "off" ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent",
                      }}
                      title={`Web search: ${webSearchMode}`}
                    >
                      <Globe className="w-4 h-4" />
                      {webSearchMode !== "off" && (
                        <span>{webSearchMode === "basic" ? "Search" : "Deep"}</span>
                      )}
                    </button>
                    <ModelSelector
                      models={chatModels}
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                      variant="pill"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!input.trim() && attachments.length === 0}
                    className="p-2 rounded-lg transition-opacity disabled:opacity-30"
                    style={{
                      background: "var(--accent-primary)",
                      color: "var(--bg-base)",
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Suggested prompts */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="px-3 py-1.5 rounded-full text-sm transition-colors"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <p
              className="text-xs text-center mt-4"
              style={{ color: "var(--text-muted)" }}
            >
              Shift + Enter for new line
            </p>
          </div>
        </div>
      ) : (
        /* Conversation view */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 pt-[env(safe-area-inset-top,0px)] md:pt-0">
            {projectInfo && (
              <button
                onClick={() => router.push(`/projects/${projectInfo.id}`)}
                className="flex items-center gap-1.5 mx-auto mt-3 px-3 py-1 rounded-full text-xs transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--accent-primary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <FolderOpen className="w-3 h-3" />
                {projectInfo.name}
              </button>
            )}
            {messages.map((message, index) => (
              <Message
                key={index}
                role={message.role}
                content={message.content}
                messageIndex={index}
                promptTokens={message.promptTokens}
                completionTokens={message.completionTokens}
                totalCost={message.totalCost}
                modelId={selectedModel}
                sources={message.sources}
                onEdit={message.role === "user" ? handleEdit : undefined}
                onRegenerate={message.role === "assistant" ? handleRegenerate : undefined}
                isStreaming={isLoading && index === messages.length - 1}
              />
            ))}
            {showTypingIndicator && <ThinkingIndicator searchStatus={searchStatus} />}
            {pendingToolCall && (
              <div className="py-3 px-4">
                <div className="max-w-3xl mx-auto">
                  <ToolCallCard
                    toolCall={pendingToolCall}
                    onApprove={handleToolApprove}
                    onReject={handleToolReject}
                    status={toolCallStatus}
                    result={toolCallResult}
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 md:p-4 shrink-0" style={{ borderTop: "1px solid var(--border-default)" }}>
            {/* Export button — hidden, TODO: relocate to conversation menu */}
            {false && activeConversationId && (
              <div className="max-w-3xl mx-auto flex justify-end mb-2">
                <div ref={exportMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((p) => !p)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    title="Export conversation"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {showExportMenu && (
                    <div
                      className="absolute bottom-full right-0 mb-1 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <button
                        onClick={() => handleExport("markdown")}
                        className="w-full text-left px-3 py-2 text-sm transition-colors"
                        style={{ color: "var(--text-primary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => handleExport("json")}
                        className="w-full text-left px-3 py-2 text-sm transition-colors"
                        style={{ color: "var(--text-primary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative flex items-center gap-2 rounded-lg p-1.5"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      {att.type === "image" ? (
                        <Image src={att.preview} alt={att.file.name} width={40} height={40} className="w-10 h-10 object-cover rounded" unoptimized />
                      ) : (
                        <div
                          className="w-10 h-10 flex items-center justify-center rounded text-xs"
                          style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
                        >
                          {att.file.name.split(".").pop()?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs max-w-[80px] truncate" style={{ color: "var(--text-secondary)" }}>
                        {att.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="p-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="rounded-2xl shadow-sm transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {/* Context chips */}
                {hasMessages && projectInfo && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/projects/${projectInfo.id}`)}
                      className="px-2 py-0.5 rounded-full text-xs transition-colors"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                    >
                      {projectInfo.name}
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Message..."
                  className="w-full bg-transparent resize-none focus:outline-none px-4 pt-3 pb-1 min-h-[44px] max-h-[200px] text-sm"
                  style={{ color: "var(--text-primary)" }}
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.txt,.md,.json,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="p-2 rounded-lg transition-colors disabled:opacity-50"
                      style={{ color: "var(--text-muted)" }}
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode((m) => m === "agent" ? "chat" : "agent")}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                      style={{
                        color: chatMode === "agent" ? "var(--accent-primary)" : "var(--text-muted)",
                        background: chatMode === "agent" ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent",
                      }}
                      title={`Mode: ${chatMode}`}
                    >
                      {chatMode === "agent" ? <Bot className="w-4 h-4" /> : <MessageSquareIcon className="w-4 h-4" />}
                      <span>{chatMode === "agent" ? "Agent" : "Chat"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebSearchMode((m) => m === "off" ? "basic" : m === "basic" ? "advanced" : "off")}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                      style={{
                        color: webSearchMode !== "off" ? "var(--accent-primary)" : "var(--text-muted)",
                        background: webSearchMode !== "off" ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "transparent",
                      }}
                      title={`Web search: ${webSearchMode}`}
                    >
                      <Globe className="w-4 h-4" />
                      {webSearchMode !== "off" && (
                        <span>{webSearchMode === "basic" ? "Search" : "Deep"}</span>
                      )}
                    </button>
                    <ModelSelector
                      models={chatModels}
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                      variant="pill"
                    />
                  </div>
                  <button
                    type={isLoading ? "button" : "submit"}
                    onClick={isLoading ? cancelStream : undefined}
                    disabled={!isLoading && !input.trim() && attachments.length === 0}
                    className="p-2 rounded-lg transition-opacity disabled:opacity-30"
                    style={{
                      background: "var(--accent-primary)",
                      color: "var(--bg-base)",
                    }}
                    title={isLoading ? "Stop" : "Send"}
                  >
                    {isLoading ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
