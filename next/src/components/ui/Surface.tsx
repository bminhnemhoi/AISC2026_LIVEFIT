import React from "react";

export type SurfaceLevel = "l0" | "l1" | "l2" | "l3" | "l4";

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: SurfaceLevel;
  bordered?: boolean;
  rounded?: "sm" | "md" | "lg" | "none";
  children?: React.ReactNode;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      level = "l1",
      bordered = false,
      rounded = "lg",
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const levelStyles = {
      l0: "bg-[#090B0F]",
      l1: "bg-[#13161C]",
      l2: "bg-[#1B1F27]",
      l3: "bg-[#252A34]",
      l4: "bg-[#303643]",
    }[level];

    const roundedStyles = {
      none: "rounded-none",
      sm: "rounded-[6px]",
      md: "rounded-[8px]",
      lg: "rounded-[12px]",
    }[rounded];

    const borderStyle = bordered ? "border border-[#2A303A]" : "";

    return (
      <div
        ref={ref}
        className={`${levelStyles} ${roundedStyles} ${borderStyle} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Surface.displayName = "Surface";
