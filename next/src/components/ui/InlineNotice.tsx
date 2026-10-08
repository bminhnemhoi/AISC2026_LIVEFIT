import React from "react";

export type NoticeVariant = "info" | "warning" | "danger" | "draft";

export interface InlineNoticeProps {
  variant?: NoticeVariant;
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const InlineNotice: React.FC<InlineNoticeProps> = ({
  variant = "info",
  title,
  message,
  actionText,
  onAction,
  className = "",
}) => {
  const configs = {
    info: {
      bg: "bg-[#161B22]",
      border: "border-[#2E3643]",
      icon: "ri-information-line text-[#CAD0DA]",
      titleColor: "text-[#F5F7FC]",
    },
    warning: {
      bg: "bg-[#241E15]",
      border: "border-[#5E4822]",
      icon: "ri-alert-line text-[#FFB800]",
      titleColor: "text-[#FFD580]",
    },
    danger: {
      bg: "bg-[#29171A]",
      border: "border-[#6E2A33]",
      icon: "ri-error-warning-line text-[#FF5C5C]",
      titleColor: "text-[#FFA3A3]",
    },
    draft: {
      bg: "bg-[#211E26]",
      border: "border-[#4C3B5E]",
      icon: "ri-draft-line text-[#FFB800]",
      titleColor: "text-[#FFD580]",
    },
  }[variant];

  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={`rounded-[10px] border p-4 ${configs.bg} ${configs.border} ${className}`}
    >
      <div className="flex gap-3 items-start">
        <i className={`${configs.icon} text-[20px] shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title && (
            <h4 className={`text-[16px] font-medium leading-5 ${configs.titleColor}`}>
              {title}
            </h4>
          )}
          <p className="text-[15px] leading-5 text-[#CAD0DA] mt-0.5">{message}</p>
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 text-[15px] font-medium text-[#DFFF00] hover:underline cursor-pointer"
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
