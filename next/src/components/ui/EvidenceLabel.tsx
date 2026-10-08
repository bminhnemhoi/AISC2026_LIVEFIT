import React from "react";
type EvidenceClass = "observed" | "platform_confirmed" | "failed" | "unknown" | "simulated";
type ExecutionState = "not_attempted" | "attempted" | "operator_reported";
type RecommendationDecision = "proposed" | "accepted" | "rejected" | "overridden";

export type EvidenceLabelType =
  | EvidenceClass
  | ExecutionState
  | RecommendationDecision
  | "confirmed"
  | "late_receipt"
  | "gap"
  | "conflict"
  | "unsynced_draft";

export interface EvidenceLabelProps {
  type: EvidenceLabelType;
  customText?: string;
  className?: string;
}

export const EvidenceLabel: React.FC<EvidenceLabelProps> = ({
  type,
  customText,
  className = "",
}) => {
  const configs: Record<
    EvidenceLabelType,
    { label: string; icon: string; textClass: string; bgClass?: string }
  > = {
    // Recommendation decisions
    proposed: {
      label: "Recommended",
      icon: "ri-sparkling-line",
      textClass: "text-[#CAD0DA]",
    },
    accepted: {
      label: "Accepted",
      icon: "ri-checkbox-circle-line",
      textClass: "text-[#DFFF00]",
    },
    rejected: {
      label: "Rejected",
      icon: "ri-close-circle-line",
      textClass: "text-[#CAD0DA]",
    },
    overridden: {
      label: "Overridden",
      icon: "ri-arrow-right-circle-line",
      textClass: "text-[#CAD0DA]",
    },

    // Execution states
    not_attempted: {
      label: "No attempt recorded",
      icon: "ri-subtract-line",
      textClass: "text-[#8A95A5]",
    },
    attempted: {
      label: "Attempted",
      icon: "ri-cursor-line",
      textClass: "text-[#CAD0DA]",
    },
    operator_reported: {
      label: "Operator reported",
      icon: "ri-hand-heart-line",
      textClass: "text-[#CAD0DA]",
    },

    // Evidence classes
    observed: {
      label: "Observed",
      icon: "ri-eye-line",
      textClass: "text-[#CAD0DA]",
    },
    platform_confirmed: {
      label: "Platform confirmed",
      icon: "ri-shield-check-line",
      textClass: "text-[#22C55E]",
    },
    confirmed: {
      label: "Platform confirmed",
      icon: "ri-shield-check-line",
      textClass: "text-[#22C55E]",
    },
    failed: {
      label: "Failed",
      icon: "ri-close-line",
      textClass: "text-[#FF5C5C]",
    },
    unknown: {
      label: "Unknown",
      icon: "ri-question-line",
      textClass: "text-[#C8CDD6]",
    },
    simulated: {
      label: "Simulated",
      icon: "ri-flask-line",
      textClass: "text-[#C8B2FF]",
    },

    // Special evidence categories
    late_receipt: {
      label: "Late receipt",
      icon: "ri-history-line",
      textClass: "text-[#C8B2FF]",
    },
    gap: {
      label: "Data gap",
      icon: "ri-subtract-line",
      textClass: "text-[#FFB800]",
    },
    conflict: {
      label: "Conflicting evidence",
      icon: "ri-error-warning-line",
      textClass: "text-[#FFB800]",
    },
    unsynced_draft: {
      label: "UNSYNCED DRAFT",
      icon: "ri-draft-line",
      textClass: "text-[#FFB800]",
    },
  };

  const item = configs[type] || {
    label: String(type),
    icon: "ri-information-line",
    textClass: "text-[#CAD0DA]",
  };

  return (
    <span
      data-testid={`evidence-label-${type}`}
      className={`inline-flex items-center gap-1.5 text-[15px] font-normal ${item.textClass} ${className}`}
    >
      <i className={item.icon} aria-hidden="true" />
      <span>{customText || item.label}</span>
    </span>
  );
};
