import { JournalView } from "@/components/journal/JournalView";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <JournalView initialDate={date} />;
}
