"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { LiveIntelligenceState } from "@/lib/intelligence/types";

/**
 * Every way provider evidence can be absent, said plainly. None of these is a result of zero: the footer line repeats
 * the one rule. An unavailable feature is a state, not a fault, so the tone is calm and the next step is named.
 */

interface Copy {
  icon: string;
  title: string;
  body: string;
  /** Amber icon: someone could act to change this. Neutral: nothing to fix. */
  attention: boolean;
  retry?: boolean;
  link?: { href: string; label: string };
}

const NOT_ZERO = "Unavailable evidence is never shown as 0. Show performance is unknown, not zero.";

function copyFor(state: LiveIntelligenceState): Copy | null {
  switch (state.kind) {
    case "not_configured":
      return {
        icon: "ri-plug-line",
        title: "No provider evidence is set up on this server",
        body: "Unavailable: no provider-observed TikTok Shop / LIVE metrics are supplied here. Account connection does not supply show performance analytics, so views, GMV, CTR, conversion, engagement and sales stay unavailable.",
        attention: false,
        link: { href: "/integrations", label: "See what is available" },
      };
    case "access_not_granted":
      return {
        icon: "ri-lock-line",
        title: "Access to TikTok Shop analytics has not been granted",
        body: "A provider is set up, but the seller has not authorised this deployment to read analytics for this account. Nothing was fetched.",
        attention: true,
        link: { href: "/integrations", label: "See provider access" },
      };
    case "auth_expired":
      return {
        icon: "ri-key-2-line",
        title: "The provider authorization has expired",
        body: "The TikTok Shop authorization was revoked or ran out, so LiveLift cannot fetch evidence until it is renewed. Nothing was fetched.",
        attention: true,
        link: { href: "/integrations", label: "See provider access" },
      };
    case "rate_limited":
      return {
        icon: "ri-timer-line",
        title: "The provider is limiting requests",
        body: state.retryAfterSec
          ? `TikTok is limiting how often evidence can be fetched. Try again in about ${state.retryAfterSec <= 90 ? `${state.retryAfterSec} seconds` : `${Math.ceil(state.retryAfterSec / 60)} minutes`}.`
          : "TikTok is limiting how often evidence can be fetched. Try again in a few minutes.",
        attention: true,
        retry: true,
      };
    case "unsupported":
      return {
        icon: "ri-shield-line",
        title: "The official API does not offer this evidence",
        body: "TikTok's official APIs do not provide this for this show. That is a limit of the platform, not something to configure.",
        attention: false,
      };
    case "unavailable": {
      if (state.reason === "settling") return { icon: "ri-hourglass-line", title: "Provider metrics are still settling", body: state.message, attention: false, retry: true };
      const untrusted = ["malformed", "wrong_perspective", "session_mismatch", "rejected_fixture"].includes(state.reason);
      return {
        icon: untrusted ? "ri-shield-cross-line" : "ri-cloud-off-line",
        title: untrusted ? "LiveLift could not trust the evidence the server sent" : "Provider evidence could not be fetched",
        body: state.message,
        attention: true,
        retry: !untrusted,
      };
    }
    case "signed_out":
      return { icon: "ri-lock-line", title: "Sign in to see provider evidence", body: "REAL shows and their provider evidence live behind sign-in.", attention: false, link: { href: "/login", label: "Sign in" } };
    case "forbidden":
      return { icon: "ri-lock-line", title: "Provider evidence is not available to this account", body: "The server did not allow this account to read it.", attention: false };
    case "not_applicable":
      return { icon: "ri-archive-line", title: "No provider evidence for a local archive", body: state.message, attention: false };
    default:
      return null;
  }
}

export function ProviderStatePanel({
  state,
  onRetry,
  onRequest,
  requestLabel = "Check provider evidence",
  className = "",
}: {
  state: LiveIntelligenceState;
  onRetry?: () => void;
  /** For `idle`: the explicit action that asks for the evidence. */
  onRequest?: () => void;
  requestLabel?: string;
  className?: string;
}): React.ReactElement | null {
  if (state.kind === "available") return null;

  if (state.kind === "fetching") {
    return (
      <div role="status" aria-busy="true" data-testid="provider-state" data-kind="fetching" className={`rounded-[12px] bg-[#13161C] px-4 py-4 ${className}`}>
        <p className="text-[16px] text-[#CAD0DA]">Fetching provider evidence…</p>
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-3 w-2/3 rounded bg-[#1B1F27] motion-safe:animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-[#1B1F27] motion-safe:animate-pulse" />
        </div>
      </div>
    );
  }

  if (state.kind === "idle") {
    return (
      <div data-testid="provider-state" data-kind="idle" className={`rounded-[12px] bg-[#13161C] px-4 py-4 ${className}`}>
        <p className="text-[16px] text-[#CAD0DA]">Provider evidence has not been requested for this show yet.</p>
        {onRequest && (
          <Button variant="secondary" size="md" icon="ri-database-2-line" className="mt-3" onClick={onRequest} data-testid="provider-request-btn">
            {requestLabel}
          </Button>
        )}
      </div>
    );
  }

  const c = copyFor(state);
  if (!c) return null;
  return (
    <div role="status" data-testid="provider-state" data-kind={state.kind} className={`rounded-[12px] bg-[#13161C] px-4 py-4 ${className}`}>
      <div className="flex items-start gap-3">
        <i className={`${c.icon} mt-0.5 text-[22px] ${c.attention ? "text-[#F6C875]" : "text-[#9AA5B5]"}`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-[17px] font-medium leading-snug text-[#F5F7FC]">{c.title}</h3>
          <p className="mt-1 max-w-[720px] text-[15px] leading-relaxed text-[#CAD0DA]">{c.body}</p>
          <p className="mt-2 text-[14px] text-[#9AA5B5]">{NOT_ZERO}</p>
          {(c.retry || c.link) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.retry && onRetry && (
                <Button variant="secondary" size="md" icon="ri-refresh-line" onClick={onRetry} data-testid="provider-retry-btn">
                  Try again
                </Button>
              )}
              {c.link && (
                <Link href={c.link.href} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 text-[15px] font-medium text-[#CAD0DA] hover:bg-[#1E232B] hover:text-white">
                  {c.link.label}
                  <i className="ri-arrow-right-line" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
