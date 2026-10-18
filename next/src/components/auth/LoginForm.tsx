"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { authStore, type LoginFailure } from "@/lib/client/authStore";
import { useAuth } from "@/lib/store/hooks";

/**
 * What the person reads when a sign-in did not work. Deliberately generic for credentials: the same sentence for an
 * unknown user and a wrong password, and nothing about password rules or which accounts exist.
 */
export function describeLoginFailure(failure: LoginFailure): string {
  switch (failure.kind) {
    case "invalid_credentials":
      return "The username or password is not correct.";
    case "rate_limited":
      return "Too many sign-in attempts. Wait a few minutes, then try again.";
    case "invalid_request":
      return "That sign-in could not be processed. Check what you typed and try again.";
    case "unavailable":
      if (failure.reason === "storage_unavailable") return "Sign-in is unavailable because the server's storage is not available. Nothing about your account changed. Try again shortly.";
      if (failure.reason === "authority_unavailable") return "Sign-in is unavailable because the server is not available right now. Try again shortly.";
      if (failure.reason === "csrf_failed") return "The server refused this browser request. Reload the page and try again.";
      if (failure.reason === "network" || failure.reason === "timeout") return "Could not reach the server. Check your connection and try again.";
      return "Sign-in is unavailable right now. Try again shortly.";
  }
}

const FIELD =
  "h-11 w-full bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC] aria-[invalid=true]:border-[#6B2A35]";

/**
 * The sign-in form. Both inputs are labelled, the error is tied to the fields it concerns, a second submission while
 * one is running is ignored (the store joins it as well), and the password never lives in state longer than the
 * keystrokes: it is cleared the moment the request leaves.
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }): React.ReactElement {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  // Set synchronously: React has not re-rendered yet when a second click or Enter arrives in the same moment.
  const submitting = useRef(false);
  const [missing, setMissing] = useState<string | null>(null);
  const busy = auth.status === "signing_in";
  const error = missing ?? (auth.loginError ? describeLoginFailure(auth.loginError) : null);

  // After a failure the password field is empty again; put the cursor back where the next attempt starts.
  const failed = auth.loginError !== null;
  useEffect(() => {
    if (failed) passwordRef.current?.focus();
  }, [failed]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy || submitting.current) return; // one login at a time
    if (username.trim() === "" || password === "") {
      setMissing(username.trim() === "" ? "Enter your username." : "Enter your password.");
      (username.trim() === "" ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setMissing(null);
    const credentials = { username: username.trim(), password };
    setPassword("");
    submitting.current = true;
    const result = await authStore.login(credentials).finally(() => {
      submitting.current = false;
    });
    if (result.kind === "authenticated") {
      setUsername("");
      onSuccess();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="login-title" aria-describedby={error ? "login-error" : undefined} data-testid="login-form" className="space-y-5">
      <div>
        <label htmlFor="login-username" className="block text-[16px] font-medium text-[#F5F7FC] mb-1.5">
          Username
        </label>
        <input
          ref={usernameRef}
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          readOnly={busy}
          aria-invalid={missing !== null && username.trim() === "" ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={FIELD}
          data-testid="login-username"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-[16px] font-medium text-[#F5F7FC] mb-1.5">
          Password
        </label>
        <input
          ref={passwordRef}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          readOnly={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className={FIELD}
          data-testid="login-password"
        />
      </div>
      {error && (
        <p id="login-error" role="alert" data-testid="login-error" className="rounded-[8px] bg-[#302025] px-3 py-2 text-[16px] text-[#F4A4A4]">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={busy} aria-busy={busy || undefined} className="w-full" data-testid="login-submit">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
