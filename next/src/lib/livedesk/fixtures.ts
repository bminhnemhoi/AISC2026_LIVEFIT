import type { DeskChart, DeskComment, DeskProduct, LiveDeskActions, LiveDeskViewModel, StartActions, StartViewModel } from "./types";

/** Static view models so screens can be built and tested before the engine exists. Labelled SIMULATED like everything else. */

const PRODUCTS: DeskProduct[] = [
  { id: "p1", name: "Zip Hoodie", priceLabel: "199.000 ₫", stock: 24, sync: { state: "synced", detail: null }, showing: false },
  { id: "p2", name: "Cargo Pants", priceLabel: "249.000 ₫", stock: 9, sync: { state: "synced", detail: null }, showing: true },
  { id: "p3", name: "Canvas Tote", priceLabel: null, stock: null, sync: { state: "failed", detail: "error_param: item not found" }, showing: false },
];

const COMMENTS: DeskComment[] = [
  { id: "c3", atSec: 412, user: "viewer_8812", text: "Mình cao 1m65 nặng 52kg lấy size nào ạ", intent: "ask_size", piiMasked: false },
  { id: "c2", atSec: 405, user: "viewer_1203", text: "Chốt đơn quần này, sđt ***", intent: "ready_to_buy", piiMasked: true },
  { id: "c1", atSec: 398, user: "viewer_7081", text: "Giá bao nhiêu vậy shop", intent: "ask_price", piiMasked: false },
];

const chart = (title: string, unit: string, values: number[]): DeskChart => ({
  title,
  unit,
  points: values.map((value, i) => ({ atSec: i * 60, value })),
  markers: [{ atSec: 240, kind: "pin", label: "Pinned Cargo Pants" }],
  summary: `${title}: ${values.length} points, from ${values[0]} to ${values[values.length - 1]} ${unit}.`,
});

export function fixtureDeskView(): LiveDeskViewModel {
  return {
    mode: "live",
    title: "Fall collection rehearsal",
    platformLabel: "SIMULATED Live",
    clock: { running: false, speed: 15, speeds: [1, 5, 15, 60], elapsedLabel: "06:52", virtualNowLabel: "20:06:52" },
    products: PRODUCTS,
    showingProductId: "p2",
    viewers: 437,
    comments: COMMENTS,
    intentCounts: { ask_price: 7, ask_size: 4, ready_to_buy: 3, praise: 5, other: 9 },
    charts: { viewers: chart("Viewers", "viewers", [120, 180, 260, 310, 380, 420, 437]), addToCart: chart("Add to cart per minute", "per minute", [0, 1, 2, 2, 5, 8, 6]) },
    copilot: {
      aiStatus: "rules_only",
      statusLabel: "Rules only",
      suggestions: [
        {
          id: "s1",
          kind: "show_next",
          productId: "p1",
          headline: "Show Zip Hoodie next",
          signals: [{ label: "Ask price, last 2 min", value: "7 comments" }, { label: "Stock", value: "24" }],
          sampleSize: 12,
          confidence: "medium",
          source: "rules",
          state: "proposed",
          atSec: 410,
        },
      ],
    },
    banner: null,
    fingerprint: "e8d00fb0",
    assumptions: ["Viewers follow a seeded curve.", "A pinned product draws more add-to-carts than the others. This is an assumption, not a finding."],
  };
}

export function fixtureStartView(): StartViewModel {
  return { platformLabel: "SIMULATED Live", connected: true, products: PRODUCTS, startBlockedReason: null, importNote: "3 imported, 0 rows skipped" };
}

const noop = (): void => undefined;

export const noopDeskActions: LiveDeskActions = {
  onRun: noop, onPause: noop, onSpeed: noop, onSkip: noop, onReset: noop, onPin: noop, onUnpin: noop,
  onAcceptSuggestion: noop, onDismissSuggestion: noop, onEndLive: noop,
};

export const noopStartActions: StartActions = {
  onConnect: noop, onImportText: noop, onImportSamplePack: noop, onRemoveProduct: noop, onStartLive: () => null,
};
