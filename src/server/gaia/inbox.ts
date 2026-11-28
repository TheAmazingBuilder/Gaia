import {
  convertInboxItemCommand,
  createInboxItemCommand,
  deleteInboxItemCommand,
  listInboxQuery,
  toggleInboxItemCommand,
} from "@/modules/knowledge/services/inbox";

type InboxDependencies = Parameters<typeof convertInboxItemCommand>[2];

export function listInbox(userId: string) {
  return listInboxQuery(userId);
}

export function createInboxItem(
  userId: string,
  input: unknown,
  deps: Pick<InboxDependencies, "validationError">,
) {
  return createInboxItemCommand(userId, input, deps);
}

export function toggleInboxItem(
  userId: string,
  itemId: string,
  done: boolean,
  deps: Pick<InboxDependencies, "inboxItemNotFound">,
) {
  return toggleInboxItemCommand(userId, itemId, done, deps);
}

export function deleteInboxItem(
  userId: string,
  itemId: string,
  deps: Pick<InboxDependencies, "inboxItemNotFound">,
) {
  return deleteInboxItemCommand(userId, itemId, deps);
}

export function convertInboxItem(
  userId: string,
  itemId: string,
  deps: InboxDependencies,
) {
  return convertInboxItemCommand(userId, itemId, deps);
}
