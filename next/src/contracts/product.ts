import { z } from "zod";

export const ProductPrioritySchema = z.enum(["high", "normal"]);
export type ProductPriority = z.infer<typeof ProductPrioritySchema>;

export const ProductStatusSchema = z.enum(["enabled", "disabled"]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductSnapshotSchema = z.object({
  id: z.string(),
  code: z.string().min(1, "Product code is required"),
  name: z.string().min(1, "Product name is required"),
  price: z.number().nullable(), // missing != zero
  currency: z.string().default("USD"),
  priority: ProductPrioritySchema.default("normal"),
  status: ProductStatusSchema.default("enabled"),
  notes: z.string().optional(),
  talkingPoints: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  imageUrl: z.string().nullable().optional(),
  initials: z.string().default("PR"),
  libraryOriginId: z.string().nullable().optional(),
  asOf: z.string().optional(),
  /** Where the facts came from. Sample data shipped with the build is never presented as the operator's catalog. */
  source: z.enum(["sample_library", "operator_entry", "import"]).optional(),
});
export type ProductSnapshot = z.infer<typeof ProductSnapshotSchema>;

export const PackSnapshotSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Pack name is required"),
  description: z.string().optional(),
  productIds: z.array(z.string()),
  updatedAt: z.string(),
});
export type PackSnapshot = z.infer<typeof PackSnapshotSchema>;
