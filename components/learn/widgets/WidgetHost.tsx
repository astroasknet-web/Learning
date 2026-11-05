"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { decodeSpec, validateSpec } from "@/lib/learn/widgets/engine";
import type { WidgetSpec } from "@/lib/learn/widgets/types";
import { ChainLabWidget } from "./ChainLabWidget";
import { CompleteWidget } from "./CompleteWidget";
import { EquationWidget } from "./EquationWidget";
import { ExplorerWidget } from "./ExplorerWidget";
import { FlashcardsWidget } from "./FlashcardsWidget";
import { HashLabWidget } from "./HashLabWidget";
import { JournalWidget } from "./JournalWidget";
import { MerkleWidget } from "./MerkleWidget";
import { ProgressDock } from "./ProgressDock";
import { SqlPlayWidget } from "./SqlPlayWidget";
import { DaxPlayWidget } from "./DaxPlayWidget";
import { VizPlayWidget } from "./VizPlayWidget";
import { QuizWidget } from "./QuizWidget";

interface Mount { el: Element; spec: WidgetSpec }

function render(spec: WidgetSpec, slug: string) {
  switch (spec.type) {
    case "quiz": return <QuizWidget spec={spec} slug={slug} />;
    case "journal": return <JournalWidget spec={spec} slug={slug} />;
    case "equation": return <EquationWidget spec={spec} slug={slug} />;
    case "explorer": return <ExplorerWidget spec={spec} slug={slug} />;
    case "flashcards": return <FlashcardsWidget spec={spec} slug={slug} />;
    case "complete": return <CompleteWidget spec={spec} slug={slug} />;
    case "hashlab": return <HashLabWidget spec={spec} slug={slug} />;
    case "chainlab": return <ChainLabWidget spec={spec} slug={slug} />;
    case "merkle": return <MerkleWidget spec={spec} slug={slug} />;
    case "sqlplay": return <SqlPlayWidget spec={spec} slug={slug} />;
    case "daxplay": return <DaxPlayWidget spec={spec} slug={slug} />;
    case "vizplay": return <VizPlayWidget spec={spec} slug={slug} />;
  }
}

/**
 * Finds every [data-cw-widget] placeholder in the server-rendered lesson HTML, decodes its spec and mounts the matching React widget into it
 * with a portal. A bad spec leaves the static fallback in place, so a content error never breaks the lesson.
 * Pass a `scope` key (e.g. the step) so the scan reruns when the lesson changes.
 */
export function WidgetHost({ slug, scope }: { slug: string; scope?: string }) {
  const [mounts, setMounts] = useState<Mount[]>([]);
  useEffect(() => {
    const found: Mount[] = [];
    document.querySelectorAll("[data-cw-widget]").forEach((el) => {
      try {
        const spec = decodeSpec(el.getAttribute("data-spec") ?? "") as WidgetSpec;
        if (spec && validateSpec(spec).length === 0) {
          el.setAttribute("data-cw-live", "1");
          while (el.firstChild) el.removeChild(el.firstChild); // drop the static fallback only once the live widget can mount
          found.push({ el, spec });
        }
      } catch { /* keep the fallback */ }
    });
    setMounts(found);
  }, [scope]);
  return (
    <>
      {mounts.map((m, i) => createPortal(render(m.spec, slug), m.el, `${m.spec.type}-${i}`))}
      <ProgressDock slug={slug} />
    </>
  );
}
