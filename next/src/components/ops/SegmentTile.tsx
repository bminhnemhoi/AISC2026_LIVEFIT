import React from "react";
import type { ProductSnapshot, Segment } from "@/contracts";

const KIND_ICON: Record<Segment["kind"], string> = {
  opening: "ri-play-list-line",
  product: "ri-shopping-bag-3-line",
  promotion: "ri-flashlight-line",
  qa: "ri-chat-1-line",
  closing: "ri-play-list-line",
  break: "ri-cup-line",
};

/**
 * Recognition tile. Products show their initials and code (an honest placeholder — no stock images);
 * product-free segments show a kind icon. Same footprint either way, so rows never shift.
 */
export function SegmentTile({
  segment,
  product,
  size = 44,
  active = false,
}: {
  segment: Pick<Segment, "kind" | "title">;
  product?: ProductSnapshot | null;
  size?: number;
  active?: boolean;
}): React.ReactElement {
  const style = { width: size, height: size };
  const surface = active ? "bg-[#27312B] border-[#3E4F32]" : "bg-[#2A303B] border-[#373F4D]";
  if (product) {
    return (
      <div
        style={style}
        aria-hidden="true"
        className={`shrink-0 rounded-[10px] border flex flex-col items-center justify-center select-none ${surface}`}
      >
        <span className={`font-medium text-[#D2D9E4] leading-none ${size >= 56 ? "text-[22px]" : "text-[16px]"}`}>
          {product.initials}
        </span>
        <span className="font-mono text-[#AFB8C7] leading-none mt-1 text-[11px]">{product.code}</span>
      </div>
    );
  }
  return (
    <div
      style={style}
      aria-hidden="true"
      className={`shrink-0 rounded-[10px] border flex items-center justify-center select-none ${surface}`}
    >
      <i className={`${KIND_ICON[segment.kind]} text-[#B7C1CE] ${size >= 56 ? "text-[26px]" : "text-[20px]"}`} />
    </div>
  );
}
