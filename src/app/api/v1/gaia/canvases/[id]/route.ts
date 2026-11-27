/**
 * Versioned alias of /api/gaia/canvases/[id].
 *
 * Re-exports the handlers from src/app/api/gaia/canvases/[id]/route.ts
 * so the versioned surface (/api/v1/...) and the unversioned path stay
 * identical. The implementation lives in the unversioned file;
 * do not edit handlers here.
 */
export * from "../../../../gaia/canvases/[id]/route";
