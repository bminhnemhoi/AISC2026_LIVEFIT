import { fnv1a } from "@/lib/platform/shopeeLive";
import { classifyIntent } from "./intent";
import { maskPii } from "./pii";
import type { CommentIntent } from "./types";

/**
 * The Live Desk's realtime generator. SIMULATED: every viewer, comment, add-to-cart and purchase is invented here.
 *
 * Events for one virtual second are a pure function of (seed, second, world): no wall clock, no Math.random, no
 * memory of earlier calls. The session plays seconds one by one, in order, applying the operator's actions at the
 * second they happened, so Run, Pause, any speed and any skip give the same log for the same actions.
 *
 * Raw comment text never leaves this file: each comment is masked (`maskPii`) and classified on the masked text
 * before it is returned.
 *
 * How the generator responds to what is showing is an ASSUMPTION, listed in `ASSUMPTIONS` and shown on screen. It is
 * how this simulation was written, not something anyone measured about real viewers.
 */

export interface EngineProduct {
  id: string;
  name: string;
  /** null when stock was not entered: purchases then never run it down. */
  stock: number | null;
}

export interface EngineWorld {
  /** The products the platform has (synced), in the desk's order. */
  products: readonly EngineProduct[];
  /** What the platform shows this second, as LiveLift last read it. */
  showingProductId: string | null;
  /** How long that product has been showing, in seconds. 0 when nothing is showing. */
  shownForSec: number;
}

export interface EngineComment {
  id: string;
  atSec: number;
  user: string;
  /** Already masked. */
  text: string;
  intent: CommentIntent;
  piiMasked: boolean;
  /** The product the comment reads as being about: one it names, else the one showing. null when neither. */
  aboutProductId: string | null;
}

export interface SecondEvents {
  atSec: number;
  viewers: number;
  comments: EngineComment[];
  /** One entry per add-to-cart, by product id. */
  addToCart: string[];
  /** One entry per purchase, by product id. Never more than the entered stock allows. */
  purchases: string[];
}

export const ASSUMPTIONS: readonly string[] = [
  "SIMULATED: viewers follow a seeded curve that climbs over the first few minutes and then wobbles. A pinned product lifts them a little.",
  "SIMULATED: comments per second grow with the number of viewers.",
  "SIMULATED: while a product is pinned, comments ask more about its price and size and more viewers say they will buy it. Comments about other products name them.",
  "SIMULATED: a pinned product draws far more add-to-carts than the others, rising over its first two minutes on show.",
  "SIMULATED: about one add-to-cart in three becomes a purchase at once. A purchase lowers stock only when stock was entered.",
  "SIMULATED: a few comments carry obviously fake phone numbers and emails so the PII mask is visible.",
  "SIMULATED: these are assumptions written into the simulation, not findings about real viewers or about any real platform.",
];

/** A uniform number in [0, 1) for this seed, second and purpose. */
const u = (seed: number, sec: number, tag: string): number => fnv1a(`livedesk:${seed}:${sec}:${tag}`) / 4294967296;

export function viewersAt(seed: number, sec: number, world: EngineWorld): number {
  const climb = 30 + 430 * (1 - Math.exp(-sec / 240));
  const wobble = 1 + 0.08 * Math.sin(sec / 37) + 0.04 * Math.sin(sec / 11);
  const noise = 1 + (u(seed, sec, "viewers") - 0.5) * 0.06;
  const lift = world.showingProductId ? 1.06 : 1;
  return Math.max(0, Math.round(climb * wobble * noise * lift));
}

