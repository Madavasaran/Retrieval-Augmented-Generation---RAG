// AI-ASSISTED: Cursor
// PROMPT: API hook for RAG query, direct chat, and PDF ingest calls
// ACCEPTED-BY: madavasaran

import { useCallback, useState } from 'react';

import type {
  ChatRequestBody,
  ChatResponseBody,
  ChatSettings,
  IngestResponse,
  QueryResponse,
} from '../types';

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map((item) => item.msg ?? 'Validation error').join(', ');
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`;
}

export function useChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingestPdf = useCallback(async (file: File): Promise<IngestResponse> => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return (await response.json()) as IngestResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const queryRag = useCallback(async (question: string): Promise<QueryResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return (await response.json()) as QueryResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const chatDirect = useCallback(
    async (question: string, settings: ChatSettings): Promise<ChatResponseBody> => {
      setLoading(true);
      setError(null);
      try {
        const body: ChatRequestBody = {
          question,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          model: settings.model,
        };

        if (settings.systemPrompt.trim()) {
          body.system_prompt = settings.systemPrompt.trim();
        }

        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        return (await response.json()) as ChatResponseBody;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Chat failed';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    ingestPdf,
    queryRag,
    chatDirect,
    clearError,
  };
}
