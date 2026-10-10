import React from "react";
import { ProductSnapshot } from "@/contracts";

export interface ProductIdentityProps {
  product: ProductSnapshot;
  size?: "sm" | "md" | "lg";
  showPrice?: boolean;
  showCode?: boolean;
  subtitle?: string;
  className?: string;
}

export const ProductIdentity: React.FC<ProductIdentityProps> = ({
  product,
  size = "md",
  showPrice = false,
  showCode = true,
  subtitle,
  className = "",
}) => {
  const boxDimensions = {
    sm: "w-[44px] h-[44px]",
    md: "w-[56px] h-[56px]",
    lg: "w-[80px] h-[80px]",
  }[size];

  const initialsTextSize = {
    sm: "text-[18px]",
    md: "text-[22px]",
    lg: "text-[28px]",
  }[size];

  const titleTextSize = {
    sm: "text-[16px] leading-[1.2]",
    md: "text-[19px] leading-[1.2]",
    lg: "text-[24px] leading-[1.2]",
  }[size];

  const priceText =
    product.price !== null
      ? `${product.currency} ${product.price}`
      : "Not entered";

  return (
    <div className={`flex gap-3.5 items-center ${className}`}>
      {/* Thumbnail or deterministic fallback */}
      <div
        className={`${boxDimensions} shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5 select-none`}
        aria-hidden="true"
      >
        <span className={`${initialsTextSize} font-medium text-[#D2D9E4]`}>
          {product.initials}
        </span>
        <span className="text-[12px] font-mono text-[#AFB8C7]">
          {product.code}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {showCode && (
          <p className="text-[14px] leading-5 text-[#B7C1CE] font-mono">
            {product.code}
          </p>
        )}
        <h3
          className={`${titleTextSize} font-medium tracking-[-0.4px] text-[#F5F7FC] truncate`}
          title={product.name}
        >
          {product.name}
        </h3>
        {subtitle && (
          <p className="text-[14px] leading-5 text-[#CAD0DA] mt-0.5 truncate">
            {subtitle}
          </p>
        )}
        {showPrice && (
          <p className="text-[14px] leading-5 text-[#CAD0DA] mt-0.5">
            {priceText}
          </p>
        )}
      </div>
    </div>
  );
};
