/**
 * Versioned alias of /api/gaia/memory/graph.
 *
 * Re-exports the handlers from src/app/api/gaia/memory/graph/route.ts so the
 * versioned surface (/api/v1/...) and the unversioned path stay
 * identical. The implementation lives in the unversioned file;
 * do not edit handlers here.
 */
export * from "../../../../gaia/memory/graph/route";
