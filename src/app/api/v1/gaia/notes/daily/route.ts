/**
 * Versioned alias of /api/gaia/notes/daily.
 *
 * Re-exports the handlers from src/app/api/gaia/notes/daily/route.ts
 * so the versioned surface (/api/v1/...) and the unversioned path stay
 * identical. The implementation lives in the unversioned file;
 * do not edit handlers here.
 */
export * from "../../../../gaia/notes/daily/route";
