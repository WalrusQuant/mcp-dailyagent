"use client";

import { UsageDashboard } from "@/components/usage/UsageDashboard";

export default function UsagePage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <UsageDashboard />
    </div>
  );
}
