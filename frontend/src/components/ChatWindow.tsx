// AI-ASSISTED: Cursor
// PROMPT: Main chat panel with message thread and top bar
// ACCEPTED-BY: madavasaran

import { useEffect, useRef } from 'react';

import type { ChatMode, Message } from '../types';
import InputBar from './InputBar';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  mode: ChatMode;
  loading: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUpload?: (file: File) => void;
  onOpenSettings: () => void;
  onOpenSidebar: () => void;
}

export default function ChatWindow({
  messages,
  mode,
  loading,
  inputValue,
  onInputChange,
  onSend,
  onUpload,
  onOpenSettings,
  onOpenSidebar,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-chat-bg">
      <header className="flex items-center justify-between border-b border-assistant-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg p-2 text-text-muted transition hover:bg-hover-bg hover:text-text-primary md:hidden"
            aria-label="Open menu"
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
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-text-primary">RAG AI Chatbot</h1>
            <p className="text-xs text-text-muted">
              {mode === 'rag' ? 'RAG Mode · PDF retrieval' : 'Chat Mode · Direct LLM'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg p-2 text-text-muted transition hover:bg-hover-bg hover:text-text-primary"
          title="Settings"
          aria-label="Open settings"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-2xl">
                💬
              </div>
              <h2 className="mb-2 text-xl font-semibold text-text-primary">
                {mode === 'rag' ? 'Ask about your documents' : 'Start a conversation'}
              </h2>
              <p className="max-w-md text-sm text-text-muted">
                {mode === 'rag'
                  ? 'Upload a PDF with the paperclip, then ask questions grounded in your documents.'
                  : 'Chat directly with the model using your configured settings.'}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              showSources={mode === 'rag'}
            />
          ))}

          {loading && !messages.some((message) => message.isStreaming) && (
            <MessageBubble
              message={{
                id: 'typing',
                role: 'assistant',
                content: '',
                isStreaming: true,
              }}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <InputBar
        value={inputValue}
        onChange={onInputChange}
        onSend={onSend}
        onUpload={mode === 'rag' ? onUpload : undefined}
        loading={loading}
        mode={mode}
      />
    </div>
  );
}
