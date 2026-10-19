import { HostView } from "@/components/phien/HostView";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Màn người dẫn" };

export default async function NguoiDanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <HostView sessionId={sessionId} />;
}
