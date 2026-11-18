/**
 * Typed message catalog — English only. The EN file defines the shape.
 *
 * Copied verbatim from Promethe src/i18n/dictionaries.ts. In Gaïa,
 * messages/en.json only contains the `gaia` subtree (+ `common.cancel` /
 * `common.retry`, the only two common.* keys the Gaïa components use).
 */
import en from "../../messages/en.json";
import type { AppLocale } from "./config";

export type Messages = typeof en;

export const MESSAGES: Record<AppLocale, Messages> = {
  en,
};
