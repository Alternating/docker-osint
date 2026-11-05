"use client";

import { useState } from "react";
import { SUPPORT_CHAPTERS, type SupportBlock } from "./supportContent";

export default function Support() {
  const [activeId, setActiveId] = useState(SUPPORT_CHAPTERS[0].id);
  const active =
    SUPPORT_CHAPTERS.find((c) => c.id === activeId) ?? SUPPORT_CHAPTERS[0];

  const renderBlock = (block: SupportBlock, i: number) => {
    switch (block.type) {
      case "p":
        return (
          <p key={i} className="text-mist-400 text-sm leading-relaxed">
            {block.text}
          </p>
        );
      case "list":
        return (
          <ul
            key={i}
            className="list-disc list-inside space-y-1 text-mist-400 text-sm"
          >
            {block.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        );
      case "steps":
        return (
          <ol
            key={i}
            className="list-decimal list-inside space-y-1 text-mist-400 text-sm"
          >
            {block.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ol>
        );
      case "example":
        return (
          <div key={i} className="rounded-lg border border-abyss-600 p-3">
            <p className="text-sigil-400 text-sm font-medium">{block.input}</p>
            <p className="text-mist-400 text-sm mt-1">{block.result}</p>
          </div>
        );
      case "note":
        return (
          <div
            key={i}
            className="rounded-lg border border-sigil-500/40 bg-sigil-600/10 p-3 text-mist-100 text-sm"
          >
            {block.text}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl text-mist-100">Support &amp; guide</h2>
        <p className="text-mist-400 text-sm mt-1">
          Everything you need to run Suron, chapter by chapter.
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0 flex flex-row md:flex-col flex-wrap gap-1">
          {SUPPORT_CHAPTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`text-left text-sm rounded-lg px-3 py-2 border transition cursor-pointer ${
                activeId === c.id
                  ? "border-sigil-500 text-sigil-400 bg-sigil-600/10"
                  : "border-transparent text-mist-400 hover:text-mist-100"
              }`}
            >
              {c.title}
            </button>
          ))}
        </nav>
        <div className="card p-6 flex-1 space-y-4">
          <h3 className="text-lg text-mist-100">{active.title}</h3>
          {active.blocks.map((b, i) => renderBlock(b, i))}
        </div>
      </div>
    </div>
  );
}
