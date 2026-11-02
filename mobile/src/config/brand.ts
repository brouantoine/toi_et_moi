/**
 * Product identity on mobile. Values live in brand.json (the single place to edit,
 * also read by app.config.ts, whose loader cannot require .ts files).
 * Backend counterpart: BRAND_NAME. The bundle identifier is a placeholder: see docs/HUMAN_TODO.md.
 */
import brand from './brand.json';

export type Brand = {
  readonly name: string;
  readonly slug: string;
  readonly scheme: string;
  readonly bundleId: string;
};

export const BRAND: Brand = brand;
