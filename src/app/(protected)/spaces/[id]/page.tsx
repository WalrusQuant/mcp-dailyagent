"use client";

import { SpaceDashboard } from "@/components/spaces/SpaceDashboard";
import { use } from "react";

export default function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SpaceDashboard spaceId={id} />;
}
