import React, { useEffect, useRef } from "react";
import type { HostAppComment } from "./types";

export interface CommentStreamProps {
  comments: HostAppComment[];
  className?: string;
}

export const CommentStream: React.FC<CommentStreamProps> = ({
  comments,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new comments arrive, without stealing focus
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [comments.length]);

  return (
    <div
      data-testid="comment-stream"
      className={`relative flex flex-col justify-end min-h-0 select-none ${className}`}
    >
      {/* Synthetic stream label */}
      <div className="flex items-center gap-1.5 mb-0.5 px-1 shrink-0">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium tracking-tight px-1.5 py-0.5 rounded-full bg-[#211F2B]/90 text-[#C8B2FF] border border-[#44385C]">
          <i className="ri-flask-line text-[11px]" aria-hidden="true" />
          <span>SYNTHETIC CHAT</span>
          <span className="text-[9px] text-[#8A95A5]">({comments.length})</span>
        </span>
      </div>

      {/* Accessible live region for screen readers */}
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Synthetic live stream comments"
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 max-h-[190px] scrollbar-thin scrollbar-thumb-[#39414D] scrollbar-track-transparent focus:outline-none focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-1 rounded-lg"
      >
        {comments.length === 0 ? (
          <div className="text-[11px] text-[#8A95A5] italic px-2 py-1 bg-[#13161C]/60 rounded-lg">
            No comments yet
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="inline-flex max-w-[98%] items-baseline gap-1.5 px-2 py-0.5 rounded-xl bg-[#13161C]/85 backdrop-blur-md border border-[#2A303A]/70 text-[11px] sm:text-[12px] leading-relaxed shadow-xs animate-[host-app-comment-enter_200ms_ease-out] motion-reduce:animate-none flex-wrap"
            >
              <span className="font-semibold text-[#C8B2FF] shrink-0 text-[11px] max-w-[90px] sm:max-w-[120px] truncate" title={comment.user}>
                {comment.user}:
              </span>
              <span className="text-[#F5F7FC] break-words text-[12px] min-w-0 flex-1">
                {comment.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
