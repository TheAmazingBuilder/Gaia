import "server-only";

import {
  createCanvasCommand,
  deleteCanvasCommand,
  getCanvasQuery,
  listCanvasesQuery,
  updateCanvasCommand,
} from "@/modules/knowledge/services/canvas";
import { notFound, validationError } from "@/shared/errors/gaia-error";

type CanvasDependencies = Parameters<typeof createCanvasCommand>[2];

const canvasDependencies: CanvasDependencies = {
  validationError,
  canvasNotFound: () => notFound("CANVAS_NOT_FOUND", "Canvas not found."),
};

export function listCanvases(userId: string) {
  return listCanvasesQuery(userId);
}

export function getCanvas(userId: string, canvasId: string) {
  return getCanvasQuery(userId, canvasId, canvasDependencies);
}

export function createCanvas(userId: string, input: unknown) {
  return createCanvasCommand(userId, input, canvasDependencies);
}

export function updateCanvas(userId: string, canvasId: string, input: unknown) {
  return updateCanvasCommand(userId, canvasId, input, canvasDependencies);
}

export function deleteCanvas(userId: string, canvasId: string) {
  return deleteCanvasCommand(userId, canvasId, canvasDependencies);
}
