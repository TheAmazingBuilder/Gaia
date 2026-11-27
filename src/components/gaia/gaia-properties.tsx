"use client";

/**
 * Gaïa — Module 2 (K13): note properties.
 *
 * Custom per-note metadata (key / typed value). Rendered as a collapsible
 * section under the editor title; the editor owns the list (DraftState)
 * and saves it with the normal autosave PATCH.
 */
import * as React from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type GaiaNoteProperty,
  type GaiaNotePropertyType,
  type GaiaT,
} from "./gaia-shared";

const PROPERTY_TYPES: GaiaNotePropertyType[] = ["text", "number", "date", "checkbox", "select"];

function emptyProperty(): GaiaNoteProperty {
  return { key: "", value: "", type: "text" };
}

function PropertyValueInput({
  property,
  onChange,
  t,
}: {
  property: GaiaNoteProperty;
  onChange: (next: GaiaNoteProperty) => void;
  t: GaiaT;
}) {
  if (property.type === "checkbox") {
    return (
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={property.value === "true"}
          onChange={(e) => onChange({ ...property, value: e.target.checked ? "true" : "false" })}
          className="size-4 accent-brand-cyan"
        />
        {property.value === "true" ? t("gaia.properties.yes") : t("gaia.properties.no")}
      </label>
    );
  }
  if (property.type === "select") {
    const options = property.options ?? [];
    return (
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select
          value={options.includes(property.value) ? property.value : ""}
          onValueChange={(v) => onChange({ ...property, value: v })}
        >
          <SelectTrigger className="h-9 min-w-32 flex-1" aria-label={t("gaia.properties.valueLabel")}>
            <SelectValue placeholder={t("gaia.properties.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={options.join(", ")}
          onChange={(e) =>
            onChange({
              ...property,
              options: e.target.value
                .split(",")
                .map((o) => o.trim())
                .filter((o) => o !== ""),
            })
          }
          placeholder={t("gaia.properties.optionsPlaceholder")}
          aria-label={t("gaia.properties.optionsLabel")}
          className="h-9 min-w-40 flex-1"
        />
      </div>
    );
  }
  const inputType =
    property.type === "number" ? "number" : property.type === "date" ? "date" : "text";
  return (
    <Input
      type={inputType}
      value={property.value}
      onChange={(e) => onChange({ ...property, value: e.target.value })}
      placeholder={t("gaia.properties.valuePlaceholder")}
      aria-label={t("gaia.properties.valueLabel")}
      className="h-9 flex-1"
    />
  );
}

export function PropertiesPanel({
  properties,
  onChange,
}: {
  properties: GaiaNoteProperty[];
  onChange: (next: GaiaNoteProperty[]) => void;
}) {
  const t = useTranslations();
  const tr: GaiaT = (key) => t(key);
  const [open, setOpen] = React.useState(properties.length > 0);

  const updateAt = (index: number, next: GaiaNoteProperty) => {
    const list = [...properties];
    list[index] = next;
    onChange(list);
  };
  const removeAt = (index: number) => {
    onChange(properties.filter((_, i) => i !== index));
  };

  return (
    <section data-testid="gaia-properties" className="border-b px-4 py-2 sm:px-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 w-full items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-brand-cyan"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {t("gaia.properties.title")}
        </span>
        <span className="rounded-full border bg-muted px-1.5 font-mono text-[10px]">
          {properties.length}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 pb-2 pt-2">
          {properties.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("gaia.properties.empty")}</p>
          ) : (
            properties.map((property, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  value={property.key}
                  onChange={(e) => updateAt(i, { ...property, key: e.target.value })}
                  placeholder={t("gaia.properties.keyPlaceholder")}
                  aria-label={t("gaia.properties.keyLabel")}
                  className="h-9 w-32"
                />
                <Select
                  value={property.type}
                  onValueChange={(v) =>
                    updateAt(i, {
                      ...property,
                      type: v as GaiaNotePropertyType,
                      value: v === "checkbox" ? "false" : property.value,
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-28" aria-label={t("gaia.properties.typeLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`gaia.properties.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <PropertyValueInput
                  property={property}
                  onChange={(next) => updateAt(i, next)}
                  t={tr}
                />
                <button
                  type="button"
                  aria-label={t("gaia.properties.remove")}
                  onClick={() => removeAt(i)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-loss"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...properties, emptyProperty()])}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("gaia.properties.add")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
