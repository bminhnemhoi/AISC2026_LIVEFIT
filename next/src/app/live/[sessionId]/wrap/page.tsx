"use client";

import React, { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/contracts";
import { SessionGate } from "@/components/ops/SessionGate";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * Wrap is no longer a separate page: ending a show is the Operate → Review transition, and the
 * missing-report check lives in the End LIVE dialog. This route only keeps old links working.
 */
export default function WrapRedirectPage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return <SessionGate id={sessionId}>{(session) => <ToReview session={session} />}</SessionGate>;
}

function ToReview({ session }: { session: Session }): React.ReactElement {
  const router = useRouter();
  const step = session.lifecycle === "active" ? "operate" : session.lifecycle === "ended" ? "review" : "prepare";
  useEffect(() => {
    router.replace(`/live/${session.id}/${step}`);
  }, [router, session.id, step]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090B0F] text-[#9AA5B5]" role="status">
      {step === "review" ? "Show ended. Opening Review…" : step === "operate" ? "Show is still active. Opening Operate…" : "Show has not started. Opening Prepare…"}
    </div>
  );
}
