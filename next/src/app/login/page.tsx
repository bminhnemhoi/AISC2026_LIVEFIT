"use client";

import React, { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { authStore, safeNextPath } from "@/lib/client/authStore";
import { useAuth } from "@/lib/store/hooks";

function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const next = safeNextPath(params.get("next"));

  useEffect(() => {
    authStore.ensureChecked();
  }, []);

  return (
    <StandardShell>
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-[460px]">
          <h1 id="login-title" className="text-[34px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC]">
            Sign in to LiveLift
          </h1>
          <p className="text-[16px] leading-6 text-[#B7C1CE] mt-2">
            REAL shows live in the shared room, so they need an account. Rehearsals in the Simulator do not.
          </p>

          <div className="mt-8">
            {auth.status === "checking" && (
              <p role="status" className="text-[16px] text-[#9AA5B5]" data-testid="login-checking">
                Checking whether you are already signed in…
              </p>
            )}

            {auth.status === "authenticated" && auth.session && (
              <div className="rounded-[12px] bg-[#13161C] p-5 space-y-4" data-testid="login-already">
                <p className="text-[16px] text-[#F5F7FC]">
                  You are signed in as <strong>{auth.session.access.name}</strong> ({auth.session.access.role === "viewer" ? "viewer, read-only" : "operator"}).
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link href={next}>
                    <Button variant="primary">Continue</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => void authStore.logout()}>
                    Sign out
                  </Button>
                </div>
              </div>
            )}

            {auth.status === "unavailable" && (
              <div className="rounded-[12px] bg-[#2A2316] p-5 space-y-4" data-testid="login-unavailable">
                <p className="text-[16px] text-[#F6C875]">
                  Sign-in is not available right now. {auth.unavailable?.message ?? "The server could not be asked."}{" "}
                  Nothing about your account has changed.
                </p>
                <Button variant="secondary" onClick={() => void authStore.bootstrap()}>
                  Try again
                </Button>
              </div>
            )}

            {(auth.status === "signed_out" || auth.status === "signing_in" || auth.status === "ended") && (
              <>
                {auth.status === "ended" && (
                  <p className="mb-5 rounded-[8px] bg-[#2A2316] px-3 py-2 text-[16px] text-[#F6C875]" data-testid="login-ended">
                    Your session ended (it expired or was revoked). Sign in again to continue. Anything you had already sent stays saved to be checked.
                  </p>
                )}
                {auth.logoutNote && (
                  <p className="mb-5 rounded-[8px] bg-[#2A2316] px-3 py-2 text-[16px] text-[#F6C875]" data-testid="login-logout-note">
                    {auth.logoutNote}
                  </p>
                )}
                <LoginForm onSuccess={() => router.replace(next)} />
              </>
            )}
          </div>

          <p className="text-[15px] leading-6 text-[#9AA5B5] mt-8">
            Accounts are created by your administrator; there is no sign-up or password reset here.{" "}
            <Link href="/simulator" className="text-[#CAD0DA] underline underline-offset-4 hover:text-white">
              Use the Simulator without signing in
            </Link>
            .
          </p>
        </div>
      </div>
    </StandardShell>
  );
}

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
