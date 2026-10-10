import React from "react";

export interface ViewerPillProps {
  viewers: number | null;
  className?: string;
}

export const ViewerPill: React.FC<ViewerPillProps> = ({ viewers, className = "" }) => {
  const isSimulated = viewers !== null;
  const countLabel = isSimulated ? viewers.toLocaleString() : "Not simulated";

  return (
    <div
      role="status"
      data-testid="viewer-pill"
      aria-label={
        isSimulated
          ? `Simulated live viewers: ${countLabel}`
          : "Viewer count not simulated"
      }
      title="Simulated audience count (never a real measurement)"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium tracking-tight bg-[#211F2B]/90 border border-[#44385C] text-[#C8B2FF] shadow-xs select-none backdrop-blur-xs ${className}`}
    >
      <i
        className={`${isSimulated ? "ri-eye-line text-[#C8B2FF]" : "ri-eye-off-line text-[#8A95A5]"}`}
        aria-hidden="true"
      />
      <span className="font-mono font-semibold tabular-nums text-[#F5F7FC]">
        {countLabel}
      </span>
      <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono font-bold tracking-wider bg-[#C8B2FF]/20 text-[#C8B2FF] border border-[#C8B2FF]/40">
        SIM
      </span>
    </div>
  );
};
