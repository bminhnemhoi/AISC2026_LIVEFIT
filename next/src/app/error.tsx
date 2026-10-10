"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";

export default function ErrorBoundaryPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace render error:", error);
  }, [error]);

  return (
    <StandardShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <span className="text-[48px] text-[#FF5C5C]">
          <i className="ri-alert-line" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">
          Operational Workspace Degraded
        </h1>
        <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[500px]">
          {error.message || "A runtime exception occurred in this workspace."}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="primary" onClick={() => reset()}>
            Retry Workspace
          </Button>
          <Link href="/">
            <Button variant="ghost">Return Home</Button>
          </Link>
        </div>
      </div>
    </StandardShell>
  );
}
