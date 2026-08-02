import { JournalView } from "@/components/journal/JournalView";
import { getUserId } from "@/lib/auth";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <JournalView initialDate={date} draftOwnerId={getUserId()} />;
}