// Templates. "{p}" is a product name. The fake numbers and the example.com address are deliberately not real.
const ABOUT_SHOWING: ReadonlyArray<readonly [number, readonly string[]]> = [
  [22, ["Giá bao nhiêu vậy shop", "bn tiền vậy shop", "Giá nhiêu ạ", "báo giá đi shop"]],
  [18, ["Mình cao 1m65 nặng 52kg lấy size nào ạ", "Có size L không shop", "form có rộng không ạ", "size M mặc vừa không"]],
  [14, ["Chốt cho em 1 cái", "em lấy 1 nha shop", "chốt đơn, sđt 0123 456 789", "đặt hàng nha shop, email test@example.com"]],
  [18, ["Đẹp quá shop ơi", "Xinh quá", "Tuyệt vời quá", "Cảm ơn shop nhiều"]],
  [18, ["Chào cả nhà", "Hôm nay live lâu không shop", "ship về Hà Nội mất bao lâu ạ", "Bấm lai bấm lai khán giả ơi"]],
];
const NAMING: readonly string[] = [
  "{p} giá bao nhiêu vậy shop",
  "{p} có size L không shop",
  "Cho xem {p} đi shop",
  "Chốt {p} cho em 1 cái",
  "{p} đẹp quá",
  "{p} còn hàng không ạ, zalo 0900 000 000",
];
const IDLE: readonly string[] = ["Chào cả nhà", "Hôm nay có gì mới không shop", "Đẹp quá shop ơi", "Giá bao nhiêu vậy shop", "Shop ơi live lâu không"];

const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];

function weighted(groups: ReadonlyArray<readonly [number, readonly string[]]>, r: number): readonly string[] {
  const total = groups.reduce((n, [w]) => n + w, 0);
  let at = r * total;
  for (const [w, list] of groups) {
    if (at < w) return list;
    at -= w;
  }
  return groups[groups.length - 1][1];
}

const fold = (s: string): string => s.toLocaleLowerCase("vi");

/** The product a (masked) comment reads as being about: a product it names, else the one showing. */
export function attributeComment(text: string, products: readonly EngineProduct[], showingProductId: string | null): string | null {
  const t = fold(text);
  const named = products.find((p) => p.name.trim() !== "" && t.includes(fold(p.name)));
  return named?.id ?? showingProductId;
}

function rawComment(seed: number, sec: number, i: number, world: EngineWorld): string {
  const r = (tag: string): number => u(seed, sec, `c${i}:${tag}`);
  const showing = world.products.find((p) => p.id === world.showingProductId);
  const others = world.products.filter((p) => p.id !== world.showingProductId);
  if (showing && (others.length === 0 || r("named") >= 0.1)) return pick(weighted(ABOUT_SHOWING, r("group")), r("text"));
  if (others.length > 0 && r("idle") >= 0.35) return pick(NAMING, r("text")).replace("{p}", pick(others, r("product")).name);
  return pick(IDLE, r("text"));
}

/** Everything that happens in one virtual second. Pure. */
export function simulateSecond(seed: number, atSec: number, world: EngineWorld): SecondEvents {
  const viewers = viewersAt(seed, atSec, world);

  const rate = Math.min(2.5, 0.15 + viewers / 400);
  const count = Math.floor(rate) + (u(seed, atSec, "count") < rate - Math.floor(rate) ? 1 : 0);
  const comments: EngineComment[] = [];
  for (let i = 0; i < count; i++) {
    const mask = maskPii(rawComment(seed, atSec, i, world));
    comments.push({
      id: `c${atSec}-${i}`,
      atSec,
      user: `viewer_${1000 + (fnv1a(`livedesk-user:${seed}:${atSec}:${i}`) % 9000)}`,
      text: mask.text,
      intent: classifyIntent(mask.text),
      piiMasked: mask.masked,
      aboutProductId: attributeComment(mask.text, world.products, world.showingProductId),
    });
  }

  const addToCart: string[] = [];
  const purchases: string[] = [];
  for (const p of world.products) {
    const shown = p.id === world.showingProductId;
    const momentum = shown ? Math.min(1.5, 0.5 + world.shownForSec / 120) : 1;
    const chance = shown ? (0.02 + viewers / 6000) * momentum : 0.004;
    if (u(seed, atSec, `atc:${p.id}`) >= chance) continue;
    addToCart.push(p.id);
    const inStock = p.stock === null || p.stock > 0;
    if (inStock && u(seed, atSec, `buy:${p.id}`) < 0.35) purchases.push(p.id);
  }
  return { atSec, viewers, comments, addToCart, purchases };
}
