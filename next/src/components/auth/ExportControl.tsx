"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { ExportResult } from "@/lib/client/authClient";
import { authStore } from "@/lib/client/authStore";
import { useAuth, useRemoteState } from "@/lib/store/hooks";

type ExportState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; filename: string; exportedAtMs: number }
  | { kind: "failed"; text: string };

function describeFailure(r: Exclude<ExportResult, { kind: "ready" }>): string {
  switch (r.kind) {
    case "session_ended":
      return "Your session ended, so nothing was exported. Sign in again, then export.";
    case "forbidden":
      return "Only operators can export workspace data. Nothing was exported.";
    case "wrong_context":
      return `${r.message} Nothing was saved.`;
    case "rate_limited":
      return "Exports are being limited right now. Nothing was exported; wait a moment and try again.";
    case "unavailable":
      if (r.reason === "storage_unavailable") return "The server's storage is not available, so nothing was exported. Try again when storage is back.";
      if (r.reason === "authority_unavailable") return "The server is not available right now, so nothing was exported. Try again shortly.";
      if (r.reason === "network" || r.reason === "timeout") return "Could not reach the server, so nothing was exported. Check your connection and try again.";
      return `${r.message} Nothing was exported.`;
  }
}

/** Hand the file to the browser. Returns false where the browser cannot start a download at all. */
export function saveJsonFile(json: string, filename: string): boolean {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

/**
 * Operator-only export of the workspace's REAL data as one JSON file (`GET /api/v3/workspace/export`).
 * It is a copy for safekeeping, not a backup and not importable. The role gating here is a courtesy: the server
 * decides, and a refusal is shown as what it is.
 */
export function ExportControl(): React.ReactElement | null {
  const auth = useAuth();
  const remote = useRemoteState();
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  // Set synchronously: a second click can arrive before React has re-rendered the busy state.
  const running = useRef(false);
  // A session that ends while this is open keeps the control (and its answer) on screen; it simply cannot be used.
  const ended = auth.status === "ended";
  if (auth.status !== "authenticated" && !ended) return null;
  // Either source saying "viewer" is enough to withhold the action; the server decides in any case.
  const viewer = !ended && (remote.access?.role === "viewer" || auth.session?.access.role === "viewer");
  const working = state.kind === "working";

  const run = async (): Promise<void> => {
    if (working || running.current) return;
    running.current = true;
    setState({ kind: "working" });
    const result = await authStore.exportWorkspace().finally(() => {
      running.current = false;
    });
    if (result.kind !== "ready") {
      setState({ kind: "failed", text: describeFailure(result) });
      return;
    }
    if (!saveJsonFile(result.json, result.filename)) {
      setState({ kind: "failed", text: "This browser could not start the download, so nothing was saved." });
      return;
    }
    setState({ kind: "done", filename: result.filename, exportedAtMs: result.exportedAtMs });
  };

  return (
    <section aria-labelledby="export-title" data-testid="export-control" className="mt-8 rounded-[12px] bg-[#13161C] p-5">
      <h2 id="export-title" className="text-[20px] font-medium text-[#F5F7FC]">
        Export workspace data
      </h2>
      <p id="export-help" className="text-[15px] leading-6 text-[#B7C1CE] mt-1.5 max-w-[680px]">
        Download one JSON file with this workspace&apos;s REAL shows, their history and the room&apos;s command receipts, as of a single moment. Rehearsals
        are not included, and neither are passwords or sign-in details. It is a copy for your records; it cannot be imported back.
      </p>
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <Button
          variant="secondary"
          icon="ri-download-2-line"
          disabled={viewer || ended || working}
          aria-describedby="export-help export-status"
          aria-busy={working || undefined}
          onClick={() => void run()}
          data-testid="export-btn"
        >
          {working ? "Preparing export…" : "Export workspace data"}
        </Button>
        {viewer && (
          <p className="text-[15px] text-[#F6C875]" data-testid="export-viewer-note">
            Only operators can export. You are signed in as a viewer.
          </p>
        )}
        {ended && (
          <p className="text-[15px] text-[#F6C875]" data-testid="export-ended-note">
            Your session ended. Sign in again to export.
          </p>
        )}
      </div>
      <p id="export-status" role="status" data-testid="export-status" className={`mt-3 text-[15px] ${state.kind === "failed" ? "text-[#F4A4A4]" : "text-[#CAD0DA]"}`}>
        {state.kind === "working" && "Preparing the export…"}
        {state.kind === "done" && (
          <>
            Saved <span className="font-mono text-[#F5F7FC]">{state.filename}</span>. It holds the workspace as of{" "}
            <time dateTime={new Date(state.exportedAtMs).toISOString()}>{new Date(state.exportedAtMs).toLocaleString()}</time>.
          </>
        )}
        {state.kind === "failed" && state.text}
      </p>
    </section>
  );
}
