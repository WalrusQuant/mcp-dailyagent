export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  results: TavilySearchResult[];
  answer: string | null;
  query: string;
}

export type SearchDepth = "basic" | "advanced";

export async function searchWeb(
  query: string,
  depth: SearchDepth = "basic",
  maxResults = 10
): Promise<TavilyResponse> {
  maxResults = Math.max(1, Math.min(50, maxResults));
  const { getConfig } = await import("@/lib/app-config");
  const apiKey = await getConfig("tavily_api_key");
  if (!apiKey) {
    throw new Error("Tavily API key is not configured. Set it in Admin Settings or add TAVILY_API_KEY to .env.local.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: depth,
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${errorText}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    answer: data.answer || null,
    query: data.query || query,
  };
}

export function formatSearchResultsForPrompt(
  results: TavilySearchResult[],
  answer?: string | null
): string {
  if (results.length === 0) return "";

  const formatted = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join("\n\n");

  let prompt = `\n\n## Web Search Results\n\nUse these results to inform your response. Do not include any URLs or links in your response.\n\n`;

  if (answer) {
    prompt += `### Quick Summary\n${answer}\n\n### Sources\n`;
  }

  prompt += formatted;
  return prompt;
}
