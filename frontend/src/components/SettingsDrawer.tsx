// AI-ASSISTED: Cursor
// PROMPT: Settings drawer for temperature, tokens, model, and system prompt
// ACCEPTED-BY: madavasaran

import type { ChatMode, ChatSettings } from '../types';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onChange: (settings: ChatSettings) => void;
  mode: ChatMode;
}

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onChange,
  mode,
}: SettingsDrawerProps) {
  const ragPlaceholder = 'Default: answer only from context';
  const chatPlaceholder = 'Default: helpful assistant';

  const update = <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close settings"
          className="fixed inset-0 z-40 bg-black/50 transition"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-assistant-border bg-sidebar-bg shadow-panel transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-assistant-border px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition hover:bg-hover-bg hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <label className="mb-2 flex items-center justify-between text-sm text-text-primary">
              <span>Temperature</span>
              <span className="font-mono text-accent">{settings.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(event) => update('temperature', Number(event.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-text-primary" htmlFor="max-tokens">
              Max tokens
            </label>
            <input
              id="max-tokens"
              type="number"
              min={50}
              max={2000}
              value={settings.maxTokens}
              onChange={(event) => update('maxTokens', Number(event.target.value))}
              className="w-full rounded-lg border border-assistant-border bg-input-bg px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-text-primary" htmlFor="model">
              Model
            </label>
            <select
              id="model"
              value={settings.model}
              onChange={(event) =>
                update('model', event.target.value as ChatSettings['model'])
              }
              className="w-full rounded-lg border border-assistant-border bg-input-bg px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-text-primary" htmlFor="system-prompt">
              System prompt override
            </label>
            <textarea
              id="system-prompt"
              value={settings.systemPrompt}
              onChange={(event) => update('systemPrompt', event.target.value)}
              placeholder={mode === 'rag' ? ragPlaceholder : chatPlaceholder}
              rows={4}
              className="w-full rounded-lg border border-assistant-border bg-input-bg px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {mode === 'rag' && (
            <div>
              <label className="mb-2 block text-sm text-text-primary" htmlFor="top-k">
                Top-k (retrieval)
              </label>
              <input
                id="top-k"
                type="number"
                min={1}
                max={10}
                value={settings.topK}
                onChange={(event) => update('topK', Number(event.target.value))}
                className="w-full rounded-lg border border-assistant-border bg-input-bg px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">
                Stored for this session. Backend retrieval currently uses server default (5).
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
