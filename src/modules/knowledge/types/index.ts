import type { GaiaNoteRow } from "@/modules/notes/types";

export type GaiaNoteRelationDTO = {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  type: string;
  /** "outgoing" = from the queried note; "incoming" = towards it. */
  direction: "outgoing" | "incoming";
  otherNoteId: string;
  otherTitle: string;
  createdAt: string;
};

export type GaiaNoteLinkItem = {
  id: string;
  title: string;
  via: "ref" | "relation";
  relationType?: string;
};

export type GaiaUnlinkedMention = {
  id: string;
  title: string;
  snippet: string;
};

export type GaiaNoteLinksResponse = {
  outgoing: GaiaNoteLinkItem[];
  backlinks: GaiaNoteRow[];
  unlinkedMentions: GaiaUnlinkedMention[];
  relations: GaiaNoteRelationDTO[];
};

export type GaiaLinkSuggestion = {
  id: string;
  title: string;
  score: number;
  sharedWords: string[];
};

export type GaiaKnowledgeTimelineMonth = {
  month: string;
  created: number;
  edited: number;
  relations: number;
  notes: Array<{ id: string; title: string; mastery: import("@/lib/gaia/spaced-repetition").MasteryLevel; createdAt: string }>;
};

export type GaiaSmartCollectionDTO = {
  id: string;
  name: string;
  icon: string;
  criteria: import("@/lib/gaia/knowledge").KnowledgeCollectionCriteria;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GaiaCanvasItemDTO = {
  noteId: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type GaiaCanvasDTO = {
  id: string;
  name: string;
  items: GaiaCanvasItemDTO[];
  createdAt: string;
  updatedAt: string;
};
