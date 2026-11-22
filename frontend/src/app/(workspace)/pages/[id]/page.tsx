"use client";

import { use } from "react";

import { NotionPaperCanvas } from "@/features/dashboards/notion-paper-canvas";

export default function CustomSidebarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <NotionPaperCanvas dashboardId={id} />;
}
