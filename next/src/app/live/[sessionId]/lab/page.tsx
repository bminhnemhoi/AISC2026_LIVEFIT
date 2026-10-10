"use client";

import React, { use } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { SessionGate } from "@/components/ops/SessionGate";
import { PlatformLab } from "@/components/platform/lab/PlatformLab";
import { labCopy } from "@/components/platform/lab/labCopy";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/** The Platform Lab, for rehearsals only. A REAL show is told why and sent back; unknown ids get the usual not-found state. */
export default function LabPage({ params }: PageProps): React.ReactElement {
  const { sessionId } = use(params);
  return (
    <SessionGate id={sessionId}>
      {(session) => (session.environment === "SIMULATED" ? <PlatformLab key={session.id} show={session} /> : <NotSimulated session={session} />)}
    </SessionGate>
  );
}

function NotSimulated({ session }: { session: Session }): React.ReactElement {
  const { lang } = useLabPreferences();
  const w = labCopy[lang].notSimulated;
  return (
    <StandardShell>
      <div lang={lang} className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="lab-not-simulated">
        <h1 className="text-[28px] font-medium text-[#F5F7FC]">{w.title}</h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[560px]">{w.body}</p>
        <Link href={`/live/${session.id}`} className="mt-6">
          <Button variant="primary" size="lg" icon="ri-arrow-left-line">
            {w.back}
          </Button>
        </Link>
      </div>
    </StandardShell>
  );
}
