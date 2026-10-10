import React from "react";

export interface VideoPlaceholderProps {
  className?: string;
}

export const VideoPlaceholder: React.FC<VideoPlaceholderProps> = ({ className = "" }) => {
  return (
    <div
      data-testid="video-placeholder"
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
    >
      {/* Abstract animated gradient canvas */}
      <div
        className="absolute inset-0 opacity-85 transition-opacity animate-[host-app-ambient-drift_16s_ease_infinite] motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(ellipse at 75% 20%, rgba(200, 178, 255, 0.22) 0%, transparent 60%), radial-gradient(ellipse at 25% 80%, rgba(223, 255, 0, 0.12) 0%, transparent 60%), radial-gradient(circle at 50% 50%, #151a24 0%, #090B0F 100%)",
          backgroundSize: "200% 200%",
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #F5F7FC 1px, transparent 1px), linear-gradient(to bottom, #F5F7FC 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Broadcast HUD / Viewfinder corners */}
      <div className="absolute top-14 left-4 w-4 h-4 border-t-2 border-l-2 border-[#CAD0DA]/20" />
      <div className="absolute top-14 right-4 w-4 h-4 border-t-2 border-r-2 border-[#CAD0DA]/20" />
      <div className="absolute bottom-20 left-4 w-4 h-4 border-b-2 border-l-2 border-[#CAD0DA]/20" />
      <div className="absolute bottom-20 right-4 w-4 h-4 border-b-2 border-r-2 border-[#CAD0DA]/20" />

      {/* Feed watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="w-16 h-16 mx-auto rounded-full border border-[#C8B2FF]/40 flex items-center justify-center bg-[#211F2B]/60 backdrop-blur-xs mb-2">
          <i className="ri-live-line text-[28px] text-[#C8B2FF]" />
        </div>
        <p className="text-[11px] font-mono font-semibold tracking-widest text-[#C8B2FF] uppercase">
          SIMULATED FEED
        </p>
        <p className="text-[9px] font-mono text-[#CAD0DA] mt-0.5">
          NO REAL CAMERA STREAM
        </p>
      </div>
    </div>
  );
};
