import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const model = searchParams.get("model");
  const projectId = searchParams.get("projectId");
  const advanced = searchParams.get("advanced") === "true";

  if (!query) {
    return NextResponse.json({ conversations: [], messageMatches: [] });
  }

  // Search conversations by title (ILIKE — titles are short)
  let titleQuery = supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .ilike("title", `%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (model) titleQuery = titleQuery.eq("model", model);
  if (projectId) titleQuery = titleQuery.eq("project_id", projectId);
  if (dateFrom) titleQuery = titleQuery.gte("created_at", dateFrom);
  if (dateTo) titleQuery = titleQuery.lte("created_at", dateTo + "T23:59:59");

  const { data: conversationsByTitle } = await titleQuery;

  // For basic sidebar search, return just conversations
  if (!advanced) {
    // Also search messages by content to find more conversations
    const { data: messageMatches } = await supabase
      .from("messages")
      .select("conversation_id, content")
      .ilike("content", `%${query}%`)
      .limit(50);

    const conversationIds = [
      ...new Set(messageMatches?.map((m) => m.conversation_id) || []),
    ];

    let conversationsByMessages: typeof conversationsByTitle = [];
    if (conversationIds.length > 0) {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });
      conversationsByMessages = data || [];
    }

    const seenIds = new Set<string>();
    const conversations = [];

    for (const conv of conversationsByTitle || []) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        conversations.push(conv);
      }
    }
    for (const conv of conversationsByMessages || []) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        conversations.push(conv);
      }
    }

    conversations.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json({ conversations: conversations.slice(0, 20) });
  }

  // Advanced search: Full-text search on message content using raw SQL via RPC
  // Build the FTS query using Supabase's textSearch
  let convFilter = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id);

  if (model) convFilter = convFilter.eq("model", model);
  if (projectId) convFilter = convFilter.eq("project_id", projectId);
  if (dateFrom) convFilter = convFilter.gte("created_at", dateFrom);
  if (dateTo) convFilter = convFilter.lte("created_at", dateTo + "T23:59:59");

  const { data: userConvs } = await convFilter;
  const convIds = (userConvs || []).map((c) => c.id);

  if (convIds.length === 0) {
    return NextResponse.json({
      conversations: conversationsByTitle || [],
      messageMatches: [],
    });
  }

  // Use Supabase's textSearch for FTS
  const { data: ftsMessages } = await supabase
    .from("messages")
    .select("id, conversation_id, content, role, created_at")
    .in("conversation_id", convIds)
    .textSearch("content", query, { type: "plain", config: "english" })
    .limit(50);

  // Build message match results with snippets
  const convTitleMap = new Map<string, string>();
  if (ftsMessages && ftsMessages.length > 0) {
    const matchConvIds = [...new Set(ftsMessages.map((m) => m.conversation_id))];
    const { data: matchConvs } = await supabase
      .from("conversations")
      .select("id, title")
      .in("id", matchConvIds);
    for (const c of matchConvs || []) {
      convTitleMap.set(c.id, c.title);
    }
  }

  const messageMatches = (ftsMessages || []).map((msg) => {
    // Generate snippet: find query terms in content and extract surrounding context
    const snippet = generateSnippet(msg.content, query);
    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      conversationTitle: convTitleMap.get(msg.conversation_id) || "Untitled",
      snippet,
      role: msg.role,
      createdAt: msg.created_at,
    };
  });

  return NextResponse.json({
    conversations: conversationsByTitle || [],
    messageMatches,
  });
}

function generateSnippet(content: string, query: string): string {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const contentLower = content.toLowerCase();

  // Find the first occurrence of any query word
  let bestIndex = -1;
  for (const word of words) {
    const idx = contentLower.indexOf(word);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) bestIndex = 0;

  // Extract ~200 chars around the match
  const start = Math.max(0, bestIndex - 80);
  const end = Math.min(content.length, bestIndex + 120);
  let snippet = content.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";

  // Wrap query words in <mark> tags
  for (const word of words) {
    const regex = new RegExp(`(${escapeRegExp(word)})`, "gi");
    snippet = snippet.replace(regex, "<mark>$1</mark>");
  }

  return snippet;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
