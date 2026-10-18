"use client";

import React from "react";
import Link from "next/link";
import type { EnvironmentIdentity, OperatorContext } from "@/contracts";
import { EnvironmentBadge, Button, BrandMark } from "@/components/ui";
import { AccountControl } from "@/components/auth/AccountControl";
import { ConnectionChip, RemoteBanners } from "@/components/ops/ConnectionStatus";

export interface FocusedShellProps {
  sessionTitle: string;
  environment: EnvironmentIdentity;
  /** Runtime elapsed as m:ss, or null until the clock is available (avoids a hydration mismatch). */
  elapsedLabel: string | null;
  tracking: "active" | "ended";
  operator: OperatorContext;
  accountLabel?: string | null;
  /** REAL room, read-only access: the person at this desk is watching, not leading. */
  viewer?: { name: string } | null;
  /** Right side of the operator line — e.g. the rehearsal controls for a SIMULATED show. */
  contextExtra?: React.ReactNode;
  onEndLiveClick?: () => void;
  /** REAL room: not connected, read-only or waiting on an answer. */
  endLiveDisabled?: boolean;
  children: React.ReactNode;
}

export const FocusedShell: React.FC<FocusedShellProps> = ({
  sessionTitle,
  environment,
  elapsedLabel,
  tracking,
  operator,
  accountLabel,
  viewer = null,
  contextExtra,
  onEndLiveClick,
  endLiveDisabled = false,
  children,
}) => {
  const simulated = environment === "SIMULATED";

  return (
    <div className="h-dvh flex flex-col bg-[#090B0F] text-[#F5F7FC] overflow-hidden">
      {/* Focused header: no global navigation. Leaving the desk does not stop runtime. */}
      <header className="min-h-[60px] lg:h-[60px] lg:[@media(max-height:800px)]:h-[52px] bg-[#101319] px-5 py-2 lg:py-0 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 border-b border-[#1E232B] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="hover:opacity-80 shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
            title="Leave the desk (tracking continues)"
            aria-label="Leave the desk (tracking continues)"
          >
            <BrandMark size={30} />
          </Link>
          <h1 className="text-[20px] font-medium tracking-[-0.4px] text-[#F5F7FC] truncate max-w-[45vw] lg:max-w-[34vw]">
            {sessionTitle}
          </h1>
          <EnvironmentBadge environment={environment} size="md" />
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-1 min-w-0">
          <span
            className={`inline-flex items-center gap-2 text-[16px] font-medium ${
              tracking === "active" ? "text-[#DFFF00]" : "text-[#CAD0DA]"
            }`}
          >
            <i
              className={tracking === "active" ? "ri-record-circle-line" : "ri-stop-circle-line"}
              aria-hidden="true"
            />
            <span>
              {simulated ? "Simulated session" : "Tracking"} {tracking === "active" ? "active" : "ended"}
            </span>
          </span>

          <span
            className="inline-flex items-baseline gap-2"
            title="Time since LiveLift tracking started for the whole show — not the current segment's time."
          >
            <span className="text-[16px] text-[#AEB7C5] whitespace-nowrap">Show time</span>
            <span
              data-testid="elapsed-runtime-clock"
              aria-label="LiveLift tracked time"
              className="text-[26px] font-medium tracking-tight text-[#F5F7FC] tabular-nums min-w-[72px] text-right"
            >
              {elapsedLabel ?? "--:--"}
            </span>
          </span>

          <Link
            href="/"
            className="min-h-[44px] px-3 rounded-[8px] text-[16px] text-[#CAD0DA] hover:text-white hover:bg-[#1E232B] inline-flex items-center gap-1.5 transition-colors"
          >
            <i className="ri-logout-box-r-line" aria-hidden="true" />
            <span>Leave desk</span>
          </Link>

          {onEndLiveClick && (
            <Button
              variant="secondary"
              onClick={onEndLiveClick}
              disabled={endLiveDisabled}
              data-testid="end-live-header-btn"
              className="bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]"
            >
              {simulated ? "End simulated session" : "End LIVE"}
            </Button>
          )}
        </div>
      </header>

      {/* Operator and room context line */}
      <div
        className={`min-h-[36px] px-5 border-b flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-4 gap-y-1 text-[16px] shrink-0 ${
          simulated
            ? "bg-[#1A1726] border-[#2E2745] text-[#C8B2FF]"
            : "bg-[#0C0E14] border-[#1A1F27] text-[#B7C1CE]"
        }`}
      >
        <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 min-w-0 w-full xl:w-auto">
          <span className="inline-flex items-center gap-2 text-[#CAD0DA]">
            <i className="ri-user-settings-line" aria-hidden="true" />
            {viewer ? (
              <span data-testid="viewer-identity">
                Viewing as <strong>{viewer.name}</strong> · Lead is <strong>{operator.name}</strong>
              </span>
            ) : (
              <span>
                {operator.isLead ? "You are Lead · " : "Assistant · "}
                <strong>{operator.name}</strong>
              </span>
            )}
          </span>
          {!simulated && (
            <span className="inline-flex items-center gap-2 text-[#CAD0DA] truncate">
              <i className="ri-live-line" aria-hidden="true" />
              <span className="truncate">{accountLabel || "Manual desk · TikTok not connected"}</span>
            </span>
          )}
          {simulated && (
            <span className="hidden 2xl:inline-flex items-center gap-2 truncate" title="Rehearsal only: nothing is broadcast and TikTok is not involved.">
              <i className="ri-flask-line" aria-hidden="true" />
              <span className="truncate">Rehearsal · no real broadcast</span>
            </span>
          )}
        </div>
        {simulated ? (
          contextExtra
        ) : (
          <div className="flex items-center gap-4 shrink-0">
            <ConnectionChip size="desk" />
            <AccountControl size="desk" />
            {contextExtra}
          </div>
        )}
      </div>
      {!simulated && <RemoteBanners size="desk" />}

      {/* Desk content. If the window is too short the desk scrolls rather than clipping controls. */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto outline-none">
        {children}
      </main>
    </div>
  );
};
