"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { remoteRoomStore, type RemoteProblem } from "@/lib/store/remoteRoomStore";
import { useSession, type SessionSource } from "@/lib/store/hooks";

export interface GateContext {
  /** Where this show's authority lives. REAL shows are "remote"; rehearsals and the local archive are "local". */
  source: SessionSource;
  /** A pre-Phase-2 REAL show kept in this browser: history only. */
  archive: boolean;
}

/**
 * Resolves a show by its exact id. Unknown ids get a real not-found state — they never fall
 * back to some other show — and nothing renders as "empty" before the data has loaded. A REAL id
 * is never reported "not found" while the room cannot be asked: that is "unavailable", not "missing".
 *
 * `?archive=1` selects a pre-Phase-2 REAL show from this browser. Those open read-only and only where
 * `allowArchive` is set (Review); everywhere else they explain what they are.
 */
export function SessionGate(props: {
  id: string;
  allowArchive?: boolean;
  children: (session: Session, ctx: GateContext) => React.ReactNode;
}): React.ReactElement {
  return (
    <Suspense fallback={<GateMessage busy>Loading show…</GateMessage>}>
      <Gate {...props} />
    </Suspense>
  );
}

/** Why a REAL show cannot be opened right now: the headline, and what LiveLift can and cannot say about the id. */
function unavailableCopy(problem: RemoteProblem | null): { title: string; cause: string; signIn: boolean } {
  switch (problem) {
    case "signed_out":
      return { title: "Sign in to open this show", cause: "you are signed out of the shared room", signIn: true };
    case "session_ended":
      return { title: "Your session ended", cause: "your session ended (it expired or was revoked)", signIn: true };
    case "auth_unavailable":
      return { title: "Sign-in is unavailable", cause: "the sign-in service cannot be reached", signIn: false };
    case "storage_unavailable":
      return { title: "The room's storage is unavailable", cause: "the room's storage is not available", signIn: false };
    case "backend_unavailable":
      return { title: "The room is unavailable", cause: "the room server is not available", signIn: false };
    case "wrong_deployment":
      return { title: "This session belongs to a different workspace", cause: "this session's workspace is not the one this server is set up for", signIn: false };
    case "recovery_required":
      return { title: "The room was restored from a backup", cause: "the room was restored and the session is being re-checked", signIn: false };
    case "context_required":
    case "request_refused":
    case "forbidden":
      return { title: "The room did not accept this session", cause: "the room did not accept this session's request", signIn: false };
    default:
      return { title: "The room cannot be reached", cause: "it cannot reach the room right now", signIn: false };
  }
}

function GateMessage({ children, busy = false }: { children: React.ReactNode; busy?: boolean }): React.ReactElement {
  return (
    <StandardShell>
      <div className="flex-1 flex items-center justify-center p-12" role={busy ? "status" : undefined}>
        <p className="text-[18px] text-[#9AA5B5]">{children}</p>
      </div>
    </StandardShell>
  );
}

function Gate({
  id,
  allowArchive = false,
  children,
}: {
  id: string;
  allowArchive?: boolean;
  children: (session: Session, ctx: GateContext) => React.ReactNode;
}): React.ReactElement {
  const params = useSearchParams();
  const archive = params.get("archive") === "1";
  const lookup = useSession(id, { archive });
  const pathname = usePathname();

  if (lookup.status === "loading") return <GateMessage busy>Loading show…</GateMessage>;

  if (lookup.status === "unavailable") {
    const copy = unavailableCopy(lookup.problem);
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="session-unavailable" data-problem={lookup.problem ?? undefined}>
          <span className="text-[44px] text-[#F6C875]">
            <i className="ri-wifi-off-line" aria-hidden="true" />
          </span>
          <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">{copy.title}</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[560px]">
            REAL shows live in the shared room, and {copy.cause}, so LiveLift cannot tell you whether{" "}
            <span className="font-mono text-[#F5F7FC]">{id}</span> exists. That is not the same as it being missing. {lookup.reason}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {copy.signIn ? (
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
                <Button variant="primary">{lookup.problem === "session_ended" ? "Sign in again" : "Sign in"}</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void remoteRoomStore.refreshNow()}>
                Try again
              </Button>
            )}
            <Link href="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </div>
        </div>
      </StandardShell>
    );
  }

  if (lookup.status === "missing") {
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="session-not-found">
          <span className="text-[44px] text-[#DFFF00]">
            <i className="ri-error-warning-line" aria-hidden="true" />
          </span>
          <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">Show not found</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
            {archive ? (
              <>
                No archived show with the id <span className="font-mono text-[#F5F7FC]">{id}</span> exists in this browser.
              </>
            ) : (
              <>
                No show with the id <span className="font-mono text-[#F5F7FC]">{id}</span> exists in the shared room or among this browser&apos;s
                rehearsals.
              </>
            )}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/sessions">
              <Button variant="primary">View all sessions</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </div>
        </div>
      </StandardShell>
    );
  }

  if (lookup.archive && !allowArchive) {
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="archive-readonly">
          <h1 className="text-[28px] font-medium text-[#F5F7FC]">Local archive · read-only</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[560px]">
            <strong className="text-[#F5F7FC]">{lookup.session.title}</strong> was recorded in this browser before LiveLift moved REAL shows to the
            shared room. It is kept as history only: it cannot be prepared, run or changed here, and it is not part of the room.
          </p>
          <Link href={`/live/${lookup.session.id}/review?archive=1`} className="mt-6">
            <Button variant="primary" icon="ri-arrow-right-line">
              View archived review
            </Button>
          </Link>
        </div>
      </StandardShell>
    );
  }

  return <>{children(lookup.session, { source: lookup.source, archive: lookup.archive })}</>;
}
