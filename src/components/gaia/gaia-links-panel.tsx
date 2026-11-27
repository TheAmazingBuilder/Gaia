"use client";

/**
 * Gaïa — Module 2: Links panel (editor side panel).
 *
 * K02 backlinks · K03 unlinked mentions · K04 bi-directional links ·
 * K08 custom relations · K14 smart-link suggestions.
 *
 * The editor mounts this panel in place of the outline; "Link" inserts a
 * ref block at the end of the current note (via onInsertRef, owned by the
 * editor), "Open" navigates to the note.
 */
import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  gaiaErrorMessage,
  useCreateGaiaRelation,
  useDeleteGaiaRelation,
  useGaiaLinkSuggestions,
  useGaiaNoteLinks,
  useGaiaRefs,
  type GaiaT,
} from "./gaia-shared";
import { useToast } from "@/hooks/use-toast";

const RELATION_PRESETS = ["relates to", "contradicts", "inspired by", "parent of", "part of", "follows"];

function RowButton({
  title,
  meta,
  onOpen,
  onLink,
  linkLabel,
}: {
  title: string;
  meta?: React.ReactNode;
  onOpen: () => void;
  onLink?: () => void;
  linkLabel?: string;
}) {
  return (
    <li className="flex items-center gap-1 rounded-md border px-2 py-1.5 hover:bg-muted/50">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-xs font-medium"
      >
        {title}
      </button>
      {meta}
      {onLink ? (
        <button
          type="button"
          onClick={onLink}
          className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-brand-cyan-deep hover:bg-brand-cyan/10 dark:text-brand-cyan"
        >
          {linkLabel ?? "Link"}
        </button>
      ) : null}
    </li>
  );
}

