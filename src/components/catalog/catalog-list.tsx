"use client";

import { BookOpen, Download, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BallGlyph } from "@/components/stock/ball-glyph";
import { buttonClass, inputClass } from "@/components/ui/field";
import { price } from "@/lib/format";
import type { BallModel } from "@/lib/types";

export function CatalogList({
  models,
  owner,
}: {
  models: BallModel[];
  owner: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const filtered = models
    .filter((model) =>
      [model.name, model.brand, model.upc, model.product_code].some((value) =>
        value?.toLocaleLowerCase().includes(needle),
      ),
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        b.nominal_weight_lb - a.nominal_weight_lb,
    );
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Catalog</h1>
          <p className="mt-2 text-muted-foreground">
            Every model and weight, including those with no stock.
          </p>
        </div>
        {owner && (
          <Link href="/catalog/new" className={buttonClass.action}>
            <Plus className="size-5" aria-hidden />
            Add model
          </Link>
        )}
      </div>
      {owner && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/catalog/import" className={buttonClass.quiet}>
            <Upload className="size-4" aria-hidden />
            Import catalog or stock
          </Link>
          <a
            download
            href="/catalog/download?format=csv"
            className={`${buttonClass.link} min-h-11 gap-2 px-3`}
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
          <a
            download
            href="/catalog/download?format=xlsx"
            className={`${buttonClass.link} min-h-11 gap-2 px-3`}
          >
            <Download className="size-4" aria-hidden />
            Export Excel
          </a>
        </div>
      )}
      <div className="relative mt-6">
        <Search
          className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted-foreground"
          aria-hidden
        />
        <input
          aria-label="Search catalog"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search model, brand, UPC, or product code"
          className={`${inputClass} pl-11`}
          type="search"
        />
      </div>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {filtered.length}{" "}
        {filtered.length === 1 ? "catalog entry" : "catalog entries"}
        {needle ? ` matching “${query}”` : ""}
      </p>
      {filtered.length ? (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-(--shadow-card)">
          {filtered.map((model) => (
            <li key={model.id}>
              <Link
                href={`/catalog/${model.id}`}
                className="flex min-h-24 items-center gap-3 p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <BallGlyph color={model.color} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading font-semibold break-words">
                    {model.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground break-words">
                    {model.brand || "No brand"} ·{" "}
                    <span className="tabular">
                      {model.nominal_weight_lb} lb
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {model.upc}
                  </p>
                </div>
                <span
                  className={`tabular shrink-0 text-right text-sm ${model.selling_price === null ? "text-muted-foreground" : "font-medium"}`}
                >
                  {price(model.selling_price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 py-12 text-center">
          <BookOpen
            className="mx-auto size-9 text-muted-foreground"
            aria-hidden
          />
          <h2 className="mt-4 text-lg font-semibold">
            {needle ? "No matching models" : "Your catalog starts here"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {needle
              ? "Try a model name or UPC."
              : owner
                ? "Add a model or import your existing catalog."
                : "The owner can add models to the catalog."}
          </p>
        </div>
      )}
    </div>
  );
}
