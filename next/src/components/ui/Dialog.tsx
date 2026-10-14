"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonSize } from "./Button";
import { useCommandState } from "./CommandState";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  /** Operating-desk dialogs pass "lg" so the primary action label is 18px. Other screens keep the default. */
  confirmSize?: ButtonSize;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While a modal is open everything behind it is inert and hidden from assistive technology, so neither the
 * keyboard, a pointer-less switch nor a screen reader's virtual cursor can reach it. The live-region host
 * (`data-keep-live`) and framework custom elements stay available so announcements still arrive. Nested dialogs
 * stack: each restores exactly what it changed.
 */
function lockBackground(host: HTMLElement): () => void {
  const touched: Array<{ el: HTMLElement; inert: boolean; hidden: string | null }> = [];
  for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement) || el === host) continue;
    if (el.hasAttribute("data-keep-live") || el.tagName === "SCRIPT" || el.tagName.includes("-")) continue;
    touched.push({ el, inert: el.hasAttribute("inert"), hidden: el.getAttribute("aria-hidden") });
    el.setAttribute("inert", "");
    el.setAttribute("aria-hidden", "true");
  }
  return () => {
    for (const { el, inert, hidden } of touched) {
      if (!inert) el.removeAttribute("inert");
      if (hidden === null) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", hidden);
    }
  };
}

const WIDTH = { sm: "max-w-[440px]", md: "max-w-[540px]", lg: "max-w-[760px]" } as const;

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  confirmSize = "md",
  onConfirm,
  confirmDisabled = false,
  isLoading: isLoadingProp = false,
  size = "md",
  children,
}) => {
  // A REAL command waiting on the authority keeps the dialog open and busy; a refusal is shown with the input intact.
  const command = useCommandState();
  const isLoading = isLoadingProp || command.busy;
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Always call the latest handlers without re-running the focus effect on every render.
  const latest = useRef({ onClose, isLoading });
  latest.current = { onClose, isLoading };

  // Capture focus on open; give it back on close.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const target =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>(FOCUSABLE) ??
      root;
    target?.focus();
    // A dialog without an explicit description is described by its first paragraph, which is where each of
    // these dialogs already says what confirming does. (An explicit `description` always wins.)
    if (root && !root.hasAttribute("aria-describedby")) {
      const lead = bodyRef.current?.querySelector("p");
      if (lead) {
        lead.id ||= `${descId}-lead`;
        root.setAttribute("aria-describedby", lead.id);
      }
    }
    document.body.style.overflow = "hidden";
    const unlock = overlayRef.current ? lockBackground(overlayRef.current) : null;
    return () => {
      unlock?.();
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen, descId]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !latest.current.isLoading) {
        e.stopPropagation();
        latest.current.onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 motion-safe:animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={command.busy || undefined}
        tabIndex={-1}
        className={`w-full ${WIDTH[size]} max-h-[calc(100dvh-2rem)] flex flex-col rounded-[14px] bg-[#1B1F27] border border-[#2F3642] shadow-2xl outline-none [--pop-from:6px] motion-safe:animate-pop-in`}
      >
        <div className="p-6 pb-0 shrink-0">
          <h3 id={titleId} className="text-[22px] font-medium text-[#F5F7FC]">
            {title}
          </h3>
          {description && (
            <p id={descId} className="text-[16px] leading-6 text-[#CAD0DA] mt-2">
              {description}
            </p>
          )}
        </div>

        {children && (
          <div ref={bodyRef} className="px-6 pt-4 min-h-0 overflow-y-auto">
            {children}
          </div>
        )}

        {command.busy && (
          <p data-testid="dialog-busy-note" className="mx-6 mt-4 text-[15px] leading-6 text-[#CAD0DA]">
            The action has already been sent to the room. This window cannot cancel it. Wait here for the answer.
          </p>
        )}

        {/* The room's refusal is announced once by the shared live region (announcer); this is its visible text. */}
        {command.error && (
          <p data-testid="dialog-command-error" className="mx-6 mt-4 rounded-[8px] bg-[#302025] px-3 py-2 text-[16px] text-[#F4A4A4]">
            {command.error}
          </p>
        )}

        <div className="p-6 pt-5 flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          {onConfirm && (
            <Button variant={confirmVariant} size={confirmSize} onClick={onConfirm} disabled={isLoading || confirmDisabled}>
              {command.busy ? "Waiting for confirmation…" : isLoading ? "Processing..." : confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
