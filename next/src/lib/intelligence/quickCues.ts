/**
 * Operator quick cues.
 *
 * TikTok exposes no raw LIVE comment text and no pin events, so the operator is the only observer of these moments.
 * A quick cue is a one-tap OPERATOR REPORT. It is recorded through the existing, authoritative `add_note` command:
 * no new event type, no new authority state, no provider state. The authority stamps the time; the text carries a
 * fixed suffix so Review can recognise it and label it as an operator report. It is never confirmation of anything.
 */

export interface QuickCue {
  id: string;
  label: string;
  icon: string;
  hint: string;
}

export const QUICK_CUES: readonly QuickCue[] = [
  { id: "price_questions", label: "Price questions rising", icon: "ri-question-answer-line", hint: "Viewers keep asking what it costs" },
  { id: "cta_delivered", label: "CTA delivered", icon: "ri-megaphone-line", hint: "The host said the call to action" },
  { id: "pin_changed", label: "Product pin changed", icon: "ri-pushpin-line", hint: "You changed the pinned product in TikTok" },
  { id: "reaction_spike", label: "Audience reaction spike", icon: "ri-fire-line", hint: "A burst of comments or reactions" },
  { id: "unexpected_issue", label: "Unexpected issue", icon: "ri-error-warning-line", hint: "Something went wrong on the stream" },
];

export const QUICK_CUE_SUFFIX = " (operator-reported quick cue)";

/** The exact note text recorded for a quick cue. */
export const quickCueNoteText = (cue: QuickCue): string => `${cue.label}${QUICK_CUE_SUFFIX}`;

/** The quick cue a note records, or null for any other note. Only the fixed labels are recognised. */
export function parseQuickCue(noteText: string): QuickCue | null {
  if (!noteText.endsWith(QUICK_CUE_SUFFIX)) return null;
  const label = noteText.slice(0, -QUICK_CUE_SUFFIX.length);
  return QUICK_CUES.find((c) => c.label === label) ?? null;
}
