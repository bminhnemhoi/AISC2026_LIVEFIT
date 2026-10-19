import type { Metadata } from "next";
import { RecapExperiment } from "@/components/phien/RecapExperiment";

export const metadata: Metadata = { title: "Tổng kết" };

export default async function TongKetPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <RecapExperiment sessionId={sessionId} />;
}
