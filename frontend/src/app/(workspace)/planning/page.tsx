import { Suspense } from "react";

import { PlanningWorkspace } from "@/features/planning/planning-workspace";

export default function PlanningPage() {
  return <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
    <PlanningWorkspace />
  </Suspense>;
}
