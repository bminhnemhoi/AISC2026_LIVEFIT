import { RecapExperiment } from "@/components/phien/RecapExperiment";

export default async function TongKetPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <RecapExperiment sessionId={sessionId} />;
}
