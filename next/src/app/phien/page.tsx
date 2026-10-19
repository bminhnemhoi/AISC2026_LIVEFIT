import type { Metadata } from "next";
import { PhienList } from "@/components/phien/PhienList";
import { TU } from "@/lib/tu-ngu";

export const metadata: Metadata = { title: TU.danhSachPhien.chu };

export default function PhienIndexPage() {
  return <PhienList />;
}
