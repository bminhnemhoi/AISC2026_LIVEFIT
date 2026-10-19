import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { connection } from "next/server";
import { LiveAnnouncer } from "@/components/ui/LiveAnnouncer";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Câu định vị dùng nguyên văn (docs/canon). */
const CAU_DINH_VI =
  "LiveLift giúp người bán livestream tự đo xem việc ghim một sản phẩm có thật sự làm khách bấm mua nhiều hơn, bằng cách bốc thăm bật/tắt theo từng khối 5 phút thay vì đoán theo tương quan.";

export const metadata: Metadata = {
  title: { default: "LiveLift · Đo hiệu quả ghim sản phẩm khi livestream", template: "%s · LiveLift" },
  description: CAU_DINH_VI,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Production serves a per-request CSP nonce (set by the platform's proxy). Next.js can only apply a nonce to
  // the scripts and styles it emits while it renders the page for that request, so no page may be prerendered
  // at build time. `connection()` opts the whole tree into dynamic rendering without weakening the CSP and
  // without reading the nonce here: Next.js picks it up from the request's Content-Security-Policy itself.
  await connection();

  return (
    // Không đặt lớp "dark" hay themeColor: trang cũ vẫn tối nhờ globals.css (body dùng --bg-canvas), Live Desk (.ld)
    // tự đặt nền và giao diện; trang có khung 2.0 (components/nen) tự đổi body sang nền kem.
    <html lang="vi">
      <body className={`${rubik.variable} min-h-screen antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[8px] focus:bg-[#2a2522] focus:px-4 focus:py-3 focus:font-medium focus:text-[#fff9f2] focus:outline-2 focus:outline-offset-2 focus:outline-[#f6f3ee]"
        >
          Bỏ qua, tới nội dung chính
        </a>
        {children}
        <LiveAnnouncer />
      </body>
    </html>
  );
}
