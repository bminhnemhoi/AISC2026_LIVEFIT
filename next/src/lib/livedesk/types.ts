/**
 * The contract between the Live Desk logic (`@/lib/livedesk`, the engine, adapter and Copilot) and its screens
 * (`@/components/livedesk`, `@/app/start`, `@/app/desk`).
 *
 * Screens are presentational: they receive a view model, render it, and call the actions. They never read the
 * clock, never import the engine or the platform, and never format a number the logic left out. The logic builds
 * the view models and owns every rule. Change this file only through the operator.
 *
 * Everything here is SIMULATED. A viewer, comment, add-to-cart or purchase is a labelled invention, never a
 * measurement, and a Copilot suggestion is a reading of signals, never a cause.
 */

export type CommentIntent = "ask_price" | "ask_size" | "ready_to_buy" | "praise" | "other";

export const COMMENT_INTENTS: readonly CommentIntent[] = ["ask_price", "ask_size", "ready_to_buy", "praise", "other"];

export type DeskMode = "idle" | "live" | "ended";

// ---- /start ---------------------------------------------------------------------------------------------------

export type ProductSyncState = "queued" | "synced" | "failed";

export interface DeskProduct {
  /** LiveLift's own id. Stable across syncs. */
  id: string;
  name: string;
  /** Already formatted for display. null when the price was not entered: missing is not zero. */
  priceLabel: string | null;
  /** null when stock was not entered. */
  stock: number | null;
  sync: { state: ProductSyncState; /** The platform's own words for a failure; null otherwise. */ detail: string | null };
  /** True while this product is the one showing on the platform. */
  showing: boolean;
}

export interface StartViewModel {
  platformLabel: string;
  connected: boolean;
  products: DeskProduct[];
  /** Why Start live is disabled, in plain words, or null when it can be pressed. */
  startBlockedReason: string | null;
  /** Result of the last import, e.g. "3 imported, 1 row skipped: no name". null before any import. */
  importNote: string | null;
}

export interface StartActions {
  onConnect: () => void;
  /** Pasted CSV or TSV text. */
  onImportText: (text: string) => void;
  onImportSamplePack: () => void;
  onRemoveProduct: (productId: string) => void;
  /** Starts the live and returns the id for `/desk/[liveId]`; null when blocked or failed. */
  onStartLive: () => string | null;
}

// ---- /desk ----------------------------------------------------------------------------------------------------

export interface DeskComment {
  id: string;
  /** Seconds since the live started. */
  atSec: number;
  user: string;
  /** Already passed through the PII mask. The raw text is never in a view model. */
  text: string;
  intent: CommentIntent;
  piiMasked: boolean;
}

export type DeskMarkerKind = "pin" | "unpin" | "host_pin" | "host_unpin";

export interface DeskChart {
  title: string;
  unit: string;
  points: { atSec: number; value: number }[];
  /** Where someone pinned or unpinned. Shown as markers; they say when, never why. */
  markers: { atSec: number; kind: DeskMarkerKind; label: string }[];
  /** One sentence for people who cannot see the chart. */
  summary: string;
}

export type SuggestionKind = "show_next" | "flash_sale";
export type SuggestionState = "proposed" | "accepted" | "dismissed" | "performed";

export interface CopilotSuggestion {
  id: string;
  kind: SuggestionKind;
  /** The product to show or put on sale. */
  productId: string;
  headline: string;
  /** What the suggestion read, e.g. { label: "Ask price, last 2 min", value: "7 comments" }. */
  signals: { label: string; value: string }[];
  /** How many events the signals rest on. Confidence comes from this alone. */
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  /** Who produced the wording and the ranking. */
  source: "rules" | "ai";
  state: SuggestionState;
  /** Seconds since the live started. */
  atSec: number;
}

export type CopilotAiStatus = "rules_only" | "ai_ok" | "ai_fallback";

export interface DeskClockView {
  running: boolean;
  speed: number;
  speeds: readonly number[];
  /** e.g. "12:40". */
  elapsedLabel: string;
  /** Virtual wall clock, e.g. "20:12:40". */
  virtualNowLabel: string;
}

