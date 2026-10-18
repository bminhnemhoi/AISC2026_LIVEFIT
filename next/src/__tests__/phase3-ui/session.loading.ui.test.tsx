import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderPlain } from "./support";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from "@/app/login/page";
import IntegrationsPage from "@/app/integrations/page";
import { authStore } from "@/lib/client/authStore";

beforeEach(() => { authStore.reset(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const pages = [
  { name: "login", Page: LoginPage, checking: "Checking whether you are already signed in…", signedOut: "login-form" },
  { name: "integrations", Page: IntegrationsPage, checking: "Checking your sign-in…", signedOut: "tiktok-needs-sign-in" },
];

for (const { name, Page, checking, signedOut } of pages) {
  it(`${name} leaves checking on an unauthenticated 401`, async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: { code: "unauthenticated" } }, { status: 401 }));
    await renderPlain(<Page />);
    expect(await screen.findByTestId(signedOut)).toBeInTheDocument();
    expect(screen.queryByText(checking)).toBeNull();
    expect(authStore.getSnapshot().status).toBe("signed_out");
    expect(fetch).toHaveBeenCalledWith("/api/v3/auth/session", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
  });

  it.each([
    [503, '{"error":{"code":"storage_unavailable"}}', "storage_unavailable"],
    [500, "<html>Server error</html>", "authority_unavailable"],
    [200, "<html>Unexpected page</html>", "malformed"],
    [200, '{"workspaceId":', "malformed"],
    [200, "{}", "malformed"],
    [403, "Unauthorized", "unexpected"],
  ])(`${name} leaves checking truthfully on status %s / %s`, async (status, body, reason) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));
    await renderPlain(<Page />);
    expect(authStore.getSnapshot()).toMatchObject({ status: "unavailable", unavailable: { reason } });
    expect(screen.queryByText(checking)).toBeNull();
    expect(screen.queryByTestId(signedOut)).toBeNull();
    expect(screen.getByText(/not available|could not trust|answered 403/)).toBeInTheDocument();
  });

  it(`${name} leaves checking when fetch throws`, async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network failed"));
    await renderPlain(<Page />);
    expect(authStore.getSnapshot()).toMatchObject({ status: "unavailable", unavailable: { reason: "network" } });
    expect(screen.queryByText(checking)).toBeNull();
  });

  it(`${name} leaves checking after the 8-second deadline even if fetch ignores abort`, async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    await renderPlain(<Page />);
    expect(screen.getByText(checking)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(authStore.getSnapshot()).toMatchObject({ status: "unavailable", unavailable: { reason: "timeout" } });
    expect(screen.queryByText(checking)).toBeNull();
    expect(screen.getByText(/did not answer in time/)).toBeInTheDocument();
  });
}
