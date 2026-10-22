import { z } from "zod";

/**
 * Shapes of the production API, kept deliberately lenient: providers type this
 * data by hand, so most fields are optional/nullable and money fields stay
 * `unknown` until the pricing code parses them. A record that fails even this
 * is reported and skipped; it never takes the whole page down.
 */

export const envelopeSchema = z.object({ data: z.array(z.unknown()) });

export const rawSubcategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  type: z.string(),
  position: z.number().nullish(),
  status: z.boolean().nullish(),
  parentId: z.string().nullish(),
});

export const rawCategorySchema = rawSubcategorySchema.extend({
  children: z.array(z.unknown()).nullish(),
});

export const rawProviderSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  username: z.string().nullish(),
  status: z.string().nullish(),
  providerInformation: z
    .object({
      companyName: z.string().nullish(),
      slug: z.string().nullish(),
      types: z.array(z.string()).nullish(),
      currency: z.string().nullish(),
      city: z.object({ id: z.string().nullish(), name: z.string(), slug: z.string() }).nullish(),
      country: z
        .object({ id: z.number().nullish(), name: z.string(), alphaCode: z.string() })
        .nullish(),
      rating: z.number().nullish(),
      reviewCount: z.number().nullish(),
    })
    .nullish(),
});

export const rawWellnessOptionSchema = z.object({
  id: z.string(),
  durationInMinutes: z.number(),
  price: z.unknown().optional(),
  discount: z.unknown().optional(),
  discountType: z.unknown().optional(),
  serviceCharge: z.unknown().optional(),
  serviceChargeType: z.unknown().optional(),
});

export const rawServiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  type: z.string(),
  userId: z.number(),
  categoryId: z.string().nullish(),
  subCategoryId: z.string().nullish(),
  price: z.unknown().optional(),
  discount: z.unknown().optional(),
  discountType: z.unknown().optional(),
  serviceCharge: z.unknown().optional(),
  serviceChargeType: z.unknown().optional(),
  status: z.boolean().nullish(),
  testAtHome: z.boolean().nullish(),
  homeTestCharge: z.unknown().optional(),
  wellnessPricing: z.array(z.unknown()).nullish(),
  createdAt: z.string().nullish(),
});

export type RawCategory = z.infer<typeof rawCategorySchema>;
export type RawSubcategory = z.infer<typeof rawSubcategorySchema>;
export type RawProvider = z.infer<typeof rawProviderSchema>;
export type RawService = z.infer<typeof rawServiceSchema>;
export type RawWellnessOption = z.infer<typeof rawWellnessOptionSchema>;

export interface RawCatalog {
  categories: unknown[];
  providers: unknown[];
  services: unknown[];
}
