import { Chat } from "@/components/Chat";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Conversation } from "@/types/database";

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify the conversation exists and belongs to the user
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const conversation = data as Conversation;

  return <Chat conversationId={id} initialModel={conversation.model} />;
}
