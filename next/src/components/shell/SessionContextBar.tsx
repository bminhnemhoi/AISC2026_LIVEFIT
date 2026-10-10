import React from "react";
import { EnvironmentIdentity } from "@/contracts";
import { EnvironmentBadge } from "@/components/ui";

export interface SessionContextBarProps {
  eyebrow: string;
  title: string;
  environment: EnvironmentIdentity;
  metaText?: string;
  rightAction?: React.ReactNode;
}

export const SessionContextBar: React.FC<SessionContextBarProps> = ({
  eyebrow,
  title,
  environment,
  metaText,
  rightAction,
}) => {
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-6 lg:px-8 py-4 shrink-0 border-b border-[#1E232B] bg-[#090B0F]">
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <div className="space-y-1">
          <p className="text-[14px] leading-5 font-medium tracking-[1.5px] uppercase text-[#AEB7C5]">
            {eyebrow}
          </p>
          <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC] truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <EnvironmentBadge environment={environment} size="sm" />
          {metaText && (
            <p className="text-[15px] leading-5 text-[#B7C1CE]">{metaText}</p>
          )}
        </div>
      </div>

      {rightAction && (
        <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-3">{rightAction}</div>
      )}
    </div>
  );
};
