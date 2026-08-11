// AI-ASSISTED: Cursor
// PROMPT: Main app with chat state, context, and API wiring
// ACCEPTED-BY: madavasaran

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import ChatWindow from './components/ChatWindow';
import SettingsDrawer from './components/SettingsDrawer';
import Sidebar from './components/Sidebar';
import { useChat } from './hooks/useChat';
import type {
  ChatMode,
  ChatSettings,
  Conversation,
  Message,
  ToastState,
} from './types';
import { DEFAULT_SETTINGS } from './types';

interface ChatContextValue {
  mode: ChatMode;
  settings: ChatSettings;
  loading: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within App');
  }
  return context;
}

function createId(): string {
  return crypto.randomUUID();
}

function conversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 40) {
    return trimmed || 'New chat';
  }
  return `${trimmed.slice(0, 40)}…`;
}

export default function App() {
  const { loading, ingestPdf, queryRag, chatDirect } = useChat();

  const [mode, setMode] = useState<ChatMode>('rag');
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const messages = activeConversation?.messages ?? [];

  const showToast = useCallback((message: string, type: ToastState['type']) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const upsertConversation = useCallback(
    (conversationId: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? updater(conversation) : conversation,
        ),
      );
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    const id = createId();
    const conversation: Conversation = {
      id,
      title: 'New chat',
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(id);
    setInputValue('');
    setSidebarOpen(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  }, []);

  const ensureActiveConversation = useCallback((): string => {
    if (activeConversationId) {
      return activeConversationId;
    }
    const id = createId();
    const conversation: Conversation = {
      id,
      title: 'New chat',
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(id);
    return id;
  }, [activeConversationId]);

  const appendMessage = useCallback(
    (conversationId: string, message: Message) => {
      upsertConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, message],
        updatedAt: Date.now(),
        title:
          conversation.messages.length === 0 && message.role === 'user'
            ? conversationTitle(message.content)
            : conversation.title,
      }));
    },
    [upsertConversation],
  );

  const replaceLastAssistant = useCallback(
    (conversationId: string, message: Message) => {
      upsertConversation(conversationId, (conversation) => {
        const nextMessages = [...conversation.messages];
        const lastIndex = nextMessages.length - 1;
        if (lastIndex >= 0 && nextMessages[lastIndex]?.isStreaming) {
          nextMessages[lastIndex] = message;
        } else {
          nextMessages.push(message);
        }
        return {
          ...conversation,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      });
    },
    [upsertConversation],
  );

  const handleSend = useCallback(async () => {
    const question = inputValue.trim();
    if (!question || loading) {
      return;
    }

    const conversationId = ensureActiveConversation();
    setInputValue('');

    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: question,
    };
    appendMessage(conversationId, userMessage);

    const streamingMessage: Message = {
      id: createId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    appendMessage(conversationId, streamingMessage);

    try {
      if (mode === 'rag') {
        const response = await queryRag(question);
        replaceLastAssistant(conversationId, {
          id: createId(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        });
      } else {
        const response = await chatDirect(question, settings);
        replaceLastAssistant(conversationId, {
          id: createId(),
          role: 'assistant',
          content: response.answer,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      replaceLastAssistant(conversationId, {
        id: createId(),
        role: 'error',
        content: errorMessage,
      });
    }
  }, [
    appendMessage,
    chatDirect,
    ensureActiveConversation,
    inputValue,
    loading,
    mode,
    queryRag,
    replaceLastAssistant,
    settings,
  ]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Only PDF files are supported', 'error');
        return;
      }

      try {
        const response = await ingestPdf(file);
        if (response.skipped) {
          showToast(`Already ingested: ${response.source}`, 'success');
        } else {
          showToast(`${response.chunks_stored} chunks stored from ${response.source}`, 'success');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        showToast(errorMessage, 'error');
      }
    },
    [ingestPdf, showToast],
  );

  const contextValue = useMemo(
    () => ({ mode, settings, loading }),
    [mode, settings, loading],
  );

  return (
    <ChatContext.Provider value={contextValue}>
      <div className="flex h-full min-h-svh bg-chat-bg">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          conversations={conversations}
          activeConversationId={activeConversationId}
          mode={mode}
          onModeChange={setMode}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
        />

        <ChatWindow
          messages={messages}
          mode={mode}
          loading={loading}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onUpload={handleUpload}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onChange={setSettings}
          mode={mode}
        />

        {toast && (
          <div
            className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-panel ${
              toast.type === 'success'
                ? 'border border-green-800 bg-green-950/90 text-green-100'
                : 'border border-red-800 bg-red-950/90 text-red-100'
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ChatContext.Provider>
  );
}
