// AI-ASSISTED: Cursor
// PROMPT: Collapsible RAG sources panel with score and chunk metadata
// ACCEPTED-BY: madavasaran

import { useState } from 'react';

import type { SourceCitation } from '../types';

interface SourcesPanelProps {
  sources: SourceCitation[];
}

const PREVIEW_LENGTH = 150;

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function sourcePreview(source: SourceCitation): string {
  if (source.text) {
    return source.text;
  }
  const page = source.page != null ? ` · page ${source.page}` : '';
  return `${source.source}${page}`;
}

function SourceItem({ source, index }: { source: SourceCitation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = sourcePreview(source);
  const truncated = preview.length > PREVIEW_LENGTH;
  const displayText =
    expanded || !truncated ? preview : `${preview.slice(0, PREVIEW_LENGTH)}…`;

  return (
    <div className="rounded-lg border border-assistant-border bg-chat-bg/60 p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-text-primary">Source {index + 1}</span>
        <span className="shrink-0 rounded-md bg-accent/20 px-2 py-0.5 text-xs text-accent">
          {formatScore(source.score)}
        </span>
      </div>
      <p className="text-text-muted">{displayText}</p>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-accent transition hover:text-accent-hover"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      <p className="mt-2 truncate font-mono text-xs text-text-muted/70">
        chunk: {source.chunk_id}
      </p>
    </div>
  );
}

export default function SourcesPanel({ sources }: SourcesPanelProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-assistant-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-sm text-text-muted transition hover:text-text-primary"
      >
        <span>Sources ({sources.length})</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {sources.map((source, index) => (
            <SourceItem key={source.chunk_id} source={source} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
