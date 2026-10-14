import React from "react";
import Link from "next/link";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/**
 * One public document: title, a one-line status, the few points worth knowing before reading, the sections with an
 * index beside them, and a way across to the sibling document. The words come from the page; this only lays them out.
 */
export function LegalDoc({
  title,
  lead,
  glance,
  sections,
  sibling,
}: {
  title: string;
  lead: string;
  /** Short restatements of what the sections below say, for a reader who only skims. */
  glance: Array<{ icon: string; text: string }>;
  sections: LegalSection[];
  sibling: { href: string; label: string; summary: string };
}): React.ReactElement {
  return (
    <>
      <header className="max-w-[720px]">
        <h1 className="text-[34px] sm:text-[44px] font-semibold leading-[1.1] tracking-[-1px] text-[#F5F7FC]">{title}</h1>
        <p className="mt-4 text-[18px] leading-8 text-[#CAD0DA]">{lead}</p>
      </header>

      <ul aria-label="At a glance" className="mt-8 grid max-w-[920px] grid-cols-1 gap-3 sm:grid-cols-3">
        {glance.map((g) => (
          <li key={g.text} className="flex items-start gap-3 rounded-[12px] bg-[#13161C] px-4 py-3.5 text-[15px] leading-6 text-[#E4E8F0]">
            <i className={`${g.icon} mt-0.5 text-[18px] text-[#DFFF00]`} aria-hidden="true" />
            <span>{g.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-8">
            <p className="text-[13px] font-semibold uppercase tracking-[1.4px] text-[#9AA5B5]">On this page</p>
            <ul className="mt-3 space-y-1 border-l border-[#232935]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px inline-flex min-h-[40px] items-center border-l border-transparent pl-4 text-[15px] text-[#B7C1CE] hover:border-[#DFFF00] hover:text-white">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="max-w-[68ch] divide-y divide-[#232935]">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-8 py-8 first:pt-0">
              <h2 id={`${s.id}-title`} className="text-[22px] font-semibold leading-snug tracking-[-0.3px] text-[#F5F7FC]">
                {s.title}
              </h2>
              <div className="mt-3 text-[17px] leading-8 text-[#C3CCD8]">{s.body}</div>
            </section>
          ))}

          <aside aria-label="Related page" className="pt-8">
            <Link
              href={sibling.href}
              className="group flex min-h-[44px] items-center justify-between gap-4 rounded-[12px] bg-[#13161C] px-5 py-4 transition-colors hover:bg-[#1B1F27]"
            >
              <span>
                <span className="block text-[13px] font-semibold uppercase tracking-[1.4px] text-[#9AA5B5]">Also read</span>
                <span className="mt-1 block text-[18px] font-medium text-[#F5F7FC]">{sibling.label}</span>
                <span className="mt-0.5 block text-[15px] leading-6 text-[#B7C1CE]">{sibling.summary}</span>
              </span>
              <i className="ri-arrow-right-line text-[22px] text-[#DFFF00] transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
