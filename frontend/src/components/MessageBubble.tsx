// AI-ASSISTED: Cursor
// PROMPT: Chat message bubble with markdown and typing indicator
// ACCEPTED-BY: madavasaran

import ReactMarkdown from 'react-markdown';

import type { Message } from '../types';
import SourcesPanel from './SourcesPanel';

interface MessageBubbleProps {
  message: Message;
  showSources?: boolean;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
      <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
      <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
    </div>
  );
}

export default function MessageBubble({ message, showSources = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  if (message.isStreaming) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-xl border border-assistant-border bg-assistant-bg px-4 py-3 shadow-panel sm:max-w-[75%]">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-accent px-4 py-3 text-text-primary shadow-panel sm:max-w-[75%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const bubbleClass = isError
    ? 'border-red-800 bg-red-950/40 text-red-200'
    : 'border-assistant-border bg-assistant-bg text-text-primary';

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] rounded-xl border px-4 py-3 shadow-panel sm:max-w-[75%] ${bubbleClass}`}
      >
        {isError ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="markdown-body text-[15px] leading-relaxed">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {showSources && message.sources && message.sources.length > 0 && (
          <SourcesPanel sources={message.sources} />
        )}
      </div>
    </div>
  );
}
