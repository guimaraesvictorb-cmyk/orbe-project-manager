import { useState } from "react";
import { Send, Trash2, Loader2, MessageSquare } from "lucide-react";
import { useComments } from "../hooks/useComments";
import { timeAgo } from "../lib/formatters";
import type { Profile } from "../lib/database.types";

interface CommentThreadProps {
  entityType: "task" | "client" | "lead";
  entityId: string;
  currentUserId: string;
  profiles: Profile[];
}

function authorName(profiles: Profile[], id: string): string {
  return profiles.find((p) => p.id === id)?.display_name ?? "Alguém";
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function CommentThread({ entityType, entityId, currentUserId, profiles }: CommentThreadProps) {
  const { comments, loading, addComment, deleteComment } = useComments(entityType, entityId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    await addComment(draft.trim(), currentUserId);
    setDraft("");
    setSending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <MessageSquare size={13} style={{ color: "var(--text-tertiary)" }} />
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
          Comentários {comments.length > 0 && `(${comments.length})`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {comments.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Nenhum comentário ainda.</p>
          )}
          {comments.map((c) => {
            const name = authorName(profiles, c.author_id);
            const mine = c.author_id === currentUserId;
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: "var(--accent-a22)", color: "var(--accent)" }}>
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{name}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>{timeAgo(c.created_at)}</p>
                  </div>
                  <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
                </div>
                {mine && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    style={{ color: "var(--text-quaternary)" }}
                    aria-label="Excluir comentário"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva um comentário..."
          className="flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
          style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex-shrink-0 p-2 rounded-lg disabled:opacity-40 transition-all"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </form>
    </div>
  );
}
