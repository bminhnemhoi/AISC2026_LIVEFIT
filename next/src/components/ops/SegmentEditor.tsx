"use client";

import React, { useState } from "react";
import type { Cue, PlanVersion, ProductSnapshot, Segment } from "@/contracts";
import {
  formatClock,
  formatDuration,
  msToZonedParts,
  parseDuration,
  zonedTimeToMs,
} from "@/lib/domain";
import { Dialog } from "@/components/ui";

const INPUT =
  "w-full h-11 bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[16px] text-[#F5F7FC]";
const LABEL = "block text-[14px] text-[#CAD0DA] mb-1";

const KINDS: Array<{ value: Segment["kind"]; label: string }> = [
  { value: "opening", label: "Opening" },
  { value: "product", label: "Product" },
  { value: "promotion", label: "Promotion / announcement (uses host time)" },
  { value: "qa", label: "Q&A" },
  { value: "closing", label: "Closing" },
  { value: "break", label: "Break" },
];

export interface SegmentDraft {
  title: string;
  kind: Segment["kind"];
  productId: string | null;
  targetSec: number | null;
  minSec: number | null;
  optional: boolean;
  anchorOffsetSec: number | null;
  cue: string | null;
}

/** Resolve a clock time (in the show's timezone) to seconds after the planned start. */
function anchorOffsetFrom(plan: PlanVersion, tz: string, timeText: string): number | null {
  const date = msToZonedParts(plan.plannedStartMs, tz).date;
  let ms = zonedTimeToMs(date, timeText.length === 5 ? `${timeText}:00` : timeText, tz);
  if (ms === null) return null;
  if (ms < plan.plannedStartMs) ms += 86_400_000; // a show that runs past midnight
  return Math.round((ms - plan.plannedStartMs) / 1000);
}

