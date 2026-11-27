import type { GaiaBlock } from "@/lib/gaia/content";
import type { MasteryLevel } from "@/lib/gaia/spaced-repetition";

export type GaiaNotePropertyType = "text" | "number" | "date" | "checkbox" | "select";

export type GaiaNoteProperty = {
  key: string;
  value: string;
  type: GaiaNotePropertyType;
  options?: string[];
};

export type GaiaNoteRow = {
  id: string;
  title: string;
  icon: string | null;
  folderId: string | null;
  folderName: string | null;
  tagIds: string[];
  tagNames: string[];
  favorite: boolean;
  templateId: string | null;
  excerpt: string;
  wordCount: number;
  blockCount: number;
  refCount: number;
  todoOpen: number;
  cover: string | null;
  wordGoal: number | null;
  properties: GaiaNoteProperty[];
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  deletedAt: string | null;
  mastery: MasteryLevel;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
};

export type GaiaNoteDTO = {
  id: string;
  userId: string;
  title: string;
  icon: string | null;
  folderId: string | null;
  tagIds: string[];
  favorite: boolean;
  templateId: string | null;
  blocks: GaiaBlock[];
  cover: string | null;
  wordGoal: number | null;
  properties: GaiaNoteProperty[];
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  deletedAt: string | null;
  mastery: MasteryLevel;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
};

export type GaiaNoteResponse = {
  note: GaiaNoteDTO;
  folderName: string | null;
  tagNames: string[];
};

export type GaiaVersionSummary = {
  id: string;
  title: string;
  savedAt: string;
  wordCount: number;
};

export type GaiaVersionDetail = {
  id: string;
  title: string;
  savedAt: string;
  blocks: GaiaBlock[];
};
