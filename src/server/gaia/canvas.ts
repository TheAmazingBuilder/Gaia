import {
  createCanvasCommand,
  deleteCanvasCommand,
  getCanvasQuery,
  listCanvasesQuery,
  updateCanvasCommand,
} from "@/modules/knowledge/services/canvas";

type CanvasDependencies = Parameters<typeof createCanvasCommand>[2];

export function listCanvases(userId: string) {
  return listCanvasesQuery(userId);
}

export function getCanvas(
  userId: string,
  canvasId: string,
  deps: Pick<CanvasDependencies, "canvasNotFound">,
) {
  return getCanvasQuery(userId, canvasId, deps);
}

export function createCanvas(
  userId: string,
  input: unknown,
  deps: CanvasDependencies,
) {
  return createCanvasCommand(userId, input, deps);
}

export function updateCanvas(
  userId: string,
  canvasId: string,
  input: unknown,
  deps: CanvasDependencies,
) {
  return updateCanvasCommand(userId, canvasId, input, deps);
}

export function deleteCanvas(
  userId: string,
  canvasId: string,
  deps: Pick<CanvasDependencies, "canvasNotFound">,
) {
  return deleteCanvasCommand(userId, canvasId, deps);
}