export function SegmentEditorDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  segment,
  plan,
  products,
  tz,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: SegmentDraft) => void;
  onDelete?: () => void;
  segment: Segment | null;
  plan: PlanVersion;
  products: ProductSnapshot[];
  tz: string;
}): React.ReactElement {
  const [title, setTitle] = useState(segment?.title ?? "");
  const [kind, setKind] = useState<Segment["kind"]>(segment?.kind ?? "product");
  const [productId, setProductId] = useState<string>(segment?.productId ?? "");
  const [duration, setDuration] = useState(segment?.targetSec != null ? formatDuration(segment.targetSec) : "");
  const [minimum, setMinimum] = useState(segment?.minSec != null ? formatDuration(segment.minSec) : "");
  const [optional, setOptional] = useState(segment?.optional ?? false);
  const [anchored, setAnchored] = useState(segment?.anchorOffsetSec != null);
  const [anchorTime, setAnchorTime] = useState(
    segment?.anchorOffsetSec != null
      ? formatClock(plan.plannedStartMs + segment.anchorOffsetSec * 1000, tz, true)
      : formatClock(plan.plannedStartMs + 600_000, tz, true)
  );
  const [cue, setCue] = useState(segment?.cue ?? "");

  const targetSec = parseDuration(duration);
  // Blank = no minimum declared (cannot be shortened). "0:00" is a real declared minimum of zero.
  const minSec = minimum.trim() === "" ? null : parseDuration(minimum, { allowZero: true });
  const anchorOffset = anchored ? anchorOffsetFrom(plan, tz, anchorTime) : null;

  const errors: string[] = [];
  if (title.trim() === "") errors.push("Give the segment a title.");
  if (targetSec === null) errors.push("Enter a duration like 6:00 or 6 (minutes). Missing is not zero.");
  if (minimum.trim() !== "" && minSec === null) errors.push("Enter the minimum like 4:00 (0:00 allowed), or leave it empty for none.");
  if (targetSec !== null && minSec !== null && minSec > targetSec) errors.push("The minimum cannot exceed the duration.");
  if (anchored && (anchorOffset === null || anchorOffset < 0)) errors.push("Enter the committed start time.");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={segment ? "Edit segment" : "Add segment"}
      confirmText="Save segment"
      confirmDisabled={errors.length > 0}
      onConfirm={() =>
        onSave({
          title: title.trim(),
          kind,
          productId: productId === "" ? null : productId,
          targetSec,
          minSec,
          optional,
          anchorOffsetSec: anchored ? anchorOffset : null,
          cue: cue.trim() === "" ? null : cue.trim(),
        })
      }
      size="lg"
    >
      <div className="space-y-4 pb-1" data-testid="segment-editor">
        {onDelete && (
          <div className="flex justify-end -mb-2">
            <button type="button" onClick={onDelete} className="text-[14px] text-[#F4A4A4] hover:underline cursor-pointer" data-testid="segment-delete">
              Delete segment and its cues
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="seg-title">Title</label>
            <input id="seg-title" data-testid="seg-title" data-autofocus className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="seg-kind">Kind</label>
            <select id="seg-kind" className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as Segment["kind"])}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="seg-product">Product</label>
            <select id="seg-product" className={INPUT} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">No product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}{p.status === "disabled" ? " (disabled)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="seg-duration">Duration (target)</label>
            <input id="seg-duration" data-testid="seg-duration" className={`${INPUT} tabular-nums`} placeholder="6:00" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="seg-min">Minimum (optional)</label>
            <input id="seg-min" data-testid="seg-min" className={`${INPUT} tabular-nums`} placeholder="none declared" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
            <p className="text-[13px] text-[#9AA5B5] mt-1">Empty = cannot be shortened. 0:00 = may be cut entirely.</p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2 text-[15px] text-[#F5F7FC] cursor-pointer">
            <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} className="w-5 h-5 accent-[#DFFF00]" data-testid="seg-optional" />
            Optional — may be skipped without losing required coverage
          </label>
          <label className="flex items-center gap-2 text-[15px] text-[#F5F7FC] cursor-pointer">
            <input type="checkbox" checked={anchored} onChange={(e) => setAnchored(e.target.checked)} className="w-5 h-5 accent-[#DFFF00]" data-testid="seg-anchored" />
            Hard anchor — committed start time that never moves on its own
          </label>
          {anchored && (
            <div className="pl-7">
              <label className={LABEL} htmlFor="seg-anchor">Committed start ({tz})</label>
              <input id="seg-anchor" data-testid="seg-anchor" type="time" step={1} className={`${INPUT} max-w-[200px] tabular-nums`} value={anchorTime} onChange={(e) => setAnchorTime(e.target.value)} />
            </div>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="seg-cue">Presenter cue (short)</label>
          <input id="seg-cue" className={INPUT} placeholder="e.g. Show zip + fit comparison" value={cue} onChange={(e) => setCue(e.target.value)} />
        </div>

        {errors.length > 0 && (
          <ul className="text-[14px] text-[#F6C875] space-y-0.5" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export type CueDraft = Omit<Cue, "id">;

export function CueEditorDialog({
  isOpen,
  onClose,
  onSave,
  onDelete,
  cue,
  plan,
  products,
  tz,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: CueDraft) => void;
  onDelete?: () => void;
  cue: Cue | null;
  plan: PlanVersion;
  products: ProductSnapshot[];
  tz: string;
}): React.ReactElement {
  const firstSeg = plan.segments[0]?.id ?? "";
  const [title, setTitle] = useState(cue?.title ?? "");
  const [audience, setAudience] = useState<Cue["audience"]>(cue?.audience ?? "operator");
  const [action, setAction] = useState<Cue["action"]>(cue?.action ?? "none");
  const [productId, setProductId] = useState(cue?.productId ?? "");
  const [timingType, setTimingType] = useState<Cue["timing"]["type"]>(cue?.timing.type ?? "segment_start");
  const [segmentId, setSegmentId] = useState(cue && cue.timing.type !== "at_offset" ? cue.timing.segmentId : firstSeg);
  const [offsetSec, setOffsetSec] = useState(String(cue ? cue.timing.offsetSec : 0));
  const [clockText, setClockText] = useState(
    cue && cue.timing.type === "at_offset"
      ? formatClock(plan.plannedStartMs + cue.timing.offsetSec * 1000, tz, true)
      : formatClock(plan.plannedStartMs + 600_000, tz, true)
  );
  const [text, setText] = useState(cue?.text ?? "");

  const clockOffset = timingType === "at_offset" ? anchorOffsetFrom(plan, tz, clockText) : null;
  const relOffset = Number(offsetSec);
  const errors: string[] = [];
  if (title.trim() === "") errors.push("Give the cue a title.");
  if (timingType === "at_offset" && (clockOffset === null || clockOffset < 0)) errors.push("Enter the clock time.");
  if (timingType !== "at_offset" && !plan.segments.some((s) => s.id === segmentId)) errors.push("Choose the segment it is timed to.");
  if (timingType !== "at_offset" && !Number.isInteger(relOffset)) errors.push("The offset must be whole seconds.");
  if ((action === "pin_product" || action === "unpin_product") && productId === "") errors.push("Choose the product to pin or unpin.");

  const build = (): CueDraft => ({
    title: title.trim(),
    audience,
    action: audience === "presenter" ? "none" : action,
    productId: action === "pin_product" || action === "unpin_product" ? productId || null : null,
    timing:
      timingType === "at_offset"
        ? { type: "at_offset", offsetSec: clockOffset ?? 0 }
        : { type: timingType, segmentId, offsetSec: relOffset },
    text: text.trim() === "" ? null : text.trim(),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={cue ? "Edit cue" : "Add cue"}
      description="A cue is a zero-duration marker. It never uses host time. A promotion that takes host time is a segment."
      confirmText="Save cue"
      confirmDisabled={errors.length > 0}
      onConfirm={() => onSave(build())}
      size="lg"
    >
      <div className="space-y-4 pb-1" data-testid="cue-editor">
        {onDelete && (
          <div className="flex justify-end -mb-2">
            <button type="button" onClick={onDelete} className="text-[14px] text-[#F4A4A4] hover:underline cursor-pointer" data-testid="cue-delete">
              Delete cue
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="cue-title">Title</label>
            <input id="cue-title" data-testid="cue-title-input" data-autofocus className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="cue-audience">For</label>
            <select id="cue-audience" className={INPUT} value={audience} onChange={(e) => setAudience(e.target.value as Cue["audience"])}>
              <option value="operator">Operator (an action in TikTok)</option>
              <option value="presenter">Presenter (a note for the host)</option>
            </select>
          </div>
          {audience === "operator" && (
            <div>
              <label className={LABEL} htmlFor="cue-action">Action</label>
              <select id="cue-action" className={INPUT} value={action} onChange={(e) => setAction(e.target.value as Cue["action"])}>
                <option value="none">No specific action</option>
                <option value="pin_product">Pin product</option>
                <option value="unpin_product">Unpin product</option>
                <option value="start_promotion">Start promotion</option>
              </select>
            </div>
          )}
          {audience === "operator" && (action === "pin_product" || action === "unpin_product") && (
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="cue-product">Product</label>
              <select id="cue-product" className={INPUT} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Choose…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={LABEL} htmlFor="cue-timing">Timed to</label>
            <select id="cue-timing" className={INPUT} value={timingType} onChange={(e) => setTimingType(e.target.value as Cue["timing"]["type"])}>
              <option value="segment_start">Start of a segment</option>
              <option value="segment_end">End of a segment</option>
              <option value="at_offset">A wall-clock time</option>
            </select>
          </div>
          {timingType === "at_offset" ? (
            <div>
              <label className={LABEL} htmlFor="cue-clock">Clock time ({tz})</label>
              <input id="cue-clock" type="time" step={1} className={`${INPUT} tabular-nums`} value={clockText} onChange={(e) => setClockText(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className={LABEL} htmlFor="cue-segment">Segment</label>
                <select id="cue-segment" className={INPUT} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                  {plan.segments.map((s) => (
                    <option key={s.id} value={s.id}>{s.title || "Untitled"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="cue-offset">Offset (seconds, negative = before)</label>
                <input id="cue-offset" type="number" className={`${INPUT} tabular-nums`} value={offsetSec} onChange={(e) => setOffsetSec(e.target.value)} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="cue-text">Note (optional)</label>
            <input id="cue-text" className={INPUT} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        {errors.length > 0 && (
          <ul className="text-[14px] text-[#F6C875] space-y-0.5" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

export function DetailsDialog({
  isOpen,
  onClose,
  onSave,
  title: initialTitle,
  objective: initialObjective,
  plannedStartMs,
  tz,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: { title: string; objective: string | null; plannedStartMs: number }) => void;
  title: string;
  objective: string | null;
  plannedStartMs: number;
  tz: string;
}): React.ReactElement {
  const parts = msToZonedParts(plannedStartMs, tz);
  const [title, setTitle] = useState(initialTitle);
  const [objective, setObjective] = useState(initialObjective ?? "");
  const [date, setDate] = useState(parts.date);
  const [time, setTime] = useState(parts.time);
  const ms = zonedTimeToMs(date, time, tz);
  const valid = title.trim() !== "" && ms !== null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Show details"
      confirmText="Save details"
      confirmDisabled={!valid}
      onConfirm={() => ms !== null && onSave({ title: title.trim(), objective: objective.trim() || null, plannedStartMs: ms })}
    >
      <div className="space-y-4 pb-1" data-testid="details-dialog">
        <div>
          <label className={LABEL} htmlFor="det-title">Title</label>
          <input id="det-title" data-autofocus className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL} htmlFor="det-date">Planned date</label>
            <input id="det-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="det-time">Planned start ({tz})</label>
            <input id="det-time" type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <p className="text-[13px] text-[#9AA5B5]">Hard anchors are stored as offsets from the planned start, so moving the start moves them with it — only before the show starts.</p>
        <div>
          <label className={LABEL} htmlFor="det-objective">Objective (optional)</label>
          <input id="det-objective" className={INPUT} value={objective} onChange={(e) => setObjective(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
