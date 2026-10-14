"use client";

import React, { useState } from "react";
import type { TikTokConnectionState, TikTokStatusView, TikTokUnavailableReason } from "@/contracts/tiktok";
import { TIKTOK_ROUTES } from "@/contracts/tiktok";
import { Button, InlineNotice } from "@/components/ui";
import type { TikTokConnection } from "./useTikTokConnection";

type Label = { text: string; tone: string; icon: string };
const LABELS: Record<TikTokConnectionState | "connecting", Label> = {
  not_configured: { text: "Not configured", tone: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]", icon: "ri-settings-3-line" },
  ready: { text: "Ready to connect", tone: "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]", icon: "ri-plug-line" },
  connecting: { text: "Connecting", tone: "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]", icon: "ri-loader-4-line" },
  connected: { text: "Connected", tone: "bg-[#1E2718] text-[#DFFF00] border-[#3E5224]", icon: "ri-checkbox-circle-line" },
  expired: { text: "Authorization expired", tone: "bg-[#2A2316] text-[#F6C875] border-[#5E4822]", icon: "ri-time-line" },
  unavailable: { text: "Provider unavailable", tone: "bg-[#1B1F27] text-[#CAD0DA] border-[#333C4B]", icon: "ri-question-line" },
  disconnected: { text: "Disconnected", tone: "bg-[#20181A] text-[#9AA5B5] border-[#3D262B]", icon: "ri-link-unlink-m" },
};

const REASON_TEXT: Record<TikTokUnavailableReason, string> = {
  network: "LiveLift could not reach TikTok at the last check.",
  timeout: "TikTok did not answer in time at the last check.",
  provider_error: "TikTok returned an error or an answer LiveLift could not use at the last check.",
  rate_limited: "TikTok limited requests at the last check.",
  app_credentials_rejected: "TikTok rejected this deployment's app credentials at the last check. Check the client key and secret.",
  credential_unreadable: "LiveLift could not read its stored TikTok credential. The encryption key may have changed. Disconnect and connect again.",
};

const SCOPE_TEXT: Record<string, string> = {
  "user.info.basic": "Read your TikTok open ID, avatar and display name",
  "user.info.profile": "Read your TikTok username and verification status",
};

const when = (ms: number | null): React.ReactNode =>
  ms === null ? "not recorded" : <time dateTime={new Date(ms).toISOString()}>{new Date(ms).toLocaleString()}</time>;

