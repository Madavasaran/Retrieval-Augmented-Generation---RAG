// AI-ASSISTED: Cursor
// PROMPT: Chat input bar with upload, auto-resize textarea, and send button
// ACCEPTED-BY: madavasaran

import { useRef } from 'react';

import type { ChatMode } from '../types';

interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onUpload?: (file: File) => void;
  loading: boolean;
  mode: ChatMode;
  placeholder?: string;
}

export default function InputBar({
  value,
  onChange,
  onSend,
  onUpload,
  loading,
  mode,
  placeholder = 'Send a message…',
}: InputBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!loading && value.trim()) {
        onSend();
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    event.target.value = '';
  };

  return (
    <div className="border-t border-assistant-border bg-chat-bg px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-assistant-border bg-input-bg p-2 shadow-panel">
        {mode === 'rag' && onUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload PDF"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-hover-bg hover:text-text-primary disabled:opacity-40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                />
              </svg>
            </button>
          </>
        )}

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={1}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-text-primary transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          title="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-text-muted">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}
