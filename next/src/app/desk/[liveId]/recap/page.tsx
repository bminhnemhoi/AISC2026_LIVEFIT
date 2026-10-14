import { RecapScreen } from "@/components/livedesk/RecapScreen";

export default async function RecapPage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;
  return <RecapScreen liveId={liveId} />;
}
