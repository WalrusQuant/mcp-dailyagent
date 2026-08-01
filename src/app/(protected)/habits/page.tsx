import { HabitTracker } from "@/components/habits/HabitTracker";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <HabitTracker initialDate={date} />;
}
