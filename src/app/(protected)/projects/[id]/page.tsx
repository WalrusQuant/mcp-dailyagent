"use client";

import { ProjectDashboard } from "@/components/projects/ProjectDashboard";
import { use } from "react";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProjectDashboard projectId={id} />;
}
