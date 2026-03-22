import { createClient } from "@/lib/supabase/server";
import { complete, streamComplete } from "@/lib/llm";
import type { LLMMessage, LLMToolDefinition } from "@/lib/llm";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { NextRequest } from "next/server";
import { calculateCost } from "@/lib/cost";
import { getTitleModel } from "@/lib/models";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";
import { PRODUCTIVITY_TOOLS, TOOL_SYSTEM_INSTRUCTIONS, READ_ONLY_TOOLS, SEARCH_TOOLS, SEARCH_TOOL_INSTRUCTIONS } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/executor";

type MessageContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, model, conversationId, webSearch, searchDepth, mode } = (await request.json()) as {
      messages: ChatMessage[];
      model: string;
      conversationId: string;
      webSearch?: boolean;
      searchDepth?: "basic" | "advanced";
      mode?: "agent" | "chat";
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify conversation belongs to user and get project/prompt info
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, project_id, system_prompt")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!model) {
      return new Response(
        JSON.stringify({ error: "Model is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate model exists in app_models and get pricing
    const { data: dbModel } = await supabase
      .from("app_models")
      .select("model_id, pricing_prompt, pricing_completion")
      .eq("model_id", model)
      .eq("type", "chat")
      .single();

    if (!dbModel) {
      return new Response(
        JSON.stringify({ error: "Invalid model" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const pricing =
      dbModel?.pricing_prompt != null && dbModel?.pricing_completion != null
        ? { prompt: Number(dbModel.pricing_prompt), completion: Number(dbModel.pricing_completion) }
        : undefined;

    // Get user's profile (system prompt + search settings + context injection + admin check)
    const { data: profile } = await supabase
      .from("profiles")
      .select("system_prompt, search_model, search_results_basic, search_results_advanced, memory_notes, is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.is_admin === true;

    // Rate limiting — check BEFORE saving user message to avoid orphaned rows
    const rateLimited = checkRateLimit(user.id, "chat", isAdmin);
    if (rateLimited) return rateLimited;

    // Usage limits — check BEFORE saving user message
    const limits = await checkUsageLimits(supabase, user.id, isAdmin);
    if (limits.blocked) return usageLimitResponse(limits.reason!);

    // Save user message to database
    const userMessage = messages[messages.length - 1];
    const userContent =
      typeof userMessage.content === "string"
        ? userMessage.content
        : userMessage.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join(" ");

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: userMessage.role,
      content: userContent,
    });

    // Update conversation's updated_at and model
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        model: model,
      })
      .eq("id", conversationId);

    // Build layered system prompt: Project context > Conversation prompt > Profile prompt > Default
    let projectContext = "";
    if (conversation.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("system_prompt")
        .eq("id", conversation.project_id)
        .single();

      if (project?.system_prompt) {
        projectContext = `## Project Context\n${project.system_prompt}\n\n`;
      }
    }

    const corePrompt = conversation.system_prompt || profile?.system_prompt || SYSTEM_PROMPT;

    // Inject memory notes if set
    const memoryBlock = profile?.memory_notes ? "## About the User\n" + profile.memory_notes + "\n\n" : "";

    const basePrompt = memoryBlock + projectContext + corePrompt;
    const encoder = new TextEncoder();

    // We need to do search inside the stream so we can send status events
    let searchContext = "";
    let searchSources: Array<{ title: string; url: string }> = [];
    // Check if Tavily is configured (tavily.ts will read from DB/env via getConfig)
    const { getConfig: getAppConfig } = await import("@/lib/app-config");
    const tavilyConfigured = !!(await getAppConfig("tavily_api_key"));
    const doSearch = webSearch && tavilyConfigured;

    let fullResponse = "";
    let usage: { prompt_tokens: number; completion_tokens: number } | null =
      null;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Web search phase (sends status events to client, 30s timeout)
          if (doSearch) {
            const SEARCH_TIMEOUT_MS = 30_000;
            const depth = searchDepth || "basic";
            const maxResults = depth === "advanced"
              ? (profile?.search_results_advanced ?? 20)
              : (profile?.search_results_basic ?? 10);

            controller.enqueue(encoder.encode("\x02SEARCH:searching\x03"));

            const searchWithTimeout = async () => {
              if (profile?.search_model) {
                const { enhancedWebSearch } = await import("@/lib/enhanced-search");

                const priorMessages = messages.slice(0, -1).map((m) => ({
                  role: m.role,
                  content: typeof m.content === "string"
                    ? m.content
                    : (m.content as Array<{ type: string; text?: string }>)
                        .filter((c) => c.type === "text")
                        .map((c) => c.text || "")
                        .join(" "),
                }));

                const { searchWeb } = await import("@/lib/tavily");
                const rawResults = await searchWeb(userContent, depth, maxResults);
                searchSources = rawResults.results.map((r) => ({ title: r.title, url: r.url }));

                controller.enqueue(encoder.encode(`\x02SEARCH:summarizing:${JSON.stringify(searchSources)}\x03`));

                const result = await enhancedWebSearch(userContent, profile.search_model, depth, maxResults, priorMessages);
                if (result.brief) {
                  searchContext = `\n\n## Research Brief\n\n${result.brief}`;
                }
                searchSources = result.sources;
              } else {
                const { searchWeb, formatSearchResultsForPrompt } = await import("@/lib/tavily");
                const searchResults = await searchWeb(userContent, depth, maxResults);
                searchContext = formatSearchResultsForPrompt(searchResults.results, searchResults.answer);
                searchSources = searchResults.results.map((r) => ({ title: r.title, url: r.url }));
              }
            };

            try {
              await Promise.race([
                searchWithTimeout(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("Search timed out")), SEARCH_TIMEOUT_MS)
                ),
              ]);
            } catch (err) {
              console.error("Web search failed:", err);
              controller.enqueue(encoder.encode("\x02SEARCH:timeout\x03"));
            }

            controller.enqueue(encoder.encode(`\x02SEARCH:done:${JSON.stringify(searchSources)}\x03`));
          }

          // Build system prompt with search context and tool instructions
          const productivityToolsEnabled = mode !== "chat";
          const toolInstructions = productivityToolsEnabled
            ? "\n\n" + TOOL_SYSTEM_INSTRUCTIONS + "\n\n" + SEARCH_TOOL_INSTRUCTIONS
            : "\n\n" + SEARCH_TOOL_INSTRUCTIONS;
          const systemContent = searchContext
            ? basePrompt + searchContext + toolInstructions
            : basePrompt + toolInstructions;
          const messagesWithSystem: LLMMessage[] = [
            { role: "system", content: systemContent },
            ...(messages as LLMMessage[]),
          ];

          const tools = productivityToolsEnabled
            ? ([...PRODUCTIVITY_TOOLS, ...SEARCH_TOOLS] as LLMToolDefinition[])
            : (SEARCH_TOOLS as LLMToolDefinition[]);

          const makeStreamRequest = async (msgs: LLMMessage[]) => {
            return streamComplete(model, {
              messages: msgs,
              max_tokens: 8200,
              tools,
            });
          };

          let currentMessages = messagesWithSystem;
          let continueLoop = true;

          while (continueLoop) {
            continueLoop = false;
            const response = await makeStreamRequest(currentMessages);

            // Accumulate tool calls across chunks
            const pendingToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

            for await (const chunk of response) {
              if (chunk.content) {
                fullResponse += chunk.content;
                controller.enqueue(encoder.encode(chunk.content));
              }

              // Accumulate tool calls
              if (chunk.tool_calls) {
                for (const tc of chunk.tool_calls) {
                  const idx = tc.index;
                  if (!pendingToolCalls.has(idx)) {
                    pendingToolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
                  }
                  const entry = pendingToolCalls.get(idx)!;
                  if (tc.id) entry.id = tc.id;
                  if (tc.function?.name) entry.name = tc.function.name;
                  if (tc.function?.arguments) entry.arguments += tc.function.arguments;
                }
              }

              // Capture usage from the final chunk
              if (chunk.usage) {
                usage = {
                  prompt_tokens: chunk.usage.prompt_tokens,
                  completion_tokens: chunk.usage.completion_tokens,
                };
              }

              // Process tool calls when stream signals tool_calls finish reason
              if (chunk.finish_reason === "tool_calls") {
                for (const [, tc] of pendingToolCalls) {
                  let parsedArgs: Record<string, unknown> = {};
                  try { parsedArgs = JSON.parse(tc.arguments); } catch { /* empty */ }

                  if (READ_ONLY_TOOLS.has(tc.name)) {
                    // Auto-execute read-only tools, feed result back to model
                    const result = await executeTool(supabase, user.id, tc.name, parsedArgs, {
                      searchModel: profile?.search_model || undefined,
                    });
                    currentMessages = [
                      ...currentMessages,
                      { role: "assistant" as const, content: "", tool_calls: [{ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.arguments } }] },
                      { role: "tool" as const, content: JSON.stringify(result), tool_call_id: tc.id, name: tc.name },
                    ];
                    continueLoop = true;
                  } else {
                    // Send mutation tool call to client for approval
                    controller.enqueue(
                      encoder.encode(
                        `\x02TOOL_CALL:${JSON.stringify({ id: tc.id, name: tc.name, arguments: parsedArgs })}\x03`
                      )
                    );
                  }
                }
              }
            }
          }

          // Calculate cost
          const cost = usage
            ? calculateCost(usage.prompt_tokens, usage.completion_tokens, pricing)
            : 0;

          // Save assistant message with token info after stream completes
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullResponse,
            prompt_tokens: usage?.prompt_tokens || null,
            completion_tokens: usage?.completion_tokens || null,
            total_cost: cost || null,
            sources: searchSources.length > 0 ? searchSources : null,
          });

          // Send usage info at the end of stream
          if (usage) {
            controller.enqueue(
              encoder.encode(
                `\n[[USAGE:${JSON.stringify({
                  prompt_tokens: usage.prompt_tokens,
                  completion_tokens: usage.completion_tokens,
                  sources: searchSources.length > 0 ? searchSources : undefined,
                })}]]`
              )
            );
          }

          // Generate AI title if conversation is still "New Chat"
          const { data: conv } = await supabase
            .from("conversations")
            .select("title")
            .eq("id", conversationId)
            .single();

          if (conv?.title === "New Chat" && userContent) {
            // Fire-and-forget title generation
            generateTitle(conversationId, userContent, fullResponse).catch(
              (err) => console.error("Title generation failed:", err)
            );
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An error occurred";
          console.error("Stream error:", error);
          try {
            controller.enqueue(encoder.encode(`\x02ERROR:${errorMessage}\x03`));
            controller.close();
          } catch {
            // Controller may already be closed
            controller.error(error);
          }
        }
      },
    });

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    };
    if (limits.warning) {
      responseHeaders["X-Usage-Warning"] = "true";
    }

    return new Response(stream, { headers: responseHeaders });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function generateTitle(
  conversationId: string,
  userMessage: string,
  assistantMessage: string
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const titleModel = await getTitleModel();

  const response = await complete(titleModel, {
    messages: [
      {
        role: "system",
        content:
          "Generate a concise 3-6 word title for this conversation. Return ONLY the title, no quotes, no punctuation at the end.",
      },
      {
        role: "user",
        content: `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantMessage.slice(0, 200)}`,
      },
    ],
    max_tokens: 20,
  });

  const title = response.content?.trim();
  if (title) {
    await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);
  }
}
