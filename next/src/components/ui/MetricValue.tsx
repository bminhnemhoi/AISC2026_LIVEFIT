import React from "react";
export type MetricFinality = "pending" | "provisional" | "final" | "unavailable";

export interface MetricValueProps {
  label: string;
  value: number | null;
  unit?: string;
  finality?: MetricFinality;
  source?: string;
  className?: string;
}

export const MetricValue: React.FC<MetricValueProps> = ({
  label,
  value,
  unit = "",
  finality = "provisional",
  source,
  className = "",
}) => {
  const isMissing = value === null || value === undefined;

  return (
    <div
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`rounded-[10px] bg-[#1B1F27] border border-[#2B313C] p-3.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] text-[#B7C1CE] font-medium">{label}</span>
        {finality && (
          <span className="text-[12px] font-mono uppercase text-[#8A95A5]">
            {finality}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        {isMissing ? (
          <span
            data-testid="metric-not-available"
            className="text-[18px] text-[#8A95A5] font-normal italic"
          >
            Not available
          </span>
        ) : (
          <span
            data-testid="metric-numeric-value"
            className="text-[26px] font-medium tracking-tight text-[#F5F7FC] tabular-nums"
          >
            {value.toLocaleString()} {unit && <span className="text-[16px] text-[#B7C1CE] font-normal">{unit}</span>}
          </span>
        )}
      </div>

      {source && (
        <p className="mt-1 text-[12px] text-[#8A95A5]">
          Source: {source}
        </p>
      )}
    </div>
  );
};
