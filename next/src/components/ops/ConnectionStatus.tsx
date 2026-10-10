"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { authStore } from "@/lib/client/authStore";
import { isTransientProblem, remoteRoomStore, type QuarantinedCommand, type RemoteProblem, type UnresolvedCommand } from "@/lib/store/remoteRoomStore";
import { useAuth, useRemoteState } from "@/lib/store/hooks";

/**
 * What the operator needs to know about the shared room, and nothing more:
 * signed out · session ended · connecting · connected · reconnecting · backend / storage unavailable · wrong deployment ·
 * restored database · waiting for confirmation · outcome unknown · read-only.
 * Everything here is silent for rehearsals (the room store is idle unless a REAL view is open).
 *
 * Nothing on this surface is a live region. Changes that matter to someone who cannot see the screen go through the
 * shared announcer once, as transitions; this component re-renders every second (the contact age) and must never be
 * the thing that is read out.
 */

function useAgeSeconds(active: boolean): number | null {
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = (): void => {
      const ms = remoteRoomStore.lastContactAgeMs();
      setAge(ms === null ? null : Math.round(ms / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return active ? age : null;
}

interface ChipLook {
  tone: string;
  icon: string;
  label: string;
}

function chipLook(
  remote: { connection: string; problem: RemoteProblem | null; inflight: unknown },
  age: number | null
): ChipLook {
  const amber = "text-[#F6C875]";
  const red = "text-[#F4A4A4]";
  const since = age !== null ? ` · last contact ${age}s ago` : "";
  switch (remote.problem) {
    case "signed_out":
      return { tone: amber, icon: "ri-lock-line", label: "Signed out" };
    case "session_ended":
      return { tone: amber, icon: "ri-lock-line", label: "Session ended" };
    case "auth_unavailable":
      return { tone: red, icon: "ri-wifi-off-line", label: "Sign-in unavailable" };
    case "storage_unavailable":
      return { tone: red, icon: "ri-database-2-line", label: `Room storage unavailable${since}` };
    case "backend_unavailable":
      return { tone: red, icon: "ri-server-line", label: `Room unavailable${since}` };
    case "wrong_deployment":
      return { tone: red, icon: "ri-error-warning-line", label: "Wrong workspace" };
    case "recovery_required":
      return { tone: amber, icon: "ri-history-line", label: "Room restored · reloading" };
    case "context_required":
    case "request_refused":
    case "forbidden":
      return { tone: red, icon: "ri-error-warning-line", label: "Session context problem" };
    default:
      break;
  }
  if (remote.connection === "connecting" || remote.connection === "idle") return { tone: "text-[#CAD0DA]", icon: "ri-loader-4-line", label: "Connecting to room…" };
  if (remote.connection === "stale") {
    return { tone: amber, icon: "ri-wifi-off-line", label: isTransientProblem(remote.problem) ? `Not current · reconnecting${since}` : age !== null ? `Not current · last contact ${age}s ago` : "Not current" };
  }
  if (remote.connection === "disconnected") return { tone: red, icon: "ri-wifi-off-line", label: isTransientProblem(remote.problem) ? "Disconnected · reconnecting" : "Disconnected" };
  if (remote.inflight) return { tone: "text-[#DFFF00]", icon: "ri-time-line", label: "Waiting for confirmation…" };
  return { tone: "text-[#CAD0DA]", icon: "ri-wifi-line", label: "Connected" };
}

export function ConnectionChip({ size = "md" }: { size?: "md" | "desk" }): React.ReactElement | null {
  const remote = useRemoteState();
  const notCurrent = remote.connection === "stale" || remote.connection === "disconnected";
  const age = useAgeSeconds(notCurrent);
  if (!remote.active) return null;

  // The page header row is tight between 1024px and 1440px: there the chip is an icon (state, with the words kept for
  // screen readers) plus the role. The banner under the header says it all in full. The stacked mobile menu and the
  // operating desk have the room and spell it out.
  const text = size === "desk" ? "text-[16px]" : "text-[15px]";
  const words = size === "desk" ? "" : "lg:max-[1439px]:sr-only";
  const viewer = remote.access?.role === "viewer";
  const { tone, icon, label } = chipLook(remote, age);

  return (
    <span className={`inline-flex items-center gap-2 transition-colors duration-200 ${text} ${tone}`} data-testid="connection-chip" data-connection={remote.connection} data-problem={remote.problem ?? undefined} title={remote.lastError ?? undefined}>
      <i className={icon} aria-hidden="true" />
      <span className={words}>{label}</span>
      {remote.connection === "connected" && remote.access && (
        <span
          className={`rounded-[6px] px-1.5 ${viewer ? "bg-[#2A2316] text-[#F6C875]" : "bg-[#242A22] text-[#DFFF00]"}`}
          data-testid="access-role"
          title={`Signed in to the room as ${remote.access.name}`}
        >
          {viewer ? "Viewer" : "Operator"}
          {viewer && <span className={words}> · read-only</span>}
        </span>
      )}
    </span>
  );
}

function UnresolvedBanner({ entry, size }: { entry: UnresolvedCommand; size: "md" | "desk" }): React.ReactElement {
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  const busy = entry.lookup === "checking" || entry.retrying;
  return (
    <div data-testid="outcome-unknown-banner" className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 flex-wrap bg-[#2A2316] text-[#F6C875]`}>
      <span className="min-w-0">
        <strong className="mr-1.5">OUTCOME UNKNOWN</strong>
        {entry.detail}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <Button size="desk" variant="secondary" disabled={busy} onClick={() => void remoteRoomStore.checkUnresolved()} data-testid="outcome-check-btn">
          Check status
        </Button>
        <Button size="desk" variant="secondary" disabled={busy} onClick={() => void remoteRoomStore.retryUnresolved(entry.commandId)} data-testid="outcome-retry-btn">
          Retry same action
        </Button>
        <Button size="desk" variant="ghost" disabled={busy} onClick={() => remoteRoomStore.dismissUnresolved(entry.commandId)} data-testid="outcome-dismiss-btn">
          Set aside
        </Button>
      </span>
    </div>
  );
}

function QuarantineItem({ item, size }: { item: QuarantinedCommand; size: "md" | "desk" }): React.ReactElement {
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  return (
    <li data-testid="quarantine-item" data-reason={item.reason} className={`flex items-center justify-between gap-3 flex-wrap ${text}`}>
      <span className="min-w-0">
        <strong className="text-[#F5F7FC]">{item.label}</strong>{" "}
        {item.reason === "older_generation"
          ? "was sent before the room was restored from a backup. It may or may not be in the restored data."
          : "was saved by an older version of LiveLift, so it cannot be tied to an account. Its outcome is unknown."}{" "}
        It will not be checked or sent again.
      </span>
      <Button size="desk" variant="ghost" onClick={() => remoteRoomStore.dismissQuarantined(item.commandId)} data-testid="quarantine-dismiss-btn">
        Set aside
      </Button>
    </li>
  );
}

const time = (ms: number): React.ReactElement => (
  <time dateTime={new Date(ms).toISOString()} className="whitespace-nowrap">
    {new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
  </time>
);

/** The restore notice: what happened, when, up to which revision, and what that means for anything newer. */
function RecoveryNoticeBanner({ size }: { size: "md" | "desk" }): React.ReactElement | null {
  const auth = useAuth();
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  const recovery = auth.recovery;
  if (!recovery) return null;
  const n = recovery.notice;
  return (
    <div data-testid="recovery-notice" className={`rounded-[8px] px-3 py-2 ${text} flex items-start justify-between gap-3 flex-wrap bg-[#161B22] text-[#CAD0DA] border border-[#2B3324]`}>
      <div className="min-w-0 space-y-1">
        <p>
          <i className="ri-history-line mr-1.5 text-[#DFFF00]" aria-hidden="true" />
          <strong className="text-[#F5F7FC]">This room was restored from a backup.</strong>{" "}
          {n ? (
            <>
              It was restored {time(n.restoredAtMs)} from a backup taken {time(n.backupTakenAtMs)}, at room revision{" "}
              <span data-testid="recovery-revision" className="tabular-nums">{n.backupRevision}</span>.
            </>
          ) : (
            <>It was restored since you last used it.</>
          )}
        </p>
        <p>
          Anything recorded after the backup may be missing, and what happened to it is <strong className="text-[#F5F7FC]">unknown</strong>, not failed. LiveLift discarded what it had
          on screen and reloaded the room from the restored data. Check each show&apos;s history before you continue.
        </p>
      </div>
      <Button size="desk" variant="secondary" onClick={() => authStore.dismissRecovery()} data-testid="recovery-dismiss-btn">
        I have read this
      </Button>
    </div>
  );
}

interface ProblemCopy {
  title: string;
  text: string;
  tone: "warn" | "danger";
  action: "sign_in" | "retry" | "retry_and_sign_out" | "auth_retry";
}

/** The truthful sentence for each reason the room cannot be shown as current. None of them says the room is empty. */
function problemCopy(problem: RemoteProblem | null, hasSnapshot: boolean): ProblemCopy {
  const last = "What you see is the last confirmed state; it is not being updated and changes are paused.";
  switch (problem) {
    case "signed_out":
      return { title: "Sign in to see REAL shows", tone: "warn", action: "sign_in", text: "You are signed out, so REAL shows are not shown or recorded. Sign in to continue. Rehearsals still work." };
    case "session_ended":
      return { title: "Your session ended",
        tone: "warn",
        action: "sign_in",
        text: `Your session ended (it expired or was revoked). ${hasSnapshot ? last : "REAL shows cannot be shown or recorded."} Anything you had already sent stays saved and is checked when you sign in again.`,
      };
    case "auth_unavailable":
      return { title: "Sign-in is unavailable", tone: "danger", action: "auth_retry", text: "The sign-in service cannot be reached, so REAL shows cannot be shown or recorded. LiveLift keeps asking. Rehearsals still work." };
    case "storage_unavailable":
      return { title: "The room's storage is unavailable",
        tone: "danger",
        action: "retry",
        text: hasSnapshot
          ? `The room's storage is not available. ${last}`
          : "The room's storage is not available, so REAL shows cannot be shown or recorded right now. That does not mean the room is empty. LiveLift keeps trying. Rehearsals still work.",
      };
    case "backend_unavailable":
      return { title: "The room is unavailable",
        tone: "danger",
        action: "retry",
        text: hasSnapshot
          ? `The room server is not available. ${last}`
          : "The room server is not available, so REAL shows cannot be shown or recorded right now. That does not mean the room is empty. LiveLift keeps trying. Rehearsals still work.",
      };
    case "wrong_deployment":
      return { title: "This session belongs to a different workspace",
        tone: "danger",
        action: "retry_and_sign_out",
        text: "This session's workspace or room is not the one this server is set up for, so nothing from it is shown or recorded. Sign out and sign in again; if it continues, tell your administrator.",
      };
    case "context_required":
      return { title: "The room did not accept this session", tone: "danger", action: "retry_and_sign_out", text: "The server did not receive this session's workspace context, so it would not answer. LiveLift is re-checking the session." };
    case "recovery_required":
      return { title: "The room was restored from a backup", tone: "warn", action: "retry", text: "The room was restored from a backup since this session began. LiveLift is re-checking the session and will reload the room from the restored data." };
    case "request_refused":
      return { title: "The server refused this request", tone: "danger", action: "retry_and_sign_out", text: "The server refused this browser's request as unsafe. Reload the page; if it continues, sign out and in again." };
    case "forbidden":
      return { title: "The room did not accept this session", tone: "danger", action: "retry_and_sign_out", text: "The room did not allow this session to read it. LiveLift is re-checking your access." };
    case "rate_limited":
      return { title: "The room is busy", tone: "warn", action: "retry", text: `The room is limiting how often it is asked. LiveLift will try again. ${hasSnapshot ? last : ""}` };
    default:
      return {
        title: "The room cannot be reached",
        tone: hasSnapshot ? "warn" : "danger",
        action: "retry",
        text: hasSnapshot ? `Not connected to the room. ${last}` : "The room cannot be reached, so REAL shows cannot be shown or recorded. Rehearsals still work.",
      };
  }
}

/** Banners for sign-in, lost contact, restore, unresolved commands and their later resolutions. Renders nothing when all is well. */
export function RemoteBanners({ size = "md" }: { size?: "md" | "desk" }): React.ReactElement | null {
  const remote = useRemoteState();
  const auth = useAuth();
  const pathname = usePathname();
  // Lost contact is only news while a REAL view is open; unresolved commands matter until they are settled.
  const notCurrent = remote.active && (remote.connection === "stale" || remote.connection === "disconnected" || remote.problem !== null);
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  const showRecovery = remote.active && auth.recovery !== null;
  const show = notCurrent || remote.unresolved.length > 0 || remote.quarantined.length > 0 || remote.resolutions.length > 0 || showRecovery;
  if (!show) return null;
  const copy = problemCopy(remote.problem, remote.snapshot !== null);

  return (
    <div className="px-4 lg:px-6 pt-2 space-y-2 shrink-0" data-testid="remote-banners" role="region" aria-label="Room status">
      {notCurrent && (
        <div
          data-testid="stale-banner"
          data-problem={remote.problem ?? undefined}
          className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 flex-wrap ${copy.tone === "danger" ? "bg-[#302025] text-[#F4A4A4]" : "bg-[#2A2316] text-[#F6C875]"}`}
        >
          <span className="min-w-0">
            <i className="ri-wifi-off-line mr-1.5" aria-hidden="true" />
            {copy.text}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {copy.action === "sign_in" ? (
              <Link
                href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                className="min-h-[44px] px-2.5 rounded-[8px] inline-flex items-center text-[16px] font-medium bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944]"
                data-testid="banner-sign-in"
              >
                {remote.problem === "session_ended" ? "Sign in again" : "Sign in"}
              </Link>
            ) : copy.action === "auth_retry" ? (
              <Button size="desk" variant="secondary" onClick={() => void authStore.bootstrap()} data-testid="reconnect-btn">
                Try now
              </Button>
            ) : (
              <>
                <Button size="desk" variant="secondary" onClick={() => void remoteRoomStore.refreshNow()} data-testid="reconnect-btn">
                  {copy.action === "retry_and_sign_out" ? "Try again" : "Try now"}
                </Button>
                {copy.action === "retry_and_sign_out" && (
                  <Button size="desk" variant="ghost" onClick={() => void authStore.logout()} data-testid="banner-sign-out-btn">
                    Sign out
                  </Button>
                )}
              </>
            )}
          </span>
        </div>
      )}
      {showRecovery && <RecoveryNoticeBanner size={size} />}
      {remote.unresolved.map((entry) => (
        <UnresolvedBanner key={entry.commandId} entry={entry} size={size} />
      ))}
      {remote.quarantined.length > 0 && (
        <div data-testid="quarantine-list" className="rounded-[8px] px-3 py-2 bg-[#161B22] text-[#CAD0DA] border border-[#2A303A] space-y-2">
          <p className={`${text} text-[#F5F7FC]`}>
            <strong>Earlier actions kept for recovery.</strong> They are listed so nothing is lost silently. LiveLift does not look them up or send them again.
          </p>
          <ul className="space-y-1.5">
            {remote.quarantined.map((q) => (
              <QuarantineItem key={q.commandId} item={q} size={size} />
            ))}
          </ul>
        </div>
      )}
      {remote.resolutions.map((r) => (
        <div
          key={r.id}
          data-testid="outcome-resolution"
          className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 ${
            r.tone === "ok" ? "bg-[#161B22] text-[#DFFF00] border border-[#2B3324]" : "bg-[#2A2316] text-[#F6C875]"
          }`}
        >
          <span className="min-w-0">{r.text}</span>
          <button
            type="button"
            onClick={() => remoteRoomStore.dismissResolution(r.id)}
            className="min-h-[44px] min-w-[44px] text-[#CAD0DA] hover:text-white cursor-pointer"
            aria-label="Dismiss"
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * In place of an empty list: when REAL shows cannot be loaded at all, say why, and never let the page look like a
 * room with no shows (or like a first-time setup). Renders nothing once the room has answered, or while it is
 * still being asked.
 */
export function RoomStatusPanel(): React.ReactElement | null {
  const remote = useRemoteState();
  const pathname = usePathname();
  if (!remote.active || remote.snapshot !== null || remote.problem === null) return null;
  const copy = problemCopy(remote.problem, false);
  return (
    <div
      className={`rounded-[12px] p-6 ${copy.tone === "danger" ? "bg-[#302025]" : "bg-[#2A2316]"}`}
      data-testid="room-status-panel"
      data-problem={remote.problem}
    >
      <h2 className={`text-[22px] font-medium ${copy.tone === "danger" ? "text-[#F4A4A4]" : "text-[#F6C875]"}`}>{copy.title}</h2>
      <p className="text-[16px] leading-6 text-[#CAD0DA] mt-2 max-w-[680px]">{copy.text}</p>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {copy.action === "sign_in" ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname || "/")}`}
            className="min-h-[44px] px-4 rounded-[8px] inline-flex items-center text-[16px] font-semibold bg-[#DFFF00] text-[#111407] hover:bg-[#CBEA00]"
            data-testid="panel-sign-in"
          >
            {remote.problem === "session_ended" ? "Sign in again" : "Sign in"}
          </Link>
        ) : (
          <Button variant="secondary" onClick={() => void (copy.action === "auth_retry" ? authStore.bootstrap() : remoteRoomStore.refreshNow())} data-testid="panel-retry-btn">
            Try now
          </Button>
        )}
        <Link href="/simulator" className="min-h-[44px] px-3 rounded-[8px] inline-flex items-center text-[16px] text-[#CAD0DA] hover:text-white hover:bg-[#1E232B]">
          Try the Simulator instead
        </Link>
      </div>
    </div>
  );
}
