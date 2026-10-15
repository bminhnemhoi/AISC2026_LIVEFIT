import { HostView } from "@/components/phien/HostView";

export default async function NguoiDanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <HostView sessionId={sessionId} />;
}
