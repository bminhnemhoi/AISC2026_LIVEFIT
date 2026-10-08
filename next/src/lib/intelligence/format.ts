import type { Money, ExactRatio, ProviderMetric } from "@/contracts/liveIntelligence";
import type { Availability, EvidenceOrigin, MetricKey } from "./types";

/**
 * How a value is shown. The single rule: a recorded 0 is a visible "0"; a hole is words ("Not recorded"),
 * never "0", "-" or an empty bar. Words carry the state, so colour is never the only cue.
 */

export const METRIC_LABEL: Record<MetricKey, string> = {
  viewers: "Viewers",
  impressions: "Product impressions",
  clicks: "Product clicks",
  orders: "Orders",
  gmv: "GMV",
  comments: "Comment count",
  likes: "Likes",
  shares: "Shares",
};

/** Short column heads for dense tables. */
export const METRIC_SHORT: Record<MetricKey, string> = {
  viewers: "Viewers",
  impressions: "Impressions",
  clicks: "Clicks",
  orders: "Orders",
  gmv: "GMV",
  comments: "Comments",
  likes: "Likes",
  shares: "Shares",
};

export const AVAILABILITY_WORDS: Record<Exclude<Availability, "available">, string> = {
  missing: "Not recorded",
  unknown: "Unknown",
  unsupported: "Not offered by the provider",
};

export type CellState = "value" | "zero" | Exclude<Availability, "available">;

export interface CellText {
  state: CellState;
  /** What a reader sees. For a recorded value this is the formatted number. */
  text: string;
  /** Spoken form, including the unit or the reason a value is absent. */
  spoken: string;
}

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return Number.isInteger(n) ? integer.format(n) : number.format(n);
}

/** Exact decimal money: grouping never passes through floating point. */
export function formatMoney(money: Money): string {
  const [whole, fraction = ""] = money.amount.split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${money.currency} ${integer.format(BigInt(whole))}${decimals ? `.${decimals}` : ""}`;
}

/** Rounded for display only; the authoritative rational remains intact. */
export function formatRate(ratio: ExactRatio): string {
  const denominator = BigInt(ratio.denominator);
  const pct = (BigInt(ratio.numerator) * 10_000n + denominator / 2n) / denominator;
  return `${pct / 100n}${pct % 100n ? `.${String(pct % 100n).padStart(2, "0").replace(/0+$/, "")}` : ""}%`;
}

export function cell(value: ProviderMetric["value"] | undefined, availability: Availability | null, kind: { money?: string | null; rate?: boolean; metric?: MetricKey } = {}): CellText {
  const a = availability ?? (value == null ? "missing" : "available");
  if (a !== "available" || value == null) {
    const state = a === "available" ? "missing" : a;
    return { state, text: AVAILABILITY_WORDS[state], spoken: AVAILABILITY_WORDS[state] };
  }
  const text = typeof value === "number" ? formatCount(value) : "amount" in value ? formatMoney(value) : kind.rate ? formatRate(value) : `${value.numerator}/${value.denominator}${value.currency ? ` ${value.currency}` : ""}`;
  const zero = typeof value === "number" ? value === 0 : "amount" in value ? /^0(?:\.0+)?$/.test(value.amount) : BigInt(value.numerator) === 0n;
  return { state: zero ? "zero" : "value", text, spoken: zero ? `${text}, recorded as zero` : text };
}

export const ORIGIN_LABEL: Record<EvidenceOrigin, string> = {
  provider: "Provider observed",
  fixture: "Fixture provider evidence",
};
