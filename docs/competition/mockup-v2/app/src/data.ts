// Scripted sample data. All of it is fictional: no real people, shops or brands.
// The timeline is deterministic, so the story shows the same numbers on every run.

export type ProductId = "hoodie" | "cargo" | "linen" | "tote";
export type Intent = "price" | "size" | "order" | "other";

export interface Product {
  id: ProductId;
  name: string;
  short: string;
  initials: string;
  /** null means the seller has not entered it. Never shown as 0. */
  price: number | null;
  stock: number | null;
}

export interface Comment {
  id: number;
  t: number;
  handle: string;
  text: string;
  intent: Intent;
  product: ProductId | null;
  /** personal data (phone number) was masked before display */
  masked: boolean;
}

export interface CartAdd {
  t: number;
  product: ProductId;
}

export const SESSION_LENGTH = 1800; // run of show: 30 minutes
export const WINDOW = 120; // the assistant reads the last 2 minutes

export const PRODUCTS: Product[] = [
  { id: "hoodie", name: "Áo hoodie zip", short: "Hoodie", initials: "AH", price: 199000, stock: 24 },
  { id: "cargo", name: "Quần cargo", short: "Cargo", initials: "QC", price: 249000, stock: 9 },
  { id: "linen", name: "Áo sơ mi linen", short: "Linen", initials: "SM", price: 229000, stock: 15 },
  { id: "tote", name: "Túi vải tote", short: "Tote", initials: "TV", price: null, stock: null },
];

export const SAMPLE_CSV = [
  "ten_san_pham,gia,ton_kho",
  "Áo hoodie zip,199000,24",
  "Quần cargo,249000,9",
  "Áo sơ mi linen,229000,15",
  "Túi vải tote,,",
].join("\n");

export const INTENT_LABEL: Record<Intent, string> = {
  price: "Hỏi giá",
  size: "Hỏi size",
  order: "Chốt đơn",
  other: "Khác",
};

const MASK = "{PHONE}";

const TEXT: Record<string, string[]> = {
  "hoodie.price": [
    "Áo hoodie giá bao nhiêu vậy shop",
    "Hoodie còn màu xám không ạ, giá sao",
    "Hoodie zip nhiêu tiền shop ơi",
    "Shop ơi báo giá hoodie giúp mình",
    "Áo khoác zip này giá sao ạ",
    "Hoodie có đang giảm giá không shop",
    "Hoodie đen giá bao nhiêu ạ",
    "Cho mình hỏi giá hoodie với",
  ],
  "hoodie.size": [
    "Mình cao 1m65 nặng 52kg lấy size nào ạ",
    "Hoodie form rộng hay ôm vậy shop",
    "Nam 1m72 nặng 65kg mặc hoodie size gì",
    "Hoodie có size XL không ạ",
  ],
  "hoodie.order": [
    "Lên đơn giúp mình 2 cái hoodie nha",
    "Chốt 1 hoodie xám size M",
    `Mình chốt hoodie, sđt ${MASK}`,
    "Lấy 1 hoodie đen size L nha shop",
    "Chốt hoodie kem size S ạ",
  ],
  "cargo.price": ["Quần cargo giá sao shop", "Quần túi hộp nhiêu vậy ạ", "Cargo bao nhiêu tiền shop"],
  "cargo.size": [
    "Quần này có size L không shop",
    "Cargo eo 72 mặc size gì ạ",
    "Quần cargo dài không shop, mình cao 1m60",
    "Quần có size 30 không ạ",
    "Mình 58kg mặc quần cargo size M vừa không",
  ],
  "cargo.order": [
    `Chốt đơn quần này, sđt ${MASK}`,
    "Lấy 1 quần cargo màu be size M",
    "Lên đơn quần cargo cho mình nha",
  ],
  "linen.price": ["Sơ mi linen giá sao shop", "Áo linen bao nhiêu ạ", "Sơ mi trắng giá nhiêu vậy shop"],
  "linen.size": ["Sơ mi có size S không shop", "Áo linen form rộng không ạ", "Mình 1m58 mặc sơ mi size gì"],
  "linen.order": ["Lấy 1 sơ mi trắng size M nha", `Chốt sơ mi linen, sđt ${MASK}`],
  "tote.price": ["Túi tote giá bao nhiêu vậy shop", "Túi vải bán sao shop ơi"],
  other: [
    "Shop live đẹp quá",
    "Xin chào shop, mình mới vào",
    "Âm thanh hơi nhỏ shop ơi",
    "Ship về Đà Nẵng mấy ngày ạ",
    "Shop có cho đổi size không",
    "Chị mặc đẹp quá",
    "Live tới mấy giờ vậy shop",
    "Có freeship không shop",
    `Inbox giúp mình qua số ${MASK}`,
    "Ánh sáng hôm nay đẹp ghê",
    "Hôm qua mình mua rồi, vải ổn lắm",
    "Shop quay lại mẫu lúc nãy được không",
  ],
};

type Spec = Partial<Record<`${ProductId}.${Exclude<Intent, "other">}` | "other", number>>;
interface Segment {
  from: number;
  to: number;
  comments: Spec;
  cart: Partial<Record<ProductId, number>>;
}