function Initials({ name }: { name: string | null }): React.ReactElement {
  return (
    <span aria-hidden="true" className="h-[72px] w-[72px] shrink-0 rounded-full bg-[#242A34] text-[#CAD0DA] flex items-center justify-center text-[28px] font-semibold">
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** A small labelled group inside the profile card. */
function Group({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }): React.ReactElement {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-[13px] font-semibold tracking-[1.2px] uppercase text-[#9AA5B5]">{title}</dt>
      <dd className="mt-1.5 text-[15px] leading-relaxed text-[#E4E8F0]">{children}</dd>
    </div>
  );
}

function ProfileCard({ view }: { view: TikTokStatusView }): React.ReactElement | null {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const c = view.connection;
  if (!c) return null;
  const stale = view.state === "expired" || view.state === "unavailable";
  const ring = stale ? "ring-[#5E4822]" : "ring-[#3E5224]";
  return (
    <div className="rounded-[12px] bg-[#181C24] border border-[#2D3545]" data-testid="tiktok-profile">
      <div className="flex items-center gap-4 min-w-0 p-4 sm:p-5">
        <span className="relative shrink-0">
          {c.profile?.avatarAvailable && !avatarFailed ? (
            // Relayed through LiveLift so the page CSP stays img-src 'self'.
            <img src={`${TIKTOK_ROUTES.avatar}?v=${c.profileFetchedAtMs ?? 0}`} alt="" width={72} height={72} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} className={`h-[72px] w-[72px] rounded-full object-cover bg-[#242A34] ring-2 ring-offset-2 ring-offset-[#181C24] ${ring}`} />
          ) : (
            <Initials name={c.profile?.displayName ?? null} />
          )}
          {view.state === "connected" && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#DFFF00] text-[#111407] ring-2 ring-[#181C24]" aria-hidden="true">
              <i className="ri-check-line text-[16px]" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <div className="text-[22px] leading-tight font-semibold tracking-[-0.3px] text-[#F5F7FC] break-words" data-testid="tiktok-display-name">
            {c.profile?.displayName ?? "Display name not available"}
          </div>
          {c.profile?.username && <div className="mt-0.5 text-[15px] text-[#B7C1CE] break-all">@{c.profile.username}{c.profile.isVerified === true ? " · verified by TikTok" : ""}</div>}
          {c.profile && !c.profile.avatarAvailable && <div className="text-[14px] text-[#9AA5B5]">Avatar not available</div>}
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-[6px] border border-[#2B323F] bg-[#161B22] px-2 py-0.5 text-[13px] font-medium text-[#CAD0DA]">
            <i className="ri-eye-line" aria-hidden="true" />
            Provider observed identity
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 border-t border-[#262D3A] p-4 sm:p-5">
        <Group title="TikTok open ID">
          <span className="font-mono text-[14px] break-all" data-testid="tiktok-open-id">{c.openId ?? "not available"}</span>
        </Group>
        <Group title="Permissions granted" testId="tiktok-scopes">
          {c.grantedScopes.length ? (
            <ul className="space-y-1.5">
              {c.grantedScopes.map((sc) => (
                <li key={sc} className="flex items-start gap-2">
                  <i className="ri-check-line mt-0.5 text-[#DFFF00]" aria-hidden="true" />
                  <span><span className="font-mono text-[14px]">{sc}</span>{SCOPE_TEXT[sc] ? <span className="block text-[14px] text-[#9AA5B5]">{SCOPE_TEXT[sc]}</span> : null}</span>
                </li>
              ))}
            </ul>
          ) : "none recorded"}
          {c.notGrantedScopes.length > 0 && (
            <p className="mt-2 flex items-start gap-2 text-[14px] text-[#F6C875]">
              <i className="ri-close-line mt-0.5" aria-hidden="true" />
              <span>Requested, not granted: <span className="font-mono">{c.notGrantedScopes.join(", ")}</span></span>
            </p>
          )}
        </Group>
        <Group title="Profile source">
          <span className="text-[#CAD0DA]">
            Provider observed via TikTok User Info, {c.profileFetchedAtMs === null ? "not yet read" : <>{stale ? "last read " : "read "}{when(c.profileFetchedAtMs)}</>}
            {c.profileState === "partial" && " · some fields TikTok did not return are shown as not available"}
            {c.profileState === "scope_missing" && " · the granted scopes do not allow reading the profile"}
          </span>
        </Group>
        <Group title="Timeline">
          <ul className="space-y-0.5 text-[#CAD0DA]">
            {c.connectedAtMs !== null && <li><span className="text-[#9AA5B5]">Connected</span> {when(c.connectedAtMs)}</li>}
            {c.lastCheckedAtMs !== null && <li><span className="text-[#9AA5B5]">Last checked</span> {when(c.lastCheckedAtMs)}</li>}
            {c.authorizationValidUntilMs !== null && <li><span className="text-[#9AA5B5]">Renews without you until</span> {when(c.authorizationValidUntilMs)}</li>}
          </ul>
        </Group>
      </dl>
    </div>
  );
}

const NOT_ESTABLISHED: [string, string][] = [
  ["TikTok LIVE eligibility", "no documented TikTok API for checking it"],
  ["TikTok Shop", "a separate Partner Center authorization, not connected"],
  ["LIVE chat, engagement and analytics", "no documented API for this kind of app"],
  ["Pin / unpin or promotion verification", "LiveLift cannot confirm these; you act in TikTok and report it"],
];

export function TikTokConnectionPanel({ connection }: { connection: TikTokConnection }): React.ReactElement {
  const { state, busy, notice, canManage } = connection;
  const [confirming, setConfirming] = useState(false);
  const view = state.kind === "loaded" ? state.view : null;
  const labelKey: TikTokConnectionState | "connecting" = busy === "connecting" ? "connecting" : view?.state ?? "not_configured";
  const label = state.kind === "loaded" || busy === "connecting" ? LABELS[labelKey] : null;
  const busyNow = busy !== null;

  return (
    <section aria-labelledby="tiktok-connection-heading" data-testid="tiktok-connection" className={`rounded-[14px] bg-[#13161C] border p-5 sm:p-6 space-y-5 ${view?.state === "connected" ? "border-[#3E5224]" : "border-[#252C38]"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#1B1F27] text-[22px] text-[#F5F7FC]" aria-hidden="true"><i className="ri-tiktok-line" /></span>
          <div className="space-y-1 min-w-0">
          <h2 id="tiktok-connection-heading" className="text-[20px] font-semibold text-[#F5F7FC]">TikTok account (Login Kit)</h2>
          <p className="text-[15px] text-[#B7C1CE] leading-relaxed max-w-[760px]">
            Sign in with TikTok so LiveLift knows which TikTok account this workspace belongs to. This uses TikTok&apos;s official sign-in only. It does not start,
            read or control a LIVE.
          </p>
          </div>
        </div>
        {label && (
          <span data-testid="tiktok-state" className={`inline-flex items-center gap-1.5 text-[14px] font-medium px-3 py-1.5 rounded-[8px] border ${label.tone} shrink-0`}>
            <i className={label.icon} aria-hidden="true" />
            <span>{label.text}</span>
          </span>
        )}
      </div>

      {notice && (
        <div className="space-y-2" data-testid="tiktok-notice">
          <InlineNotice variant={notice.variant} message={notice.text} />
          <Button variant="ghost" size="sm" onClick={connection.dismissNotice} data-testid="tiktok-dismiss-notice">Dismiss</Button>
        </div>
      )}

      <div role="status" aria-live="polite" className="space-y-3">
        {state.kind === "checking" && <p className="text-[14px] text-[#9AA5B5]">Checking your sign-in…</p>}
        {state.kind === "needs_sign_in" && (
          <p className="text-[14px] text-[#CAD0DA]" data-testid="tiktok-needs-sign-in">
            Sign in to a LiveLift workspace to see or change its TikTok connection. The TikTok connection is stored on the room server, not in this browser. Rehearsals and manual shows work without it.
          </p>
        )}
        {state.kind === "server_unavailable" && (
          <p className="text-[14px] text-[#F6C875]" data-testid="tiktok-server-unavailable">
            The server could not be asked about TikTok ({state.message}) The connection state is unknown, not disconnected.
          </p>
        )}
        {view?.state === "not_configured" && (
          <div className="space-y-1.5" data-testid="tiktok-not-configured">
            <p className="text-[14px] text-[#CAD0DA]">TikTok sign-in is not set up on this deployment, so Connect TikTok is off. An administrator sets these server variables (names only; values are never shown):</p>
            <p className="font-mono text-[13px] text-[#F5F7FC] break-words">{view.configIssues.join(" · ")}</p>
            <p className="text-[13px] text-[#9AA5B5]">Steps: docs/tiktok/SANDBOX-SETUP.md</p>
          </div>
        )}
        {view?.state === "ready" && <p className="text-[14px] text-[#CAD0DA]">No TikTok account is connected. You will be sent to TikTok to approve {view.requestedScopes.length === 1 ? "one permission" : `${view.requestedScopes.length} permissions`}: <span className="font-mono">{view.requestedScopes.join(", ")}</span>.</p>}
        {view?.state === "expired" && <p className="text-[14px] text-[#F6C875]" data-testid="tiktok-expired">TikTok no longer accepts this authorization, so LiveLift stopped using it and erased the stored tokens. What is shown below is the last profile LiveLift read, not current. Connect again to continue.</p>}
        {view?.state === "unavailable" && view.connection?.unavailableReason && <p className="text-[14px] text-[#CAD0DA]" data-testid="tiktok-unavailable">{REASON_TEXT[view.connection.unavailableReason]} The authorization is still stored; its current standing is unknown, not failed. What is shown below was last read earlier.</p>}
        {view?.state === "disconnected" && (
          <p className="text-[14px] text-[#CAD0DA]" data-testid="tiktok-disconnected">
            Disconnected {when(view.disconnectedAtMs)}. LiveLift erased its stored credentials and profile.{" "}
            {view.lastRevocation === "confirmed" ? "TikTok confirmed the revocation." : view.lastRevocation === "unconfirmed" ? "TikTok did not confirm the revocation; you can remove LiveLift in TikTok's app permissions." : ""}
          </p>
        )}
        {view?.state === "connected" && <p className="text-[15px] text-[#CAD0DA]" data-testid="tiktok-connected-note">This workspace is linked to the TikTok account below. The connection only identifies that account; it does not give LiveLift any control over a LIVE.</p>}
        {view && view.connection && ["connected", "unavailable", "expired"].includes(view.state) && <ProfileCard view={view} />}
      </div>

      <div className="flex items-center gap-3 flex-wrap" data-testid="tiktok-actions">
        {view && ["ready", "disconnected", "expired"].includes(view.state) && (
          <Button variant="primary" icon="ri-tiktok-line" disabled={!canManage || busyNow} aria-busy={busy === "connecting" || undefined} onClick={() => void connection.connect()} data-testid="tiktok-connect">
            {busy === "connecting" ? "Opening TikTok…" : view.state === "expired" ? "Reconnect TikTok" : "Connect TikTok"}
          </Button>
        )}
        {view && ["connected", "unavailable"].includes(view.state) && (
          <>
            <Button variant="secondary" icon="ri-refresh-line" disabled={!canManage || busyNow} aria-busy={busy === "refreshing" || undefined} onClick={() => void connection.refresh()} data-testid="tiktok-refresh">
              {busy === "refreshing" ? "Checking…" : "Check connection"}
            </Button>
            {!confirming ? (
              <Button variant="danger" icon="ri-link-unlink-m" disabled={!canManage || busyNow} onClick={() => setConfirming(true)} data-testid="tiktok-disconnect" className="sm:ml-auto">Disconnect</Button>
            ) : (
              <span className="inline-flex items-center gap-2 flex-wrap">
                <span className="text-[14px] text-[#F6C875]">Erase LiveLift&apos;s TikTok credentials and ask TikTok to revoke?</span>
                <Button variant="danger" disabled={busyNow} onClick={() => { setConfirming(false); void connection.disconnect(); }} data-testid="tiktok-disconnect-confirm">{busy === "disconnecting" ? "Disconnecting…" : "Yes, disconnect"}</Button>
                <Button variant="ghost" disabled={busyNow} onClick={() => setConfirming(false)}>Keep connected</Button>
              </span>
            )}
          </>
        )}
        {view && view.state === "expired" && (
          <Button variant="ghost" icon="ri-delete-bin-line" disabled={!canManage || busyNow} onClick={() => void connection.disconnect()}>Remove</Button>
        )}
        {view && view.state !== "not_configured" && !canManage && (
          <p className="text-[14px] text-[#F6C875]" data-testid="tiktok-viewer-note">Only operators can change the TikTok connection. You are signed in as a viewer.</p>
        )}
      </div>

      <div className="rounded-[12px] bg-[#0D0F14] border border-[#191F2B] p-4 sm:p-5 space-y-3" data-testid="tiktok-limits">
        <h3 className="text-[16px] font-semibold text-[#F5F7FC]">What this connection does not establish</h3>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 text-[14px] leading-relaxed text-[#B7C1CE]">
          {NOT_ESTABLISHED.map(([name, why]) => (
            <li key={name} className="flex items-start gap-2.5">
              <i className="ri-subtract-line mt-0.5 text-[#9AA5B5]" aria-hidden="true" />
              <span><span className="text-[#F5F7FC]">{name}:</span> not established — {why}.</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-[#9AA5B5]">A connected TikTok account is a provider-observed identity. It is not platform-confirmed evidence about any show.</p>
      </div>
    </section>
  );
}
