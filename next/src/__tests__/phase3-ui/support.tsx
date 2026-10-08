import React, { Suspense } from "react";
import { act, render } from "@testing-library/react";
import { snapshotProducts } from "@/fixtures/library";
import { SCENARIO_BY_ID, applyCommand, createSession } from "@/lib/domain";
import type { Session } from "@/contracts";
import type { FakeRoom } from "../helpers/fakeRoom";

/** Shared setup for the Phase 3 UI tests. Nothing here is product code. */

export type PageComponent = (props: { params: Promise<{ sessionId: string }> }) => React.ReactElement;

export async function renderPage(Page: PageComponent, sessionId: string): Promise<void> {
  const params = Promise.resolve({ sessionId });
  await act(async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <Page params={params} />
      </Suspense>
    );
  });
}

/** Render a page that takes no params, inside act so its first effects (the sign-in check, the first poll) settle. */
export async function renderPlain(node: React.ReactElement): Promise<void> {
  await act(async () => {
    render(<Suspense fallback={<div>loading</div>}>{node}</Suspense>);
  });
}

/** A REAL show as the room would hold it, seeded straight into the fake room. */
export function realShow(room: FakeRoom, id: string, opts: { start?: boolean; end?: boolean } = {}): Session {
  const template = SCENARIO_BY_ID.buffered;
  const { segments, cues } = template.buildPlan(id);
  let s = createSession({
    id,
    title: "Friday launch",
    environment: "REAL",
    timezone: "UTC",
    plannedStartMs: room.nowMs,
    nowMs: room.nowMs,
    products: snapshotProducts(template.productIds),
    segments,
    cues,
    operator: { id: room.actor.id, name: room.actor.name, role: "lead", isLead: true },
  });
  if (opts.start || opts.end) s = applyCommand(s, { type: "start_live", nowMs: room.nowMs }).session;
  if (opts.end) s = applyCommand(s, { type: "end_live", nowMs: room.nowMs + 60_000 }).session;
  room.seed(s);
  return s;
}

/** Everything a keyboard can reach, in DOM (= Tab) order. Positive tabindex values would reorder it and are asserted absent. */
export function tabbables(root: ParentNode = document.body): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'));
  return nodes.filter((el) => !el.matches(":disabled") && el.getAttribute("tabindex") !== "-1" && !el.closest("[inert]") && !el.closest('[aria-hidden="true"]'));
}

const accessibleName = (el: Element): string => {
  const labelled = el.getAttribute("aria-labelledby");
  if (labelled) {
    const text = labelled
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  const label = el.getAttribute("aria-label")?.trim();
  if (label) return label;
  const alt = el.getAttribute("alt")?.trim();
  if (alt) return alt;
  const own = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (own) return own;
  return el.getAttribute("title")?.trim() ?? "";
};

/**
 * A structural accessibility audit of what is currently rendered. It is NOT axe (the package set is frozen, so axe
 * cannot be added in this lane); it checks the rules that can be decided from the DOM alone:
 * names on controls, labels on fields, unique ids, no reordering tabindex, dialogs named and modal, and that every
 * live region is a deliberate one.
 */
export function auditAccessibility(root: ParentNode = document.body): string[] {
  const issues: string[] = [];
  const describe = (el: Element): string => `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("data-testid") ? ` data-testid=${el.getAttribute("data-testid")}` : ""}>`;

  for (const el of Array.from(root.querySelectorAll("button, a[href], [role='button'], [role='link'], [role='tab']"))) {
    if (el.closest("[hidden]")) continue;
    if (!accessibleName(el)) issues.push(`control without an accessible name: ${describe(el)}`);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement>("input, select, textarea"))) {
    if (el instanceof HTMLInputElement && el.type === "hidden") continue;
    const named = (el.labels && el.labels.length > 0) || el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby");
    if (!named) issues.push(`field without a label: ${describe(el)}`);
  }
  const ids = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll("[id]"))) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) issues.push(`duplicate id: ${id} (${n}x)`);
  for (const el of Array.from(root.querySelectorAll("[tabindex]"))) if (Number(el.getAttribute("tabindex")) > 0) issues.push(`positive tabindex: ${describe(el)}`);
  for (const el of Array.from(root.querySelectorAll("[role='dialog']"))) {
    if (!accessibleName(el)) issues.push(`dialog without a name: ${describe(el)}`);
    if (el.getAttribute("aria-modal") !== "true") issues.push(`dialog that is not modal: ${describe(el)}`);
  }
  for (const el of Array.from(root.querySelectorAll("[aria-labelledby], [aria-describedby]"))) {
    for (const attr of ["aria-labelledby", "aria-describedby"]) {
      for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) issues.push(`${attr} points at a missing id (${id}): ${describe(el)}`);
      }
    }
  }
  for (const el of Array.from(root.querySelectorAll("img"))) if (!el.hasAttribute("alt")) issues.push(`image without alt: ${describe(el)}`);
  if (root.querySelectorAll("h1").length === 0 && root === document.body) issues.push("page without a level-1 heading");
  return issues;
}
