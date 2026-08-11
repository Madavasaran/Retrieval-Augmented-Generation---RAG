// AI-ASSISTED: Cursor
// PROMPT: Collapsible sidebar with conversations list and mode toggle
// ACCEPTED-BY: madavasaran

import type { ChatMode, Conversation } from '../types';
import ModeToggle from './ModeToggle';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
}

export default function Sidebar({
  open,
  onClose,
  conversations,
  activeConversationId,
  mode,
  onModeChange,
  onNewChat,
  onSelectConversation,
}: SidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-assistant-border bg-sidebar-bg transition-transform duration-300 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-assistant-border px-4 py-4 md:hidden">
          <span className="font-semibold text-text-primary">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted hover:bg-hover-bg"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-assistant-border bg-chat-bg px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg"
          >
            <span className="text-lg leading-none">+</span>
            New Chat
          </button>
        </div>

        <div className="px-3 pb-3">
          <ModeToggle mode={mode} onChange={onModeChange} />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-text-muted">No conversations yet</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => {
                const active = conversation.id === activeConversationId;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? 'bg-accent/20 text-text-primary'
                          : 'text-text-muted hover:bg-hover-bg hover:text-text-primary'
                      }`}
                    >
                      {conversation.title || 'New chat'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
