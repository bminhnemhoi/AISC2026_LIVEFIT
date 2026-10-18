import React from "react";
import type { HostAppPromotion } from "./types";

export interface PromotionBannerProps {
  promotion: HostAppPromotion | null;
  className?: string;
}

export const PromotionBanner: React.FC<PromotionBannerProps> = ({
  promotion,
  className = "",
}) => {
  if (!promotion) return null;

  const { name, status, countdownLabel } = promotion;

  const isScheduled = status === "scheduled";
  const isActive = status === "active";

  return (
    <div
      role="region"
      aria-label="Flash sale promotion"
      data-testid="promotion-banner"
      className={`relative w-full my-1 p-1.5 sm:p-2 rounded-xl border shadow-md transition-all duration-300 animate-[host-app-banner-in_250ms_ease-out] motion-reduce:animate-none select-none ${
        isActive
          ? "bg-[#281816] border-[#E24A24]/70 text-[#FFA07A]"
          : isScheduled
            ? "bg-[#252218] border-[#967526]/70 text-[#F6C875]"
            : "bg-[#181B22] border-[#2F3746] text-[#CAD0DA]"
      } ${className}`}
    >
      <div className="flex flex-col gap-1">
        {/* Top line: status badge and countdown timer */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-mono font-bold tracking-wider uppercase px-1 py-0.2 rounded ${
                isActive
                  ? "bg-[#3D1A17] text-[#FFB3B3] border border-[#FF5C5C]/50"
                  : isScheduled
                    ? "bg-[#3A321E] text-[#F6C875] border border-[#967526]/60"
                    : "bg-[#252A34] text-[#CAD0DA] border border-[#39414D]"
              }`}
            >
              {status}
            </span>
            <span className="text-[9px] font-mono uppercase text-[#CAD0DA]">
              PROMO
            </span>
          </div>

          {countdownLabel && (
            <div
              className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold tracking-tight border ${
                isActive
                  ? "bg-[#251512] text-[#FFD700] border-[#FF4500]/60"
                  : "bg-[#101319] text-[#F5F7FC] border-[#39414D]"
              }`}
            >
              <i className="ri-timer-line text-[11px]" aria-hidden="true" />
              <span className="tabular-nums">{countdownLabel}</span>
            </div>
          )}
        </div>

        {/* Bottom line: icon & promo title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
              isActive
                ? "bg-[#E24A24] text-[#FFFFFF] shadow-sm animate-[host-app-countdown-pulse_2s_ease-in-out_infinite] motion-reduce:animate-none"
                : isScheduled
                  ? "bg-[#483B1B] text-[#F6C875]"
                  : "bg-[#252A34] text-[#CAD0DA]"
            }`}
          >
            <i
              className={
                isActive
                  ? "ri-flashlight-fill text-[12px]"
                  : isScheduled
                    ? "ri-time-line text-[11px]"
                    : "ri-checkbox-circle-line text-[11px]"
              }
              aria-hidden="true"
            />
          </div>
          <p className="text-[11px] sm:text-[12px] font-medium leading-tight truncate text-[#F5F7FC] flex-1">
            {name}
          </p>
        </div>
      </div>
    </div>
  );
};
