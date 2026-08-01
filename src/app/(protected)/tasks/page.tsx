import { TaskList } from "@/components/tasks/TaskList";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <TaskList initialDate={date} />;
}
