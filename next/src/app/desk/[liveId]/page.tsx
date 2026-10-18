import { LiveDeskScreen } from "@/components/livedesk/LiveDeskScreen";

export default async function DeskPage({ params }: { params: Promise<{ liveId: string }> }) {
  const { liveId } = await params;
  return <LiveDeskScreen liveId={liveId} />;
}
