import { Trash2, X } from 'lucide-react';
import type { ChatMessage } from '../types/nexus';

interface HistoryDrawerProps {
  open: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onClear: () => void;
  onSelectPrompt: (text: string) => void;
}

const REGION_LABEL: Record<string, string> = {
  prefrontal: 'Prefrontal',
  temporal: 'Temporal',
  parietal: 'Parietal',
  occipital: 'Occipital',
  cerebellum: 'Cerebellum',
};

export function HistoryDrawer({
  open,
  messages,
  onClose,
  onClear,
  onSelectPrompt,
}: HistoryDrawerProps) {
  if (!open) return null;

  return (
    <aside
      aria-label="Conversation history"
      className="fixed top-16 right-4 bottom-24 z-30 w-[min(400px,calc(100vw-2rem))] flex flex-col rounded-xl bg-[#070a13]/95 border border-white/10 shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="font-[var(--font-display)] text-sm font-semibold tracking-wide text-slate-100">
            Conversation Memory
          </h2>
          <p className="text-xs text-slate-400 tabular-nums">
            {messages.length} {messages.length === 1 ? 'exchange' : 'exchanges'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close conversation history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto nexus-scroll p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-slate-400">
              No neural dialogue recorded yet.
            </p>
            <div className="space-y-2 pt-2">
              {[
                'Awaken',
                'Explain how your neural pathways work',
                'Switch to consciousness mode',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => onSelectPrompt(sample)}
                  className="block w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 bg-white/[0.03] hover:bg-emerald-400/10 hover:text-emerald-200 border border-white/8 transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 border ${
                msg.role === 'user'
                  ? 'bg-violet-500/10 border-violet-400/20 ml-6'
                  : msg.isError
                    ? 'bg-rose-500/10 border-rose-400/25 mr-4'
                    : 'bg-white/[0.04] border-white/10 mr-4'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1.5">
                <span className="font-medium text-slate-300">
                  {msg.role === 'user'
                    ? 'You'
                    : msg.role === 'system'
                      ? 'System'
                      : 'NEXUS'}
                </span>
                <span className="font-mono tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap">
                {msg.text}
              </p>
              {msg.regions && msg.regions.length > 0 && (
                <p className="mt-2 text-[11px] text-emerald-300/80">
                  Active lobes:{' '}
                  {msg.regions.map((r) => REGION_LABEL[r] ?? r).join(' · ')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
