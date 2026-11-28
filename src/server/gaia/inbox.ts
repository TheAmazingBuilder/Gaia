import "server-only";

import {
  convertInboxItemCommand,
  createInboxItemCommand,
  deleteInboxItemCommand,
  listInboxQuery,
  toggleInboxItemCommand,
} from "@/modules/knowledge/services/inbox";
import { findActiveNote, loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { toDTO } from "@/modules/notes/mappers";
import { createNote } from "@/server/gaia/notes-write";
import { notFound, validationError } from "@/shared/errors/gaia-error";

type InboxDependencies = Parameters<typeof convertInboxItemCommand>[2];

const inboxDependencies: InboxDependencies = {
  validationError,
  inboxItemNotFound: () => notFound("INBOX_ITEM_NOT_FOUND", "Inbox item not found."),
  findActiveNote,
  loadFolders,
  loadTags,
  toDTO,
  createNote,
};

export function listInbox(userId: string) {
  return listInboxQuery(userId);
}

export function createInboxItem(userId: string, input: unknown) {
  return createInboxItemCommand(userId, input, inboxDependencies);
}

export function toggleInboxItem(userId: string, itemId: string, done: boolean) {
  return toggleInboxItemCommand(userId, itemId, done, inboxDependencies);
}

export function deleteInboxItem(userId: string, itemId: string) {
  return deleteInboxItemCommand(userId, itemId, inboxDependencies);
}

export function convertInboxItem(userId: string, itemId: string) {
  return convertInboxItemCommand(userId, itemId, inboxDependencies);
}
