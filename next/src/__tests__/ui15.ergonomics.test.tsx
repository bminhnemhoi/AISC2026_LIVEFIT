import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Signal } from "@/components/ops/StatusChips";

/**
 * UI-15 guard (laptop layout, target sizes and readability).
 *
 * jsdom has no layout engine, so pixel measurements (44px targets, 16px/18px text, rundown height) are taken in a
 * real browser. What can be guarded here is the source of the operating desk: its operational text must be declared
 * at the 16px minimum and its actions must use the 44px desk button sizes instead of the compact `sm` size.
 */
const SRC = path.resolve(__dirname, "..");
const DESK_FILES = [
  "app/live/[sessionId]/operate/page.tsx",
  "components/shell/FocusedShell.tsx",
  "components/ops/CueBar.tsx",
  "components/ops/NextPanel.tsx",
  "components/ops/NowPanel.tsx",
  "components/ops/OperateDialogs.tsx",
  "components/ops/RunOfShowLive.tsx",
  "components/ops/SimulatorStrip.tsx",
  "components/ops/SupportTabs.tsx",
];

const read = (rel: string): string => readFileSync(path.join(SRC, rel), "utf8");

/** Opening tag of every `<Button …>`, found by scanning to the first `>` outside braces (so `=>` in handlers is skipped). */
function buttonOpeningTags(src: string): string[] {
  const tags: string[] = [];
  for (let i = src.indexOf("<Button"); i !== -1; i = src.indexOf("<Button", i + 1)) {
    if (/[A-Za-z]/.test(src[i + "<Button".length] ?? "")) continue; // a different component, e.g. <ButtonGroup
    let depth = 0;
    let end = i;
    for (; end < src.length; end++) {
      const c = src[end];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    tags.push(src.slice(i, end + 1));
  }
  return tags;
}

describe("UI-15: operating desk sources", () => {
  for (const file of DESK_FILES) {
    it(`${file} declares no text below 16px`, () => {
      const small = [...read(file).matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].filter((m) => Number(m[1]) < 16).map((m) => m[0]);
      expect(small).toEqual([]);
    });

    it(`${file} uses no compact (sm) Button`, () => {
      // `<Dialog size="sm">` is the dialog's width, not a button size, so only Button tags are inspected.
      expect(buttonOpeningTags(read(file)).filter((tag) => /\bsize="sm"/.test(tag))).toEqual([]);
    });
  }

  it("the Button scanner sees the desk's buttons (guards against an always-empty pass)", () => {
    expect(buttonOpeningTags(read("app/live/[sessionId]/operate/page.tsx")).length).toBeGreaterThan(5);
    expect(buttonOpeningTags(read("components/ops/NextPanel.tsx")).some((tag) => tag.includes('size="deskPrimary"') || tag.includes('size={'))).toBe(true);
  });
});

describe("UI-15: desk sizes", () => {
  it("Button desk is a 44px target with a 16px label, deskPrimary an 18px label", () => {
    render(
      <>
        <Button size="desk">Secondary</Button>
        <Button size="deskPrimary" variant="primary">
          Primary
        </Button>
      </>
    );
    const desk = screen.getByRole("button", { name: "Secondary" });
    expect(desk.className).toContain("min-h-[44px]");
    expect(desk.className).toContain("text-[16px]");
    const primary = screen.getByRole("button", { name: "Primary" });
    expect(primary.className).toContain("min-h-[44px]");
    expect(primary.className).toContain("text-[18px]");
  });

  it("Button eases its colours but never fades opacity, so a button that becomes enabled is at full contrast at once", () => {
    render(<Button disabled>Pin</Button>);
    const button = screen.getByRole("button", { name: "Pin" });
    const transition = button.className.match(/transition-\[([^\]]*)\]/)?.[1] ?? "";
    expect(transition).toContain("color");
    expect(transition.split(",")).not.toContain("opacity");
    expect(button.className).toContain("disabled:opacity-50");
  });

  it("Button keeps its existing sizes for the other screens", () => {
    render(<Button size="sm">Compact</Button>);
    expect(screen.getByRole("button", { name: "Compact" }).className).toContain("text-[15px]");
  });

  it("Signal desk is 16px and the default stays compact", () => {
    render(
      <>
        <Signal size="desk">Operational</Signal>
        <Signal>Compact</Signal>
      </>
    );
    expect(screen.getByText("Operational").parentElement?.className).toContain("text-[16px]");
    expect(screen.getByText("Compact").parentElement?.className).toContain("text-[14px]");
  });

  it("Dialog confirm is 16px by default and 18px when a desk dialog asks for it", () => {
    const { rerender } = render(<Dialog isOpen onClose={() => {}} title="Default" confirmText="Go" onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("text-[16px]");
    rerender(<Dialog isOpen onClose={() => {}} title="Desk" confirmText="Go" confirmSize="lg" onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("text-[18px]");
  });
});
