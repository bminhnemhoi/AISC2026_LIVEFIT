import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  variant?: "ghost" | "secondary" | "subtle";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = "ghost", className = "", ...props }, ref) => {
    const baseStyles =
      "w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[8px] inline-flex items-center justify-center transition-[color,background-color,opacity,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

    const variantStyles = {
      ghost: "bg-transparent text-[#CAD0DA] hover:text-white hover:bg-[#1E232B]",
      secondary: "bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]",
      subtle: "bg-[#1B1F27] text-[#B7C1CE] hover:text-white hover:bg-[#252A34]",
    }[variant];

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      >
        <i className={`${icon} text-[20px]`} aria-hidden="true" />
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
