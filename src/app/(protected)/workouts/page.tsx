import { WorkoutDashboard } from "@/components/workouts/WorkoutDashboard";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <WorkoutDashboard initialDate={date} />;
}
