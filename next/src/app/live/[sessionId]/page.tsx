"use client";

import React, { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/contracts";
import { SessionGate } from "@/components/ops/SessionGate";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/** Send the operator to where the work is for this lifecycle. Unknown ids get a real not-found state. */
export default function SessionRedirectPage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return <SessionGate id={sessionId}>{(session) => <Redirect session={session} />}</SessionGate>;
}

function Redirect({ session }: { session: Session }): React.ReactElement {
  const router = useRouter();
  const step = session.lifecycle === "active" ? "operate" : session.lifecycle === "ended" ? "review" : "prepare";
  useEffect(() => {
    router.replace(`/live/${session.id}/${step}`);
  }, [router, session.id, step]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090B0F] text-[#9AA5B5]" role="status">
      Opening {step}…
    </div>
  );
}
