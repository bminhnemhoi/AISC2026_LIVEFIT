import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: new URLSearchParams(), path: "/sessions" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.path,
  useSearchParams: () => nav.search,
}));

import SessionsPage from "@/app/sessions/page";
import { authStore } from "@/lib/client/authStore";
import { announcer } from "@/lib/client/announcer";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { sessionStore } from "@/lib/store/sessionStore";
import { FakeRoom } from "../helpers/fakeRoom";
import { realShow, renderPlain } from "./support";

let restore: (() => void) | null = null;
const open = (room: FakeRoom): FakeRoom => {
  restore = room.install();
  return room;
};

/** jsdom cannot download: capture what the browser would be asked to save. */
const saved = { blobs: [] as Blob[], names: [] as string[], revoked: [] as string[] };
let clickSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.reset();
  announcer.reset();
  remoteRoomStore.reset();
  sessionStore.reloadFromStorage();
  saved.blobs = [];
  saved.names = [];
  saved.revoked = [];
  nav.path = "/sessions";
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: (b: Blob) => {
      saved.blobs.push(b);
      return `blob:test/${saved.blobs.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: (u: string) => saved.revoked.push(u) });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.names.push(this.download);
  });
});
afterEach(() => {
  restore?.();
  restore = null;
  clickSpy?.mockRestore();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
const exportBtn = (): HTMLElement => screen.getByTestId("export-btn");
const status = (): string => screen.getByTestId("export-status").textContent ?? "";
const clickExport = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(exportBtn());
  });
};

describe("workspace export", () => {
  it("an operator downloads the room's JSON, carrying the session's context, and is told what was saved", async () => {
    const room = open(new FakeRoom());
    realShow(room, "real-1", { start: true });
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    await clickExport();

    const req = room.requests.find((r) => r.path === "/api/v3/workspace/export")!;
    expect(req.method).toBe("GET");
    expect(req.headers["x-livelift-request"]).toBe("1");
    expect(req.headers["x-livelift-workspace"]).toBe("ws-1");
    expect(req.headers["x-livelift-generation"]).toBe("gen-1");
    expect(req.headers.authorization).toBeUndefined();

    expect(saved.names).toEqual(["livelift-workspace-ws-1-2026-10-06T13-00-00-000Z.json"]);
    const body = JSON.parse(await readBlob(saved.blobs[0])) as { formatVersion: number; snapshot: { sessions: { id: string }[] } };
    expect(body.formatVersion).toBe(1);
    expect(body.snapshot.sessions.map((s) => s.id)).toEqual(["real-1"]);
    expect(status()).toMatch(/Saved livelift-workspace-ws-1/);
    expect(screen.getByTestId("export-status").querySelector("time")).toHaveAttribute("datetime", "2026-10-06T13:00:00.000Z");
    await waitFor(() => expect(saved.revoked).toEqual(["blob:test/1"]), { timeout: 3000 }); // the temporary URL does not outlive the download
  });

  it("states what the export is and is not, and offers no import", async () => {
    open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    const panel = await screen.findByTestId("export-control");
    expect(panel).toHaveTextContent(/cannot be imported back/);
    expect(panel).toHaveTextContent(/neither are passwords or sign-in details/);
    expect(panel).toHaveTextContent(/Rehearsals\s+are not included/);
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /import/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /import/i })).toBeNull();
  });

  it("a viewer cannot export: the control is disabled, says why, and nothing is requested", async () => {
    const room = open(new FakeRoom({ role: "viewer", actor: { id: "actor-2", name: "Linh" } }));
    await renderPlain(<SessionsPage />);
    const note = await screen.findByTestId("export-viewer-note");
    expect(note).toHaveTextContent("Only operators can export");
    expect(exportBtn()).toBeDisabled();
    fireEvent.click(exportBtn());
    expect(room.requests.some((r) => r.path.includes("/workspace/export"))).toBe(false);
  });

  it("a role removed since the page loaded is refused by the server, and the page learns it", async () => {
    const room = open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    room.role = "viewer";
    await clickExport();
    expect(status()).toMatch(/Only operators can export/);
    expect(saved.blobs).toHaveLength(0);
    await waitFor(() => expect(authStore.getSnapshot().session?.access.role).toBe("viewer")); // re-read from the server, never inferred
    expect(screen.getByTestId("export-viewer-note")).toBeInTheDocument();
  });

  it("an ended session is said plainly and nothing is saved", async () => {
    const room = open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    room.revokeSession();
    await clickExport();
    expect(status()).toMatch(/session ended, so nothing was exported/);
    expect(saved.blobs).toHaveLength(0);
    expect(authStore.getSnapshot().status).toBe("ended");
    expect(exportBtn()).toBeDisabled();
    expect(screen.getByTestId("export-ended-note")).toHaveTextContent("Sign in again");
  });

  it("unavailable storage is said as such, nothing is saved, and a retry works once storage is back", async () => {
    const room = open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    room.storageDown = true;
    await clickExport();
    expect(status()).toMatch(/storage is not available, so nothing was exported/);
    expect(saved.blobs).toHaveLength(0);
    room.storageDown = false;
    await clickExport();
    expect(status()).toMatch(/^Saved /);
    expect(saved.blobs).toHaveLength(1);
  });

  it("a restored room (409) is not exported under the old generation", async () => {
    const room = open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    room.generation = "gen-2";
    await clickExport();
    expect(status()).toMatch(/Nothing was saved/);
    expect(saved.blobs).toHaveLength(0);
  });

  it("while it runs the button is busy and a second click sends nothing more", async () => {
    const room = open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(exportBtn());
      fireEvent.click(exportBtn());
    });
    expect(room.requests.filter((r) => r.path === "/api/v3/workspace/export")).toHaveLength(1);
  });

  it("signed out there is no export control at all", async () => {
    open(new FakeRoom({ signedIn: false }));
    await renderPlain(<SessionsPage />);
    await screen.findByTestId("sessions-table");
    expect(screen.queryByTestId("export-control")).toBeNull();
  });

  it("the status line is the control's own polite region and the button is described by it", async () => {
    open(new FakeRoom());
    await renderPlain(<SessionsPage />);
    await waitFor(() => expect(exportBtn()).not.toBeDisabled());
    expect(screen.getByTestId("export-status")).toHaveAttribute("role", "status");
    expect(exportBtn().getAttribute("aria-describedby")).toBe("export-help export-status");
  });
});
