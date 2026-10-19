import type { Metadata, Viewport } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "LiveLift — Mỗi lần ghim, một quyết định có cơ sở",
  description: "Từ bình luận đến gợi ý ghim sản phẩm và bằng chứng sau phiên. Khám phá LiveLift, bàn trợ lý dành cho đội vận hành livestream thương mại.",
};

export const viewport: Viewport = { themeColor: "#f6f3ee", colorScheme: "light" };

export default function HomePage() {
  return <LandingPage />;
}