export interface LiveDeskViewModel {
  mode: DeskMode;
  title: string;
  /** e.g. "SIMULATED Live". Always carries the word SIMULATED. */
  platformLabel: string;
  clock: DeskClockView;
  products: DeskProduct[];
  /** null when nothing is showing. */
  showingProductId: string | null;
  /** Simulated. null means "not simulated", never zero. */
  viewers: number | null;
  /** Newest first. */
  comments: DeskComment[];
  /** Comments per intent over the last two minutes. */
  intentCounts: Record<CommentIntent, number>;
  charts: { viewers: DeskChart; addToCart: DeskChart };
  copilot: {
    aiStatus: CopilotAiStatus;
    /** e.g. "Rules only" or "AI model, rules as fallback". Plain words, no provider keys. */
    statusLabel: string;
    suggestions: CopilotSuggestion[];
  };
  /** A platform condition to show once, e.g. "Authorisation expired". */
  banner: { tone: "info" | "warn" | "danger"; text: string } | null;
  /** The run fingerprint, like the Lab's. null before the first event. */
  fingerprint: string | null;
  /** What the generator assumes. Listed on screen so nobody mistakes them for findings. */
  assumptions: string[];
}

export interface LiveDeskActions {
  onRun: () => void;
  onPause: () => void;
  onSpeed: (speed: number) => void;
  onSkip: (seconds: number) => void;
  onReset: () => void;
  /** Free: no schedule, no cooldown, no confirmation. */
  onPin: (productId: string) => void;
  onUnpin: () => void;
  onAcceptSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onEndLive: () => void;
}

// ---- Recap and timeline (WP7, additive) -----------------------------------------------------------------------

/**
 * What became of each line in the recap table. A recommendation is not an acceptance, and an acceptance is not a
 * performed action: `accepted` is the operator's click, `performed` needs the platform to show it done.
 */
export type RecapOutcome = "open" | "no_response" | "accepted" | "performed" | "dismissed" | "self" | "host";

/** A pin or unpin, with the product it concerns. */
export interface DeskTimelineMark {
  atSec: number;
  kind: DeskMarkerKind;
  productId: string;
  productName: string;
}

/** A stretch of the live during which one product was on show. */
export interface DeskPinBand {
  productId: string;
  productName: string;
  fromSec: number;
  toSec: number;
  /** The operator pinned it from the desk, or the host pinned it in the app (provider observed, SIMULATED). */
  by: "operator" | "host";
}

export interface RecapRow {
  /** When the suggestion was made, or when the pin or unpin happened. */
  atSec: number;
  action: "show_next" | "flash_sale" | "pin" | "unpin";
  productId: string;
  productName: string;
  outcome: RecapOutcome;
  /** What a suggestion rested on; null for a pin or unpin nobody suggested. */
  suggestion: Pick<CopilotSuggestion, "id" | "signals" | "sampleSize" | "confidence" | "source"> | null;
  /** For an accepted show_next: the second its pin was made. null when not known. */
  actedAtSec: number | null;
}

export interface RecapViewModel {
  liveId: string;
  mode: DeskMode;
  title: string;
  platformLabel: string;
  durationSec: number;
  /** The highest sampled viewer count; null before the first sample. Samples are `viewerSampleSec` apart. */
  peakViewers: number | null;
  viewerSampleSec: number;
  viewerPoints: { atSec: number; value: number }[];
  /** Add-to-carts per minute for the product on show; null for a minute with no product on show (missing, not zero). */
  cartsPerMinute: Array<number | null>;
  /** Their sum over the minutes with a product on show; null when nothing was ever on show. */
  cartsOnShow: number | null;
  operatorPins: number;
  hostPins: number;
  marks: DeskTimelineMark[];
  bands: DeskPinBand[];
  rows: RecapRow[];
  /** Comments per intent over the last two minutes that were played. */
  intentCounts: Record<CommentIntent, number>;
  /** The desk keeps only recent comments: how many it still holds, how many were masked, and from which second. */
  commentsHeld: { count: number; masked: number; fromSec: number | null };
  /** Products whose price or stock was not entered. */
  missing: { id: string; name: string; price: boolean; stock: boolean }[];
  fingerprint: string | null;
}

/** A condition the SIMULATED platform can be put into from the assumptions drawer, to rehearse it. */
export type DeskPlatformFault = "token_expired" | "rate_limited" | "server_error";
