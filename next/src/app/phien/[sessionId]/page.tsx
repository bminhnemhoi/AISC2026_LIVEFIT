import { ExperimentDesk } from "@/components/phien/ExperimentDesk";

export default async function PhienPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ExperimentDesk sessionId={sessionId} />;
}
