/**
 * @file validation/index.ts
 * @description Public surface of the shared business rules.
 *
 * Web imports it as `@/validation`; the CamID app imports the mirrored copy as
 * `../validation`. See `stockShortage.ts` for the rules this folder lives by —
 * the short version is: plain TypeScript, no framework imports, ever, or the
 * phone build breaks.
 */

export * from "./stockShortage";
export * from "./stockPreflight";
export * from "./contact";
export * from "./reference";
export * from "./forms";
export * from "./taxonomy";
export * from "./transitions";
