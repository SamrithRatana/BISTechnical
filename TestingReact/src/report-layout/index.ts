/**
 * @file report-layout/index.ts
 * @description Public surface of the one report layout.
 *
 * Web imports it as `@/report-layout`; the CamID app imports the mirrored
 * copy as `../report-layout`. See `types.ts` for the rules this folder lives
 * by — the short version is: no framework imports, ever, or the phone build
 * breaks.
 */

export * from "./types";
export * from "./defaults";
export * from "./fields";
export * from "./format";
export * from "./spareparts";
export * from "./design";
export * from "./css";
export * from "./html";
export * from "./document";
