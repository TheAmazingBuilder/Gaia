"use client";

/**
 * Gaïa — Module 2 (K12): Knowledge Inbox.
 *
 * Quick capture: type an idea, it lands in the inbox. Convert turns it
 * into a note (first line = title, one paragraph per line) and marks the
 * item done; items can also be checked off or deleted without a note.
 */
import * as React from "react";
import { Check, Inbox, Plus, StickyNote, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  GaiaEmptyState,
  gaiaErrorMessage,
  gaiaRelativeTime,
  useConvertGaiaInboxItem,
  useCreateGaiaInboxItem,
  useDeleteGaiaInboxItem,
  useGaiaInbox,
  useToggleGaiaInboxItem,
  type GaiaInboxItem,
  type GaiaT,
} from "./gaia-shared";

function InboxRow({
  item,
  onOpenNote,
}: {
  item: GaiaInboxItem;
  onOpenNote: (id: string) => void;
}) {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const { toast } = useToast();
  const toggle = useToggleGaiaInboxItem();
  const remove = useDeleteGaiaInboxItem();
  const convert = useConvertGaiaInboxItem();
  const done = item.doneAt !== null;

  return (
    <li
      data-testid="gaia-inbox-row"
      className={`flex items-start gap-2 rounded-lg border p-3 ${done ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        aria-label={done ? t("gaia.inbox.reopen") : t("gaia.inbox.markDone")}
        onClick={() =>
          void toggle.mutateAsync({ itemId: item.id, done: !done }).catch((err: unknown) =>
            toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
          )
        }
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
          done ? "border-brand-cyan bg-brand-cyan/15 text-brand-cyan-deep dark:text-brand-cyan" : "border-border"
        }`}
      >
        {done ? <Check className="size-3.5" aria-hidden="true" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`whitespace-pre-wrap text-sm ${done ? "line-through" : ""}`}>{item.text}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {gaiaRelativeTime(item.createdAt, tr)}
          {item.noteId ? ` · ${t("gaia.inbox.convertedToNote")}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.noteId ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenNote(item.noteId!)}>
            <StickyNote className="size-3.5" aria-hidden="true" />
            {t("gaia.inbox.openNote")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={convert.isPending}
            onClick={() =>
              void convert.mutateAsync(item.id).then(
                (res) => onOpenNote(res.note.id),
                (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
              )
            }
          >
            <StickyNote className="size-3.5" aria-hidden="true" />
            {t("gaia.inbox.convert")}
          </Button>
        )}
        <button
          type="button"
          aria-label={t("gaia.inbox.delete")}
          onClick={() =>
            void remove.mutateAsync(item.id).catch((err: unknown) =>
              toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
            )
          }
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-loss"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function InboxPanel({ onOpenNote }: { onOpenNote: (id: string) => void }) {
  const t = useTranslations();
  const { toast } = useToast();
  const inboxQuery = useGaiaInbox();
  const createItem = useCreateGaiaInboxItem();
  const [text, setText] = React.useState("");
  const [showDone, setShowDone] = React.useState(false);

  const capture = () => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    void createItem.mutateAsync(trimmed).then(
      () => setText(""),
      (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
    );
  };

  return (
    <div data-testid="gaia-inbox-panel" className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
          {t("gaia.inbox.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("gaia.inbox.hint")}</p>
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                capture();
              }
            }}
            placeholder={t("gaia.inbox.inputPlaceholder")}
            aria-label={t("gaia.inbox.inputLabel")}
            rows={2}
            className="min-h-11 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-brand-cyan"
          />
          <Button
            type="button"
            disabled={text.trim() === "" || createItem.isPending}
            onClick={capture}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("gaia.inbox.capture")}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t("gaia.inbox.shortcutHint")}</p>
      </section>

      {inboxQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (inboxQuery.data?.open.length ?? 0) === 0 &&
        (inboxQuery.data?.done.length ?? 0) === 0 ? (
        <GaiaEmptyState
          icon={<Inbox className="size-8" aria-hidden="true" />}
          title={t("gaia.inbox.emptyTitle")}
          body={t("gaia.inbox.emptyBody")}
          testid="gaia-inbox-empty"
        />
      ) : (
        <>
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">
              {t("gaia.inbox.openTitle")} ({inboxQuery.data?.open.length ?? 0})
            </h3>
            {(inboxQuery.data?.open.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{t("gaia.inbox.openEmpty")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {inboxQuery.data!.open.map((item) => (
                  <InboxRow key={item.id} item={item} onOpenNote={onOpenNote} />
                ))}
              </ul>
            )}
          </section>
          {(inboxQuery.data?.done.length ?? 0) > 0 ? (
            <section className="rounded-xl border bg-card p-4">
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
                className="text-sm font-semibold"
              >
                {t("gaia.inbox.doneTitle")} ({inboxQuery.data!.done.length}){" "}
                {showDone ? "▾" : "▸"}
              </button>
              {showDone ? (
                <ul className="mt-3 space-y-2">
                  {inboxQuery.data!.done.map((item) => (
                    <InboxRow key={item.id} item={item} onOpenNote={onOpenNote} />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
