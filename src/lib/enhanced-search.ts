import { complete } from "@/lib/llm";
import { searchWeb, type SearchDepth, type TavilySearchResult } from "@/lib/tavily";

interface EnhancedSearchResult {
  brief: string;
  sources: Array<{ title: string; url: string }>;
}

export async function enhancedWebSearch(
  userMessage: string,
  searchModel: string,
  depth: SearchDepth = "basic",
  maxResults = 10,
  conversationContext?: Array<{ role: string; content: string }>
): Promise<EnhancedSearchResult> {
  // Build context from recent conversation (last 6 messages max, excluding the current one)
  let contextBlock = "";
  if (conversationContext && conversationContext.length > 0) {
    const recent = conversationContext.slice(-6);
    contextBlock = recent
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
      .join("\n");
  }

  // Step 1: Generate 2 optimized search queries
  const queryResponse = await complete(searchModel, {
    messages: [
      {
        role: "system",
        content:
          `You are a search query optimizer. Given the user's latest message and the recent conversation context, generate exactly 2 diverse search queries that will find the most relevant and comprehensive information.

Rules:
- Resolve pronouns and references using the conversation context (e.g., "they" → the specific entity discussed)
- Include specific names, topics, and entities from the conversation
- Make queries specific and searchable — not vague or conversational
- Return ONLY a JSON array of 2 strings, no other text`,
      },
      {
        role: "user",
        content: contextBlock
          ? `Conversation context:\n${contextBlock}\n\nLatest message: ${userMessage}`
          : userMessage,
      },
    ],
    max_tokens: 200,
  });

  const queryTextRaw = queryResponse.content?.trim() || "";
  // Strip markdown code fences if present
  const queryText = queryTextRaw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  let queries: string[];
  try {
    queries = JSON.parse(queryText);
    if (!Array.isArray(queries) || queries.length === 0) {
      queries = [userMessage];
    }
    queries = queries.slice(0, 2).map(String);
  } catch {
    console.error("[enhanced-search] Failed to parse queries, raw response:", queryTextRaw);
    queries = [userMessage];
  }

  // Step 2: Run parallel Tavily searches
  const searchPromises = queries.map((q) => searchWeb(q, depth, maxResults));
  const searchResults = await Promise.allSettled(searchPromises);

  // Collect and dedup results by URL
  const seen = new Set<string>();
  const allResults: TavilySearchResult[] = [];
  for (const result of searchResults) {
    if (result.status === "fulfilled") {
      for (const r of result.value.results) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    }
  }

  if (allResults.length === 0) {
    return { brief: "", sources: [] };
  }

  // Step 3: Summarize results into a research brief
  const resultsText = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");

  const briefResponse = await complete(searchModel, {
    messages: [
      {
        role: "system",
        content: `You are a research assistant. Synthesize the search results below into a concise research brief that directly addresses the user's question. Do NOT include any URLs or links. Just provide a clear factual summary. Focus on the most relevant facts and information. Keep the brief focused and under 800 words.`,
      },
      {
        role: "user",
        content: `User's question: ${userMessage}\n\nSearch Results:\n${resultsText}`,
      },
    ],
    max_tokens: 2000,
  });

  const brief = briefResponse.content?.trim() || "";
  const sources = allResults.map((r) => ({ title: r.title, url: r.url }));

  return { brief, sources };
}
