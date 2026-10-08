import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "nav" | "assist";
/**
 * `desk` and `deskPrimary` are for the operating desk: still compact 44px targets, but with the readable
 * 16px label (secondary actions) and 18px label (the primary, lime action) the operating screens require.
 */
export type ButtonSize = "sm" | "md" | "lg" | "desk" | "deskPrimary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "min-h-[44px] rounded-[8px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-[color,background-color,border-color,opacity,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

    const sizeStyles = {
      sm: "px-3 py-1.5 text-[15px]",
      md: "px-4 py-2 text-[16px]",
      lg: "px-5 py-2.5 text-[18px]",
      desk: "px-2.5 py-1.5 text-[16px]",
      deskPrimary: "px-3.5 py-1.5 text-[18px]",
    }[size];

    const variantStyles = {
      primary:
        "bg-[#DFFF00] text-[#111407] hover:bg-[#CBEA00] font-semibold active:bg-[#B7D400]",
      secondary:
        "bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] active:bg-[#20242B]",
      ghost:
        "bg-transparent text-[#CAD0DA] hover:text-white hover:bg-[#1E232B] active:bg-[#181C23]",
      danger:
        "bg-[#381E24] text-[#FF8585] hover:bg-[#4E232B] active:bg-[#2B1519] border border-[#6B2A35]",
      nav:
        "bg-transparent text-[#C8CDD6] hover:text-white hover:bg-[#1E232B]",
      // AI assistance: never the lime of the desk's one real action.
      assist:
        "bg-[#12222A] text-[#7DD8EA] border border-[#25505F] hover:bg-[#173039] active:bg-[#0E1B21]",
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {icon && <i className={icon} aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
