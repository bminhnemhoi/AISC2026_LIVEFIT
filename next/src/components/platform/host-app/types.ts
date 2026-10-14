/**
 * The contract between the Platform Lab (logic) and the host-app components (looks).
 *
 * The host app is the simulated Shopee Live screen the host holds. Components in this folder are presentational only:
 * they receive a `HostAppViewModel`, render it, and call `HostAppActions`. They import nothing from `@/lib/platform`
 * and never read the clock. `toHostAppViewModel` (in `@/lib/platform`) builds the view model from the simulation.
 *
 * Everything here is SIMULATED. A viewer count or a comment is a labelled invention, never a measurement.
 */

export type HostAppMode = "idle" | "live" | "ended";

export interface HostAppBagItem {
  itemId: number;
  name: string;
  /** Already formatted for display, e.g. "199.000 ₫". null when the price is not known: missing is not zero. */
  priceLabel: string | null;
  initials: string;
  pinned: boolean;
}

export interface HostAppPromotion {
  name: string;
  status: "scheduled" | "active" | "ended";
  /** "in 02:10" while scheduled, "ends in 04:30" while active, null otherwise. */
  countdownLabel: string | null;
}

export interface HostAppComment {
  id: string;
  user: string;
  text: string;
}

export interface HostAppViewModel {
  mode: HostAppMode;
  title: string;
  /** The platform session id the host would read out to link LiveLift. null before a live exists. */
  sessionId: number | null;
  /** Simulated. null means "not simulated", never zero. */
  viewers: number | null;
  elapsedLabel: string | null;
  bag: HostAppBagItem[];
  promotion: HostAppPromotion | null;
  /** Synthetic and labelled as such by the component. */
  comments: HostAppComment[];
  /** A platform condition the audience should see, e.g. "Authorisation expired". */
  banner: { tone: "info" | "warn" | "danger"; text: string } | null;
}

export interface HostAppActions {
  onGoLive: () => void;
  onEndLive: () => void;
  onPin: (itemId: number) => void;
  onUnpin: () => void;
  onAddItem: (itemId: number) => void;
  onRemoveItem: (itemId: number) => void;
}
