import { FocusTimer } from "@/components/focus/FocusTimer";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <FocusTimer initialDate={date} />;
}
