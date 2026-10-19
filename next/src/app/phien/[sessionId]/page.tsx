import { ExperimentDesk } from "@/components/phien/ExperimentDesk";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bàn thí nghiệm" };

export default async function PhienPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ExperimentDesk sessionId={sessionId} />;
}
