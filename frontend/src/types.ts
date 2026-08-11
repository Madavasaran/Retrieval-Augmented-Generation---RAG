// AI-ASSISTED: Cursor
// PROMPT: Shared TypeScript interfaces for chat UI and API types
// ACCEPTED-BY: madavasaran

export type ChatMode = 'rag' | 'chat';

export type ChatModel = 'gpt-4o-mini' | 'gpt-4o';

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
  model: ChatModel;
  systemPrompt: string;
  topK: number;
}

export interface SourceCitation {
  source: string;
  page?: number | null;
  chunk_id: string;
  score: number;
  text?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  sources?: SourceCitation[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface IngestResponse {
  chunks_stored: number;
  source: string;
  skipped?: boolean;
  file_hash?: string;
}

export interface QueryResponse {
  answer: string;
  sources: SourceCitation[];
}

export interface ChatRequestBody {
  question: string;
  temperature: number;
  max_tokens: number;
  model: string;
  system_prompt?: string;
}

export interface ChatResponseBody {
  answer: string;
}

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export const DEFAULT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  maxTokens: 500,
  model: 'gpt-4o-mini',
  systemPrompt: '',
  topK: 5,
};
