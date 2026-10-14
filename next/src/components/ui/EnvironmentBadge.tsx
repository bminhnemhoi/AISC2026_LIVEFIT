import React from "react";
import { EnvironmentIdentity } from "@/contracts";

export interface EnvironmentBadgeProps {
  environment: EnvironmentIdentity;
  size?: "sm" | "md";
  className?: string;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({
  environment,
  size = "md",
  className = "",
}) => {
  const isReal = environment === "REAL";

  const sizeStyles = size === "sm" ? "text-[14px] px-2 py-0.5" : "text-[16px] px-2.5 py-1";

  if (isReal) {
    return (
      <span
        data-testid="environment-badge-real"
        className={`inline-flex items-center gap-1.5 rounded-[6px] bg-[#161B22] border border-[#2B323F] font-medium text-[#CAD0DA] ${sizeStyles} ${className}`}
      >
        <i className="ri-broadcast-line text-[#CAD0DA]" aria-hidden="true" />
        <span>REAL</span>
      </span>
    );
  }

  return (
    <span
      data-testid="environment-badge-simulated"
      className={`inline-flex items-center gap-1.5 rounded-[6px] bg-[#211F2B] border border-[#44385C] font-medium text-[#C8B2FF] ${sizeStyles} ${className}`}
    >
      <i className="ri-flask-line text-[#C8B2FF]" aria-hidden="true" />
      <span>SIMULATED</span>
    </span>
  );
};