export function LinksPanel({
  noteId,
  onOpenNote,
  onInsertRef,
  onClose,
  t,
}: {
  noteId: string;
  onOpenNote: (id: string) => void;
  onInsertRef: (targetNoteId: string) => void;
  onClose: () => void;
  t: GaiaT;
}) {
  const tr = useTranslations();
  const { toast } = useToast();
  const linksQuery = useGaiaNoteLinks(noteId);
  const suggestionsQuery = useGaiaLinkSuggestions(noteId);
  const createRelation = useCreateGaiaRelation();
  const deleteRelation = useDeleteGaiaRelation();

  const [relationQuery, setRelationQuery] = React.useState("");
  const [relationType, setRelationType] = React.useState("relates to");
  const [relationTarget, setRelationTarget] = React.useState<string | null>(null);
  const refsQuery = useGaiaRefs(relationQuery, "NOTE", relationQuery.trim() !== "");

  const links = linksQuery.data;
  const suggestions = suggestionsQuery.data?.suggestions ?? [];

  const addRelation = () => {
    if (!relationTarget || relationType.trim() === "") return;
    void createRelation
      .mutateAsync({ noteId, toNoteId: relationTarget, type: relationType.trim() })
      .then(
        () => {
          setRelationQuery("");
          setRelationTarget(null);
        },
        (err: unknown) => toast({ variant: "destructive", title: gaiaErrorMessage(err) }),
      );
  };

  return (
    <aside
      data-testid="gaia-links-panel"
      className="w-72 shrink-0 rounded-xl border bg-card p-3 sm:w-80"
    >
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-semibold">{t("gaia.links.title")}</h2>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {linksQuery.isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : linksQuery.isError ? (
        <p className="mt-3 text-xs text-loss">{gaiaErrorMessage(linksQuery.error)}</p>
      ) : links ? (
        <div className="mt-3 space-y-4">
          {/* ── Backlinks (K02) ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              {t("gaia.links.backlinks")} ({links.backlinks.length})
            </h3>
            {links.backlinks.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("gaia.links.backlinksEmpty")}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {links.backlinks.map((note) => (
                  <RowButton
                    key={note.id}
                    title={note.title === "" ? t("gaia.shared.untitledNote") : note.title}
                    meta={
                      <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    }
                    onOpen={() => onOpenNote(note.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ── Outgoing (K04) ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              {t("gaia.links.outgoing")} ({links.outgoing.length})
            </h3>
            {links.outgoing.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("gaia.links.outgoingEmpty")}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {links.outgoing.map((item) => (
                  <RowButton
                    key={item.id}
                    title={item.title}
                    meta={
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                        {item.via === "relation" ? (
                          <span className="rounded-full border border-brand-coral/30 bg-brand-coral/10 px-1.5 text-brand-coral-deep dark:text-brand-coral">
                            {item.relationType}
                          </span>
                        ) : (
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        )}
                      </span>
                    }
                    onOpen={() => onOpenNote(item.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ── Unlinked mentions (K03) ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              {t("gaia.links.mentions")} ({links.unlinkedMentions.length})
            </h3>
            {links.unlinkedMentions.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("gaia.links.mentionsEmpty")}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {links.unlinkedMentions.map((m) => (
                  <RowButton
                    key={m.id}
                    title={m.title}
                    meta={
                      <span className="max-w-32 shrink-0 truncate text-[10px] text-muted-foreground">
                        {m.snippet}
                      </span>
                    }
                    onOpen={() => onOpenNote(m.id)}
                    onLink={() => onInsertRef(m.id)}
                    linkLabel={t("gaia.links.link")}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ── Custom relations (K08) ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              {t("gaia.links.relations")} ({links.relations.length})
            </h3>
            {links.relations.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {links.relations.map((rel) => (
                  <li
                    key={rel.id}
                    className="flex items-center gap-1 rounded-md border px-2 py-1.5"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {rel.direction === "outgoing" ? "→" : "←"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenNote(rel.otherNoteId)}
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                    >
                      {rel.otherTitle}
                    </button>
                    <span className="shrink-0 rounded-full border border-brand-coral/30 bg-brand-coral/10 px-1.5 text-[10px] text-brand-coral-deep dark:text-brand-coral">
                      {rel.type}
                    </span>
                    <button
                      type="button"
                      aria-label={t("gaia.links.removeRelation")}
                      onClick={() => void deleteRelation.mutateAsync({ noteId, relationId: rel.id })}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-loss"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 space-y-2">
              <div className="relative">
                <Input
                  value={relationQuery}
                  onChange={(e) => {
                    setRelationQuery(e.target.value);
                    setRelationTarget(null);
                  }}
                  placeholder={t("gaia.links.relationSearchPlaceholder")}
                  aria-label={t("gaia.links.relationSearchLabel")}
                  className="h-9"
                />
                {relationQuery.trim() !== "" && (refsQuery.data?.refs ?? []).length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {refsQuery.data!.refs.slice(0, 6).map((ref) => (
                      <li key={ref.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setRelationTarget(ref.id);
                            setRelationQuery(ref.label);
                          }}
                          className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted ${
                            relationTarget === ref.id ? "bg-muted font-semibold" : ""
                          }`}
                        >
                          {ref.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Input
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  placeholder={t("gaia.links.relationTypePlaceholder")}
                  aria-label={t("gaia.links.relationTypeLabel")}
                  list="gaia-relation-presets"
                  className="h-9 flex-1"
                />
                <datalist id="gaia-relation-presets">
                  {RELATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset} />
                  ))}
                </datalist>
                <Button
                  type="button"
                  size="sm"
                  disabled={!relationTarget || relationType.trim() === "" || createRelation.isPending}
                  onClick={addRelation}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t("gaia.links.addRelation")}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Smart-link suggestions (K14) ── */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="size-3.5 text-brand-cyan-deep dark:text-brand-cyan" aria-hidden="true" />
              {t("gaia.links.suggestions")} ({suggestions.length})
            </h3>
            {suggestionsQuery.isLoading ? (
              <Skeleton className="mt-1.5 h-8 w-full" />
            ) : suggestions.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("gaia.links.suggestionsEmpty")}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {suggestions.map((s) => (
                  <RowButton
                    key={s.id}
                    title={s.title}
                    meta={
                      <span className="max-w-28 shrink-0 truncate text-[10px] text-muted-foreground">
                        {s.sharedWords.join(", ")}
                      </span>
                    }
                    onOpen={() => onOpenNote(s.id)}
                    onLink={() => onInsertRef(s.id)}
                    linkLabel={t("gaia.links.link")}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
}
