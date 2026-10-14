import type { ReactNode } from "react";
import Link from "next/link";
import { LegalNav } from "@/components/legal/LegalNav";
import { Wordmark } from "@/components/ui/BrandMark";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[#1E232B] bg-[#101319]">
        <div className="mx-auto flex min-h-[64px] max-w-[1080px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" aria-label="LiveLift home" className="inline-flex min-h-[44px] items-center rounded-[8px] hover:opacity-90">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LegalNav />
            <Link
              href="/"
              className="hidden min-h-[44px] items-center gap-2 rounded-[8px] bg-[#292D35] px-4 text-[16px] font-medium text-[#F5F7FC] hover:bg-[#343944] sm:inline-flex"
            >
              Open LiveLift
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-10 outline-none sm:px-8 sm:py-16">
        {children}
      </main>

      <footer className="border-t border-[#1E232B] bg-[#0C0E14] py-10">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div className="max-w-[360px]">
            <Wordmark />
            <p className="mt-3 text-[15px] leading-6 text-[#B7C1CE]">
              A livestream operations desk: plan the show, run it, review it. A competition and development project.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-1 text-[15px] sm:flex sm:flex-wrap sm:justify-end sm:gap-x-6">
            <Link href="/" className="inline-flex min-h-[44px] items-center text-[#CAD0DA] hover:text-white">Home</Link>
            <Link href="/integrations" className="inline-flex min-h-[44px] items-center text-[#CAD0DA] hover:text-white">What is supported</Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center text-[#CAD0DA] hover:text-white">Terms of Use</Link>
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center text-[#CAD0DA] hover:text-white">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