// Each segment is a (from, to] slice of the session. The 2-minute windows the story stops on
// line up with segment edges, so the numbers the brief asks for come out exactly:
// at 2:00 Hoodie has 4 mentions; at 4:00 it has 12, 7 of them asking the price, and
// 8 add-to-cart against 3 in the 2 minutes before.
const SEGMENTS: Segment[] = [
  { from: 0, to: 120, comments: { other: 3, "hoodie.price": 2, "hoodie.size": 1, "hoodie.order": 1, "cargo.size": 1 }, cart: { hoodie: 3, cargo: 1 } },
  { from: 120, to: 240, comments: { "hoodie.price": 7, "hoodie.size": 3, "hoodie.order": 2, "cargo.size": 2, other: 2 }, cart: { hoodie: 8, cargo: 1 } },
  { from: 240, to: 360, comments: { "hoodie.price": 3, "hoodie.size": 2, "hoodie.order": 3, "cargo.size": 2, "cargo.price": 1, "linen.price": 1, "tote.price": 1, other: 3 }, cart: { hoodie: 6, cargo: 1, linen: 1 } },
  { from: 360, to: 420, comments: { "hoodie.price": 1, "hoodie.order": 2, "cargo.size": 1, other: 2 }, cart: { hoodie: 4 } },
  { from: 420, to: 540, comments: { "hoodie.price": 2, "hoodie.size": 2, "hoodie.order": 4, "cargo.size": 2, "linen.size": 1, other: 3 }, cart: { hoodie: 12, cargo: 2 } },
  { from: 540, to: 660, comments: { "hoodie.price": 1, "hoodie.size": 1, "hoodie.order": 2, "cargo.size": 3, "cargo.price": 1, "cargo.order": 1, "linen.price": 1, other: 3 }, cart: { hoodie: 6, cargo: 3 } },
  { from: 660, to: 780, comments: { "hoodie.order": 1, "hoodie.price": 1, "cargo.size": 3, "cargo.order": 1, other: 3 }, cart: { hoodie: 4, cargo: 4 } },
  { from: 780, to: 900, comments: { "hoodie.price": 2, "hoodie.size": 1, "hoodie.order": 1, "cargo.size": 3, "cargo.price": 1, other: 3 }, cart: { hoodie: 3, cargo: 4 } },
  { from: 900, to: 1200, comments: { "cargo.size": 6, "cargo.price": 3, "cargo.order": 6, "hoodie.price": 2, "hoodie.order": 2, "linen.price": 2, "linen.size": 1, "tote.price": 1, other: 6 }, cart: { cargo: 18, hoodie: 5, linen: 2 } },
  { from: 1200, to: 1500, comments: { "cargo.size": 3, "cargo.price": 2, "cargo.order": 4, "hoodie.price": 3, "hoodie.size": 2, "hoodie.order": 2, "linen.price": 3, "linen.size": 2, "linen.order": 1, other: 6 }, cart: { cargo: 10, hoodie: 8, linen: 5 } },
  { from: 1500, to: 1800, comments: { "linen.price": 4, "linen.size": 3, "linen.order": 2, "cargo.size": 2, "cargo.order": 3, "hoodie.price": 2, "hoodie.order": 2, "tote.price": 1, other: 7 }, cart: { linen: 9, cargo: 6, hoodie: 5 } },
];

/** Small deterministic PRNG (mulberry32) so handles and jitter never change between runs. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spread n events over (from, to] with a little jitter, never crossing the edges. */
function spread(n: number, from: number, to: number, rand: () => number): number[] {
  const len = to - from;
  const step = len / n;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const jitter = (rand() - 0.5) * step * 0.6;
    const t = Math.round(from + step * (k + 0.5) + jitter);
    out.push(Math.min(to, Math.max(from + 1, t)));
  }
  return out;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTimeline() {
  const rand = rng(20261022);
  const used: Record<string, number> = {};
  const comments: Omit<Comment, "id">[] = [];
  const cart: CartAdd[] = [];
  for (const seg of SEGMENTS) {
    const kinds: string[] = [];
    for (const [key, n] of Object.entries(seg.comments)) for (let i = 0; i < (n ?? 0); i++) kinds.push(key);
    const order = shuffle(kinds, rand);
    const times = spread(order.length, seg.from, seg.to, rand);
    order.forEach((key, i) => {
      const pool = TEXT[key];
      const k = used[key] ?? 0;
      used[key] = k + 1;
      const raw = pool[k % pool.length];
      const [product, intent] = key === "other" ? [null, "other" as Intent] : (key.split(".") as [ProductId, Intent]);
      comments.push({
        t: times[i],
        handle: `viewer_${1000 + Math.floor(rand() * 9000)}`,
        text: raw.replace(MASK, "••••••••••"),
        intent,
        product,
        masked: raw.includes(MASK),
      });
    });
    for (const [product, n] of Object.entries(seg.cart)) {
      for (const t of spread(n ?? 0, seg.from, seg.to, rand)) cart.push({ t, product: product as ProductId });
    }
  }
  comments.sort((a, b) => a.t - b.t);
  cart.sort((a, b) => a.t - b.t);
  return { comments: comments.map((c, id) => ({ ...c, id })), cart };
}

const timeline = buildTimeline();
export const COMMENTS: Comment[] = timeline.comments;
export const CART: CartAdd[] = timeline.cart;

/** Concurrent viewers: 120 at the start, about 440 at 30:00, with a gentle deterministic wobble. */
export function viewersAt(t: number): number {
  const x = Math.min(1, Math.max(0, t / SESSION_LENGTH));
  const base = 120 + 318 * (1 - Math.pow(1 - x, 1.6));
  const wobble = 5 * Math.sin(t / 47) + 3 * Math.sin(t / 13 + 1);
  return Math.round(t < 30 ? 120 + (base - 120) * (t / 30) : base + wobble * Math.min(1, t / 120));
}
