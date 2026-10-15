import { XemRoom } from "@/components/phien/XemRoom";

export default async function XemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <XemRoom code={code} />;
}
