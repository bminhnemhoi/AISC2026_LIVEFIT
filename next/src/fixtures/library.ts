import type { PackSnapshot, ProductSnapshot } from "@/contracts";

/**
 * SAMPLE product library shipped with this build. These are example products — not the operator's
 * catalog, prices or stock — and every copy is tagged `source: "sample_library"` so a REAL show can
 * disclose it. Sessions copy these into their own per-show snapshot; history is never shared.
 * A missing price is `null` ("Not entered"), never 0.
 */
export const PRODUCT_LIBRARY: ProductSnapshot[] = [
  {
    id: "prod_m01",
    code: "M01",
    name: "Ribbed Tee",
    price: 18,
    currency: "USD",
    priority: "normal",
    status: "enabled",
    notes: "Fit, color, size guide",
    talkingPoints: ["100% organic cotton", "Pre-shrunk fabric", "Sizes S to 3XL"],
    constraints: [],
    initials: "RT",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m02",
    code: "M02",
    name: "Zip Hoodie",
    price: 36,
    currency: "USD",
    priority: "normal",
    status: "enabled",
    notes: "Show zip + fit comparison",
    talkingPoints: ["YKK dual zipper", "Heavyweight 420gsm", "Brushed fleece interior"],
    constraints: ["Verify discount before claiming"],
    initials: "ZH",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m03",
    code: "M03",
    name: "Cargo Pants",
    price: 42,
    currency: "USD",
    priority: "high",
    status: "enabled",
    notes: "Pocket detail + sizing chart",
    talkingPoints: ["Water repellent finish", "6 reinforced pockets", "Adjustable ankle cuffs"],
    constraints: [],
    initials: "CP",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m04",
    code: "M04",
    name: "Túi đeo chéo",
    price: null,
    currency: "USD",
    priority: "normal",
    status: "enabled",
    notes: "Price not entered yet by merchandising",
    talkingPoints: ["Waterproof nylon", "Fidlock magnetic buckle"],
    constraints: [],
    initials: "TĐ",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m05",
    code: "M05",
    name: "Canvas Tote",
    price: 22,
    currency: "USD",
    priority: "normal",
    status: "disabled",
    notes: "Low stock alert - disabled for this show",
    talkingPoints: ["Reinforced stitching", "Internal laptop sleeve"],
    constraints: [],
    initials: "CT",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m06",
    code: "M06",
    name: "Crew Socks",
    price: 8,
    currency: "USD",
    priority: "normal",
    status: "enabled",
    notes: "Bundle offer add-on",
    talkingPoints: ["Arch compression", "Seamless toe"],
    constraints: [],
    initials: "06",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
  {
    id: "prod_m07",
    code: "M07",
    name: "Áo khoác nhẹ",
    price: 38,
    currency: "USD",
    priority: "normal",
    status: "enabled",
    notes: "Windbreaker for autumn transition",
    talkingPoints: ["Ultra packable", "DWR coated"],
    constraints: [],
    initials: "07",
    asOf: "Oct 2, 2026",
    source: "sample_library",
  },
];

export const PACK_LIBRARY: PackSnapshot[] = [
  {
    id: "pack_01",
    name: "Autumn Outerwear Lineup",
    description: "Standard fall collection with hoodies and cargo pants",
    productIds: ["prod_m01", "prod_m02", "prod_m03", "prod_m04", "prod_m06", "prod_m07"],
    updatedAt: "Oct 2, 2026",
  },
  {
    id: "pack_02",
    name: "Weekend Basics",
    description: "Tees, accessories, and promotional items",
    productIds: ["prod_m01", "prod_m04", "prod_m06"],
    updatedAt: "Sep 28, 2026",
  },
];

/** Independent copies of library products, so a show's snapshot can never alias the library. */
export function snapshotProducts(ids: string[]): ProductSnapshot[] {
  const wanted = new Set(ids);
  return PRODUCT_LIBRARY.filter((p) => wanted.has(p.id)).map((p) => structuredClone(p));
}
