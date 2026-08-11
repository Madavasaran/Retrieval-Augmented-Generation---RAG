// AI-ASSISTED: Cursor
// PROMPT: RAG vs Chat mode toggle for sidebar
// ACCEPTED-BY: madavasaran

import type { ChatMode } from '../types';

interface ModeToggleProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="rounded-xl border border-assistant-border bg-chat-bg p-1">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onChange('rag')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'rag'
              ? 'bg-accent text-text-primary shadow-sm'
              : 'text-text-muted hover:bg-hover-bg hover:text-text-primary'
          }`}
        >
          RAG Mode
        </button>
        <button
          type="button"
          onClick={() => onChange('chat')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            mode === 'chat'
              ? 'bg-accent text-text-primary shadow-sm'
              : 'text-text-muted hover:bg-hover-bg hover:text-text-primary'
          }`}
        >
          Chat Mode
        </button>
      </div>
    </div>
  );
}
