"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { authStore } from "@/lib/client/authStore";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { useAuth, useRemoteState } from "@/lib/store/hooks";

/**
 * Who is signed in, and the way out. Shown wherever a REAL view is in use (rehearsal-only screens show nothing of
 * the account, because they make no requests).
 *
 * Signing out is immediate unless something that was already sent is still unanswered. Then the person is told
 * plainly that signing out neither cancels nor fails it, and that its record stays saved under their account to be
 * checked next time they sign in. Nothing here claims a sent command failed.
 */
export function AccountControl({ size = "md" }: { size?: "md" | "desk" }): React.ReactElement | null {
  const auth = useAuth();
  const remote = useRemoteState();
  const pathname = usePathname();
  const [confirming, setConfirming] = useState(false);
  const text = size === "desk" ? "text-[16px]" : "text-[15px]";
  // Page header: spelled out in the stacked mobile menu and on wide screens, icon-only between, where the row is tight.
  // Operating desk: spelled out from 640px; on a phone the context line is full, and a clipped Sign out is unreachable.
  const words = size === "desk" ? "max-sm:sr-only" : "lg:max-[1439px]:sr-only";
  const waiting = remote.inflight !== null || remote.unresolved.length > 0;

  if (pathname === "/login") return null;

  if (auth.status === "checking" || auth.status === "signing_in" || auth.status === "signing_out") {
    return (
      <span className={`inline-flex items-center gap-2 ${text} text-[#CAD0DA]`} data-testid="account-pending">
        <i className="ri-loader-4-line" aria-hidden="true" />
        <span className={words}>{auth.status === "signing_out" ? "Signing out…" : "Checking sign-in…"}</span>
      </span>
    );
  }

  if (auth.status !== "authenticated" || !auth.session) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || "/")}`}
        className={`min-h-[44px] px-3 rounded-[8px] inline-flex items-center gap-2 ${text} text-[#F5F7FC] bg-[#292D35] hover:bg-[#343944]`}
        data-testid="sign-in-link"
      >
        <i className="ri-login-box-line" aria-hidden="true" />
        <span>{auth.status === "ended" ? "Sign in again" : "Sign in"}</span>
      </Link>
    );
  }

  const name = auth.session.access.name;
  const startSignOut = (): void => {
    if (!waiting) {
      void authStore.logout();
      return;
    }
    setConfirming(true);
    void remoteRoomStore.checkUnresolved(); // read-only receipt lookups: it may settle what is waiting before they decide
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${text} text-[#CAD0DA]`} data-testid="account-control">
      <i className="ri-user-3-line" aria-hidden="true" />
      <span className={`${words} max-w-[160px] truncate`} data-testid="account-name" title={`Signed in as ${name}`}>
        {name}
      </span>
      <Button size="desk" variant="ghost" onClick={startSignOut} title="Sign out" data-testid="sign-out-btn" className="min-w-[44px]">
        <i className="ri-logout-box-r-line" aria-hidden="true" />
        <span className={words}>Sign out</span>
      </Button>

      <Dialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title="Sign out with an action still waiting?"
        description="Signing out does not cancel, undo or fail anything that was already sent to the room."
        confirmText="Sign out"
        cancelText="Stay signed in"
        confirmVariant="danger"
        onConfirm={() => {
          setConfirming(false);
          void authStore.logout();
        }}
      >
        <div className="space-y-3 text-[16px] leading-6 text-[#CAD0DA]" data-testid="signout-waiting">
          {remote.inflight && (
            <p>
              <strong className="text-[#F5F7FC]">{remote.inflight.label}</strong> was sent and the room has not answered yet. Its outcome is unknown until it does.
            </p>
          )}
          {remote.unresolved.map((u) => (
            <p key={u.commandId}>
              <strong className="text-[#F5F7FC]">{u.label}</strong>: {u.detail}
            </p>
          ))}
          {!remote.inflight && remote.unresolved.length === 0 && <p>Nothing is waiting any more. It is safe to sign out.</p>}
          <p>
            Anything still unknown stays saved in this browser under {name}&apos;s account. LiveLift checks it again the next time {name} signs in, and
            it is never shown to anyone else.
          </p>
          <Button size="desk" variant="secondary" onClick={() => void remoteRoomStore.checkUnresolved()} data-testid="signout-check-btn">
            Check status now
          </Button>
        </div>
      </Dialog>
    </span>
  );
}
