import type { Metadata } from "next";
import { MO_TA_TRANG, TrangGioiThieu } from "@/components/trang-chu";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: MO_TA_TRANG,
};

export default function GioiThieuPage() {
  return <TrangGioiThieu />;
}
