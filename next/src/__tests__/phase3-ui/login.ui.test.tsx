import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams(), path: "/login" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.path,
  useSearchParams: () => nav.search,
}));

import LoginPage from "@/app/login/page";
import { authStore } from "@/lib/client/authStore";
import { announcer } from "@/lib/client/announcer";
import { FakeRoom } from "../helpers/fakeRoom";
import { renderPlain, tabbables } from "./support";

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  announcer.reset();
  nav.replace.mockClear();
  nav.search = new URLSearchParams();
  nav.path = "/login";
});
afterEach(() => {
  restore?.();
  restore = null;
});

const fill = (username: string, password: string): void => {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
};
const submit = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByTestId("login-submit"));
  });
};

describe("sign-in screen", () => {
  it("is one page with a heading, two labelled inputs set up for password managers, and one primary action", async () => {
    open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in to LiveLift" })).toBeInTheDocument();
    const user = screen.getByLabelText("Username");
    const pass = screen.getByLabelText("Password");
    expect(user).toHaveAttribute("autocomplete", "username");
    expect(pass).toHaveAttribute("autocomplete", "current-password");
    expect(pass).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    // No sign-up, no reset: those are administrator operations, and the page says so.
    expect(screen.queryByText(/create an account|forgot/i)).toBeNull();
    expect(document.body).toHaveTextContent("created by your administrator");
  });

  it("asks the server whether a session already exists before showing the form", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    expect(room.authRequests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET /api/v3/auth/session"]);
  });

  it("keyboard order is username → password → Sign in, with no positive tabindex anywhere", async () => {
    open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    const form = screen.getByTestId("login-form");
    expect(tabbables(form).map((el) => el.id || el.textContent)).toEqual(["login-username", "login-password", "Sign in"]);
    for (const el of document.querySelectorAll("[tabindex]")) expect(Number(el.getAttribute("tabindex"))).toBeLessThanOrEqual(0);
  });
});

describe("signing in", () => {
  it("success goes to the page asked for, clears the password and stores nothing", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    nav.search = new URLSearchParams("next=/live/real-1/operate");
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    fill("mai", room.accounts.mai.password);
    await submit();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/live/real-1/operate"));
    expect(authStore.getSnapshot().status).toBe("authenticated");
    expect(screen.queryByDisplayValue(room.accounts.mai.password)).toBeNull();
    expect(document.body.textContent).not.toContain(room.accounts.mai.password);
    for (const area of [localStorage, sessionStorage]) for (let i = 0; i < area.length; i++) expect(area.getItem(area.key(i) as string)).not.toContain(room.accounts.mai.password);
    const login = room.authRequests.find((r) => r.path === "/api/v3/auth/login")!;
    expect(login.headers["x-livelift-request"]).toBe("1");
    expect(login.headers["content-type"]).toContain("application/json");
  });

  it("never follows a next= that leaves the site", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    nav.search = new URLSearchParams("next=https://evil.example/steal");
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    fill("mai", room.accounts.mai.password);
    await submit();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });

  it("wrong credentials: one generic message, the same for an unknown user, the password cleared, focus back on the password", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    fill("mai", "definitely wrong password");
    await submit();
    const first = (await screen.findByTestId("login-error")).textContent;
    expect(first).toBe("The username or password is not correct.");
    expect(screen.getByRole("alert")).toBe(screen.getByTestId("login-error"));
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveFocus();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-describedby", "login-error");

    fill("nobody", "another wrong password");
    await submit();
    expect((await screen.findByTestId("login-error")).textContent).toBe(first); // an unknown user reads exactly the same
    expect(nav.replace).not.toHaveBeenCalled();
    expect(room.signedIn).toBe(false);
  });

  it("empty fields are caught before anything is sent", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    await submit();
    expect(screen.getByTestId("login-error")).toHaveTextContent("Enter your username.");
    expect(screen.getByLabelText("Username")).toHaveFocus();
    fill("mai", "");
    await submit();
    expect(screen.getByTestId("login-error")).toHaveTextContent("Enter your password.");
    expect(room.authRequests.filter((r) => r.path.endsWith("/login"))).toHaveLength(0);
  });

  it("a second submit while signing in is ignored: one request, a busy button", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    fill("mai", room.accounts.mai.password);
    await act(async () => {
      fireEvent.click(screen.getByTestId("login-submit"));
      fireEvent.click(screen.getByTestId("login-submit"));
      fireEvent.submit(screen.getByTestId("login-form"));
    });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1));
    expect(room.authRequests.filter((r) => r.path.endsWith("/login"))).toHaveLength(1);
  });

  it("while it is running the button is disabled and busy, and the inputs stop accepting edits", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    fill("mai", room.accounts.mai.password);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const real = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/login")) await gate;
      return real(input, init);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("login-submit"));
    });
    expect(screen.getByTestId("login-submit")).toBeDisabled();
    expect(screen.getByTestId("login-submit")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("login-submit")).toHaveTextContent("Signing in…");
    expect(screen.getByLabelText("Username")).toHaveAttribute("readonly");
    await act(async () => release());
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  });

  it.each([
    ["rate limited", (r: FakeRoom) => (r.loginThrottled = true), /Too many sign-in attempts/],
    ["storage unavailable", (r: FakeRoom) => (r.loginStorageDown = true), /server's storage is not available/],
    ["unreachable", (r: FakeRoom) => (r.offline = true), /Could not reach the server/],
  ])("%s is named for what it is, not as bad credentials", async (_name, arrange, message) => {
    const room = open(new FakeRoom({ signedIn: false }));
    await renderPlain(<LoginPage />);
    await screen.findByTestId("login-form");
    arrange(room);
    fill("mai", room.accounts.mai.password);
    await submit();
    expect(await screen.findByTestId("login-error")).toHaveTextContent(message);
    expect(screen.getByTestId("login-error")).not.toHaveTextContent(/not correct/);
  });
});

describe("the other states of the page", () => {
  it("already signed in: says who, offers Continue and Sign out, and shows no form", async () => {
    open(new FakeRoom());
    nav.search = new URLSearchParams("next=/sessions");
    await renderPlain(<LoginPage />);
    const card = await screen.findByTestId("login-already");
    expect(card).toHaveTextContent("Mai");
    expect(card).toHaveTextContent("operator");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/sessions");
    expect(screen.queryByTestId("login-form")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    });
    expect(await screen.findByTestId("login-form")).toBeInTheDocument();
  });

  it("an ended session says so and keeps what was sent safe", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    room.revokeSession();
    authStore.markSessionEnded();
    await renderPlain(<LoginPage />);
    expect(await screen.findByTestId("login-ended")).toHaveTextContent(/expired or was revoked/);
    expect(screen.getByTestId("login-ended")).toHaveTextContent(/stays saved/);
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("an unreachable sign-in service is 'unavailable', with a retry, never 'signed out'", async () => {
    const room = open(new FakeRoom({ signedIn: false }));
    room.storageDown = true;
    await renderPlain(<LoginPage />);
    const panel = await screen.findByTestId("login-unavailable");
    expect(panel).toHaveTextContent("storage is not available");
    expect(screen.queryByTestId("login-form")).toBeNull();
    room.storageDown = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(await screen.findByTestId("login-form")).toBeInTheDocument();
  });

  it("after a sign-out the server could not confirm, the page says so", async () => {
    const room = open(new FakeRoom());
    await authStore.bootstrap();
    room.offline = true;
    await authStore.logout();
    await renderPlain(<LoginPage />);
    expect(await screen.findByTestId("login-logout-note")).toHaveTextContent(/did not confirm/);
  });
});
