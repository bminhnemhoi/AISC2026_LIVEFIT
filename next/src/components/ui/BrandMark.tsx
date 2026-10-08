import React from "react";

/**
 * The LiveLift mark: three rising lime bars, the same glyph as the app icon (`src/app/icon.svg`).
 * Decorative by default; the wordmark beside it carries the name.
 */
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="7" fill="#13161C" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="#2F3B1A" />
      <rect x="7" y="15" width="3.6" height="10" rx="1.2" fill="#DFFF00" />
      <rect x="14.2" y="8" width="3.6" height="17" rx="1.2" fill="#DFFF00" />
      <rect x="21.4" y="12" width="3.6" height="13" rx="1.2" fill="#DFFF00" />
    </svg>
  );
}

/** Mark plus wordmark. "Lift" carries the accent so the name reads as one word with one highlight. */
export function Wordmark({ size = "md", className = "" }: { size?: "md" | "lg"; className?: string }): React.ReactElement {
  const text = size === "lg" ? "text-[26px]" : "text-[22px]";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size === "lg" ? 34 : 30} />
      <span className={`${text} font-semibold leading-none tracking-[-0.8px] text-[#F5F7FC]`}>
        Live<span className="text-[#DFFF00]">Lift</span>
      </span>
    </span>
  );
}
