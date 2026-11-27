/**
 * Versioned alias of /api/gaia/collections.
 *
 * Re-exports the handlers from src/app/api/gaia/collections/route.ts
 * so the versioned surface (/api/v1/...) and the unversioned path stay
 * identical. The implementation lives in the unversioned file;
 * do not edit handlers here.
 */
export * from "../../../gaia/collections/route";
