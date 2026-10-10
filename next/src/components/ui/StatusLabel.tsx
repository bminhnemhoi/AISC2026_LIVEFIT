import React from "react";
import type { SessionLifecycle } from "@/contracts";

export type SegmentState = "pending" | "current" | "completed" | "skipped" | "deferred";

export interface StatusLabelProps {
  status:
    | SegmentState
    | SessionLifecycle
    | "tracking_active"
    | "saved"
    | "saving"
    | "unsaved"
    | "disabled"
    | "high";
  className?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ status, className = "" }) => {
  const config: Record<
    string,
    { label: string; icon: string; textClass: string; bgClass?: string }
  > = {
    active: {
      label: "Active",
      icon: "ri-record-circle-line",
      textClass: "text-[#DFFF00]",
    },
    ended: {
      label: "Ended",
      icon: "ri-stop-circle-line",
      textClass: "text-[#CAD0DA]",
    },
    abandoned: {
      label: "Abandoned",
      icon: "ri-close-circle-line",
      textClass: "text-[#8A95A5]",
    },
    current: {
      label: "Current",
      icon: "ri-record-circle-line",
      textClass: "text-[#DFFF00]",
    },
    tracking_active: {
      label: "Tracking active",
      icon: "ri-record-circle-line",
      textClass: "text-[#DFFF00]",
    },
    planned: {
      label: "Planned",
      icon: "ri-time-line",
      textClass: "text-[#C8CDD6]",
    },
    pending: {
      label: "Pending",
      icon: "ri-time-line",
      textClass: "text-[#C8CDD6]",
    },
    completed: {
      label: "Completed",
      icon: "ri-checkbox-circle-line",
      textClass: "text-[#CAD0DA]",
    },
    skipped: {
      label: "Skipped",
      icon: "ri-skip-forward-line",
      textClass: "text-[#9EABB9]",
    },
    deferred: {
      label: "Deferred",
      icon: "ri-time-line",
      textClass: "text-[#C8CDD6]",
    },
    saved: {
      label: "Saved",
      icon: "ri-save-line",
      textClass: "text-[#C8CDD6]",
    },
    saving: {
      label: "Saving...",
      icon: "ri-loader-4-line",
      textClass: "text-[#DFFF00]",
    },
    unsaved: {
      label: "Unsaved changes",
      icon: "ri-alert-line",
      textClass: "text-[#FFB800]",
    },
    disabled: {
      label: "Disabled",
      icon: "ri-subtract-line",
      textClass: "text-[#8A95A5]",
    },
    high: {
      label: "High",
      icon: "ri-flag-line",
      textClass: "text-[#DFFF00]",
    },
  };

  const item = config[status] || {
    label: status,
    icon: "ri-information-line",
    textClass: "text-[#C8CDD6]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[15px] leading-5 font-normal ${item.textClass} ${className}`}
    >
      <i className={item.icon} aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
};
