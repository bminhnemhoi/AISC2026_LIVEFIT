"use client";

import React, { useMemo, useState } from "react";
import type { Cue, PlanVersion, ProductSnapshot, Segment } from "@/contracts";
import { PACK_LIBRARY, PRODUCT_LIBRARY } from "@/fixtures/library";
import {
  formatClock,
  formatDuration,
  parseProductRows,
  productReferences,
  toProductSnapshots,
  type PlanIssue,
  type Schedule,
} from "@/lib/domain";
import { Button, Dialog, useCommandState } from "@/components/ui";
import { afterResult } from "@/lib/client/commandText";
import { SegmentTile } from "./SegmentTile";
import { Signal } from "./StatusChips";
import { CUE_ACTION_LABEL } from "./CueBar";

// ---------------------------------------------------------------------------------------------
// Run of Show
// ---------------------------------------------------------------------------------------------

export function PrepareRos({
  plan,
  schedule,
  issues,
  products,
  tz,
  onEdit,
  onMove,
  onAddSegment,
  onAddCue,
  onEditCue,
}: {
  plan: PlanVersion;
  schedule: Schedule;
  issues: PlanIssue[];
  products: ProductSnapshot[];
  tz: string;
  onEdit: (segmentId: string) => void;
  onMove: (segmentId: string, delta: -1 | 1) => void;
  onAddSegment: () => void;
  onAddCue: () => void;
  onEditCue: (cueId: string) => void;
}): React.ReactElement {
  const productById = new Map(products.map((p) => [p.id, p]));
  const issuesBySegment = new Map<string, PlanIssue[]>();
  for (const i of issues) {
    if (i.segmentId) issuesBySegment.set(i.segmentId, [...(issuesBySegment.get(i.segmentId) ?? []), i]);
  }
  const clock = (ms: number): string => formatClock(ms, tz, true);

  const cuesAfter = (segment: Segment, index: number): Cue[] => {
    const nextStart = schedule.rows[index + 1]?.startMs ?? null;
    return plan.cues.filter((c) => {
      if (c.timing.type !== "at_offset") return c.timing.segmentId === segment.id;
      const at = plan.plannedStartMs + c.timing.offsetSec * 1000;
      const rowStart = schedule.rows[index].startMs;
      return rowStart !== null && at >= rowStart && (nextStart === null || at < nextStart);
    });
  };
  const orphanCues = plan.cues.filter(
    (c) => c.timing.type !== "at_offset" && !plan.segments.some((s) => s.id === (c.timing as { segmentId: string }).segmentId)
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between gap-3 pb-2 shrink-0 flex-wrap">
        <p className="text-[15px] text-[#AEB7C5]" data-testid="ros-summary">
          {plan.segments.length} segment{plan.segments.length === 1 ? "" : "s"}
          {" · "}
          {schedule.complete ? `${formatDuration(plan.segments.reduce((s, x) => s + (x.targetSec ?? 0), 0))} host time` : "Total duration incomplete"}
          {(() => {
            const idle = schedule.rows.reduce((sum, r) => sum + r.waitBeforeSec, 0);
            return idle > 0 ? ` · ${formatDuration(idle)} idle buffer` : "";
          })()}
          {" · "}
          {plan.cues.length} zero-duration cue{plan.cues.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon="ri-focus-3-line" onClick={onAddCue} data-testid="add-cue-btn">
            Add cue
          </Button>
          <Button variant="secondary" size="sm" icon="ri-add-line" onClick={onAddSegment} data-testid="add-segment-btn">
            Add segment
          </Button>
        </div>
      </div>

      {plan.segments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10" data-testid="empty-ros">
          <i className="ri-list-ordered text-[28px] text-[#8A95A5]" aria-hidden="true" />
          <h3 className="text-[22px] font-medium text-[#F5F7FC] mt-2">Give the show a shape</h3>
          <p className="text-[15px] text-[#B7C1CE] mt-1 max-w-[420px]">
            Opening, a product, Q&A — each segment gives your operator a next step with a duration, and a hard anchor where a time is a
            commitment.
          </p>
          <Button variant="primary" className="mt-4" onClick={onAddSegment}>
            Add first segment
          </Button>
        </div>
      ) : (
        <ol className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#1F2530] pr-1" data-testid="prepare-ros-list">
          {plan.segments.map((seg, i) => {
            const row = schedule.rows[i];
            const product = seg.productId ? (productById.get(seg.productId) ?? null) : null;
            const segIssues = issuesBySegment.get(seg.id) ?? [];
            return (
              <React.Fragment key={seg.id}>
                {row.waitBeforeSec > 0 && row.anchorMs !== null && (
                  <li className="py-1.5 pl-[96px] text-[13px] text-[#9AA5B5]" data-testid="buffer-row">
                    <i className="ri-hourglass-line mr-1.5" aria-hidden="true" />
                    Idle buffer {formatDuration(row.waitBeforeSec)} until the {clock(row.anchorMs)} anchor
                  </li>
                )}
                {row.deficitSec > 0 && row.anchorMs !== null && (
                  <li className="py-1.5 pl-[96px] text-[13px] text-[#F4A4A4]" data-testid="deficit-row">
                    <i className="ri-error-warning-line mr-1.5" aria-hidden="true" />
                    Arrives {row.startMs !== null ? clock(row.startMs) : "late"} — {formatDuration(row.deficitSec)} after its {clock(row.anchorMs)} anchor
                  </li>
                )}
                <li className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-1.5 px-2" data-testid={`prepare-row-${seg.id}`}>
                  <div className="w-[76px] shrink-0">
                    <span className="text-[12px] font-mono text-[#AEB7C5]">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-[14px] tabular-nums text-[#E4E8F0]">{row.startMs !== null ? clock(row.startMs) : "Unknown"}</p>
                  </div>
                  <SegmentTile segment={seg} product={product} size={44} />
                  <div className="min-w-[100px] sm:min-w-0 flex-1">
                    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap">
                      <p className="text-[17px] font-medium text-[#F5F7FC] truncate max-w-full">{seg.title || "Untitled segment"}</p>
                      {row.anchorMs !== null && (
                        <Signal tone="neutral" icon="ri-lock-2-line" className="tabular-nums">
                          Hard anchor {clock(row.anchorMs)}
                        </Signal>
                      )}
                      {seg.optional && <Signal tone="muted">optional</Signal>}
                      <Signal tone="muted" className="tabular-nums">
                        {seg.minSec !== null ? `min ${formatDuration(seg.minSec)}` : "no minimum"}
                      </Signal>
                    </div>
                    {seg.cue && <p className="text-[13px] text-[#9AA5B5] truncate">{seg.cue}</p>}
                    {segIssues.filter((x) => x.severity === "blocker").map((x) => (
                      <p key={x.code + x.message} className="text-[13px] text-[#F6C875]">
                        <i className="ri-error-warning-line mr-1" aria-hidden="true" />
                        {x.message}
                      </p>
                    ))}
                  </div>
                  <div className="w-[84px] text-right shrink-0">
                    {seg.targetSec !== null ? (
                      <p className="text-[17px] font-medium tabular-nums text-[#F5F7FC]">{formatDuration(seg.targetSec)}</p>
                    ) : (
                      <p className="text-[14px] font-medium text-[#F6C875]" data-testid="duration-missing">
                        Not entered
                      </p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0 ml-auto">
                    <button
                      type="button"
                      aria-label={`Move ${seg.title || "segment"} up`}
                      disabled={i === 0}
                      onClick={() => onMove(seg.id, -1)}
                      className="w-9 h-11 rounded text-[#CAD0DA] hover:bg-[#1E232B] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                      data-testid={`move-up-${seg.id}`}
                    >
                      <i className="ri-arrow-up-s-line text-[20px]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${seg.title || "segment"} down`}
                      disabled={i === plan.segments.length - 1}
                      onClick={() => onMove(seg.id, 1)}
                      className="w-9 h-11 rounded text-[#CAD0DA] hover:bg-[#1E232B] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                      data-testid={`move-down-${seg.id}`}
                    >
                      <i className="ri-arrow-down-s-line text-[20px]" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${seg.title || "segment"}`}
                      onClick={() => onEdit(seg.id)}
                      className="w-10 h-11 rounded text-[#CAD0DA] hover:bg-[#1E232B] cursor-pointer"
                      data-testid={`edit-${seg.id}`}
                    >
                      <i className="ri-edit-line text-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                </li>
                {cuesAfter(seg, i).map((cue) => (
                  <li key={cue.id} className="flex items-center gap-3 py-1 pl-[96px] pr-2 text-[14px]">
                    <i className="ri-focus-3-line text-[#8A95A5]" aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-[#B7C1CE]">
                      <span className="text-[#9AA5B5]">{cue.audience === "operator" ? "Operator cue" : "Presenter cue"} · </span>
                      <span className="text-[#E4E8F0]">{cue.title}</span>
                      {cue.action !== "none" && <span className="text-[#9AA5B5]"> · {CUE_ACTION_LABEL[cue.action]}</span>}
                      <span className="text-[#9AA5B5]">
                        {" · "}
                        {cue.timing.type === "at_offset"
                          ? `at ${clock(plan.plannedStartMs + cue.timing.offsetSec * 1000)}`
                          : `${cue.timing.type === "segment_start" ? "at start" : "at end"}${cue.timing.offsetSec !== 0 ? ` ${cue.timing.offsetSec > 0 ? "+" : ""}${cue.timing.offsetSec}s` : ""}`}
                      </span>
                      <span className="text-[#9AA5B5]"> · 0:00 host time</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditCue(cue.id)}
                      aria-label={`Edit cue ${cue.title}`}
                      className="w-9 h-9 rounded text-[#CAD0DA] hover:bg-[#1E232B] cursor-pointer"
                      data-testid={`edit-cue-${cue.id}`}
                    >
                      <i className="ri-edit-line" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </React.Fragment>
            );
          })}
          {orphanCues.map((cue) => (
            <li key={cue.id} className="py-2 pl-[96px] text-[14px] text-[#F6C875]">
              Cue “{cue.title}” refers to a segment that no longer exists.
              <button type="button" className="ml-2 underline cursor-pointer" onClick={() => onEditCue(cue.id)}>
                Fix
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Product Pack (session snapshot)
// ---------------------------------------------------------------------------------------------

export function ProductPack({
  products,
  plan,
  onAdd,
  onPatch,
  onRemove,
}: {
  products: ProductSnapshot[];
  plan: PlanVersion;
  /** Returns false when nothing was added (the reason is shown by the page). A REAL show answers asynchronously. */
  onAdd: (items: ProductSnapshot[]) => boolean | Promise<boolean>;
  onPatch: (productId: string, patch: Partial<ProductSnapshot>) => void | boolean | Promise<boolean>;
  onRemove: (productId: string) => void | boolean | Promise<boolean>;
}): React.ReactElement {
  const command = useCommandState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [notes, setNotes] = useState("");

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const parsedPrice = price.trim() === "" ? null : Number(price);
  const detailsValid = name.trim() !== "" && currency.trim() !== "" &&
    (parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0));
  // Segments AND cues can target a product; removing it would leave a dangling target.
  const refs = selected ? productReferences(plan, selected.id) : { segments: [], cues: [] };
  const usedBy = [...refs.segments.map((s) => s.title || "Untitled segment"), ...refs.cues.map((c) => `cue “${c.title}”`)];
  const rows = useMemo(() => parseProductRows(importText, products.map((p) => p.code)), [importText, products]);
  const validRows = rows.filter((r) => r.status === "valid");
  const available = PRODUCT_LIBRARY.filter((p) => !products.some((x) => x.id === p.id || x.code === p.code));

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex gap-2 mb-2 shrink-0">
        <Button variant="secondary" size="sm" icon="ri-upload-2-line" onClick={() => setImportOpen(true)} className="flex-1" data-testid="import-btn">
          Import
        </Button>
        <Button variant="secondary" size="sm" icon="ri-book-2-line" onClick={() => setLibraryOpen(true)} className="flex-1" data-testid="library-btn">
          Library
        </Button>
      </div>

      {products.length > 0 && (
        <p className="text-[13px] text-[#9AA5B5] mb-1.5 shrink-0" data-testid="product-edit-hint">
          <i className="ri-edit-line mr-1" aria-hidden="true" />
          Select a product to edit its details, set priority, or disable it for this show.
        </p>
      )}
      {products.length === 0 ? (
        <div className="py-6 text-center" data-testid="empty-pack">
          <i className="ri-shopping-bag-3-line text-[24px] text-[#8A95A5]" aria-hidden="true" />
          <p className="text-[16px] font-medium text-[#F5F7FC] mt-1">No products yet</p>
          <p className="text-[14px] text-[#B7C1CE] mt-1">Add a lineup, or keep this LIVE product-free. A product-free show is valid.</p>
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1" data-testid="prepare-product-list">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                title={`Edit ${p.code} · ${p.name}`}
                onClick={() => {
                  setSelectedId(p.id);
                  setName(p.name);
                  setPrice(p.price === null ? "" : String(p.price));
                  setCurrency(p.currency);
                  setNotes(p.notes ?? "");
                }}
                className={`w-full text-left flex gap-3 items-center p-2.5 rounded-[10px] cursor-pointer transition-colors ${
                  p.status === "disabled" ? "bg-[#111317] opacity-70" : "bg-[#181C24] hover:bg-[#202632]"
                }`}
              >
                <SegmentTile segment={{ kind: "product", title: p.name }} product={p} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono text-[#B7C1CE]">{p.code}</span>
                    {p.priority === "high" && (
                      <Signal tone="lime" icon="ri-flag-line" className="text-[12px] font-semibold">High</Signal>
                    )}
                    {p.status === "disabled" && <Signal tone="muted" icon="ri-subtract-line" className="text-[12px]">Disabled</Signal>}
                  </div>
                  <p className="text-[16px] font-medium text-[#F5F7FC] truncate">{p.name}</p>
                  <p className="text-[14px] text-[#CAD0DA]">
                    {p.price !== null ? `${p.currency} ${p.price}` : "Not entered"}
                    {p.source === "sample_library" && <span className="ml-2 text-[#F6C875]" data-testid="sample-tag">Sample</span>}
                  </p>
                </div>
                <i className="ri-edit-line text-[18px] text-[#8A95A5] shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="pt-2 text-[12px] text-[#8A95A5] shrink-0">Products for this show · edits here never change the library or past shows.</p>

      <Dialog
        isOpen={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.code} · ${selected.name}` : ""}
        description="Edit product details for this show, including products already used in the rundown."
        confirmText="Save product details"
        confirmDisabled={!detailsValid}
        onConfirm={() => {
          if (!selected || !detailsValid) return;
          afterResult(onPatch(selected.id, { name: name.trim(), price: parsedPrice, currency: currency.trim(), notes: notes.trim() }), () => setSelectedId(null));
        }}
        cancelText="Close"
      >
        {selected && (
          <fieldset disabled={command.busy} className="space-y-4 pb-1 border-0 p-0 m-0 min-w-0" data-testid="product-dialog">
            <label className="block text-[14px] text-[#CAD0DA]">
              Product name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[#F5F7FC]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[14px] text-[#CAD0DA]">
                Price (optional)
                <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[#F5F7FC]" />
              </label>
              <label className="block text-[14px] text-[#CAD0DA]">
                Currency
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[#F5F7FC]" />
              </label>
            </div>
            <p className="text-[13px] text-[#9AA5B5]" data-testid="product-correct-hint">
              Leave price blank when it is unknown. Enter 0 only for a known zero price.
            </p>
            <label className="block text-[14px] text-[#CAD0DA]">
              Operator notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[#F5F7FC]" />
            </label>
            {!detailsValid && <p className="text-[14px] text-[#F6C875]">Enter a product name and currency. Price must be blank or a valid number of zero or more.</p>}
            {selected.source === "sample_library" && <p className="text-[14px] text-[#F6C875]">Sample origin is retained when you edit these details. Check all product facts before a real show.</p>}
            {selected.talkingPoints.length > 0 && (
              <ul className="list-disc list-inside text-[14px] text-[#B7C1CE] space-y-1">
                {selected.talkingPoints.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant={selected.priority === "high" ? "primary" : "secondary"} size="sm" onClick={() => onPatch(selected.id, { priority: selected.priority === "high" ? "normal" : "high" })}>
                {selected.priority === "high" ? "High priority · set to normal" : "Mark as high priority"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onPatch(selected.id, { status: selected.status === "enabled" ? "disabled" : "enabled" })}>
                {selected.status === "enabled" ? "Disable for this show" : "Enable"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={usedBy.length > 0}
                title={usedBy.length > 0 ? `Used by ${usedBy.join(", ")}` : undefined}
                data-testid="remove-product-btn"
                onClick={() => afterResult(onRemove(selected.id), () => setSelectedId(null))}
              >
                Remove
              </Button>
            </div>
            <p className="text-[13px] text-[#9AA5B5]">Priority, enable/disable and removal save immediately. Name, price, currency and notes save with “Save product details”.</p>
            {usedBy.length > 0 && (
              <p className="text-[14px] text-[#9AA5B5]" data-testid="product-used-by">
                Used by {usedBy.join(", ")}. Change or remove those first, so no segment or cue points at a missing product.
              </p>
            )}
          </fieldset>
        )}
      </Dialog>

      <Dialog isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} title="Add from library" cancelText="Close" size="md">
        <div className="space-y-3 pb-1" data-testid="library-dialog">
          <p className="text-[15px] text-[#F6C875]" data-testid="library-sample-notice">
            <i className="ri-information-line mr-1.5" aria-hidden="true" />
            Sample library shipped with LiveLift — example products, names and prices, not your catalog. Copies stay marked “Sample”; check every
            one before a real show.
          </p>
          {PACK_LIBRARY.map((pack) => {
            const items = PRODUCT_LIBRARY.filter((p) => pack.productIds.includes(p.id) && available.some((a) => a.id === p.id));
            return (
              <div key={pack.id} className="p-3 rounded-[8px] bg-[#14171E] flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-[#F5F7FC]">{pack.name}</p>
                  <p className="text-[13px] text-[#9AA5B5]">{items.length} not yet in this show</p>
                </div>
                <Button size="sm" variant="secondary" disabled={items.length === 0} onClick={() => onAdd(items.map((p) => structuredClone(p)))} data-testid={`add-pack-${pack.id}`}>
                  Add pack
                </Button>
              </div>
            );
          })}
          <ul className="divide-y divide-[#262C38]">
            {available.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-[15px] text-[#F5F7FC]">
                  <span className="font-mono text-[13px] text-[#AEB7C5] mr-2">{p.code}</span>
                  {p.name}
                </span>
                <Button size="sm" variant="ghost" onClick={() => onAdd([structuredClone(p)])}>
                  Add
                </Button>
              </li>
            ))}
            {available.length === 0 && <li className="py-2 text-[14px] text-[#9AA5B5]">Every library product is already in this show.</li>}
          </ul>
        </div>
      </Dialog>

      <Dialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import products"
        description="Paste CSV or TSV rows: code, name, price. A missing price stays “Not entered”."
        confirmText={`Import ${validRows.length} product${validRows.length === 1 ? "" : "s"}`}
        confirmDisabled={validRows.length === 0}
        onConfirm={() => {
          // Distinct codes keep distinct identities even when they normalise alike ("A-B" vs "A_B").
          const items = toProductSnapshots(rows, "Imported", products.map((p) => p.id));
          afterResult(onAdd(items), () => {
            setImportText("");
            setImportOpen(false);
          });
        }}
        size="lg"
      >
        <div className="space-y-3 pb-1" data-testid="import-dialog">
          <textarea
            aria-label="Product rows to import"
            data-testid="import-text"
            data-autofocus
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"M08, Wool Beanie, USD 14\nM09, Gift card, —"}
            className="w-full bg-[#13161C] border border-[#39414D] rounded-[8px] p-3 text-[14px] font-mono text-[#F5F7FC]"
          />
          {rows.length > 0 && (
            <ul className="divide-y divide-[#262C38] text-[14px]" data-testid="import-preview">
              {rows.map((r) => (
                <li key={r.line} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-[#E4E8F0]">
                    {r.code || "—"} · {r.name || "—"} · {r.price !== null ? `${r.currency} ${r.price}` : "Not entered"}
                  </span>
                  <Signal tone={r.status === "valid" ? "neutral" : r.status === "duplicate" ? "warn" : "danger"} icon={r.status === "valid" ? "ri-check-line" : "ri-error-warning-line"}>
                    {r.status === "valid" ? "valid" : r.reason}
                  </Signal>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </div>
  );
}
