import { useState, useRef } from "react";
import { Send, Trash2, Pencil, Check, X, Loader2, MessageSquare } from "lucide-react";
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

// Enter sends; Ctrl/Cmd+Enter inserts a line break instead. Tab inserts a
// literal tab in the text rather than jumping focus to the next control —
// a deliberate exception to normal tab-navigation, scoped to this textarea.
function handleComposerKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  setValue: (v: string) => void,
  onSubmit: () => void
) {
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + "\t" + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 1;
    });
  }
}

export function CommentThread({ entityType, entityId, currentUserId, profiles }: CommentThreadProps) {
  const { comments, loading, addComment, deleteComment, updateComment } = useComments(entityType, entityId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  async function submitComment() {
    if (!draft.trim() || sending) return;
    setSending(true);
    await addComment(draft.trim(), currentUserId);
    setDraft("");
    setSending(false);
    composerRef.current?.focus();
  }

  function startEdit(id: string, content: string) {
    setEditingId(id);
    setEditDraft(content);
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim()) return;
    setSavingEdit(true);
    await updateComment(id, editDraft.trim());
    setSavingEdit(false);
    setEditingId(null);
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
            const isEditing = editingId === c.id;
            const edited = c.updated_at && c.updated_at !== c.created_at;
            return (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: "var(--accent-a22)", color: "var(--accent)" }}>
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{name}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                      {timeAgo(c.created_at)}{edited ? " · editado" : ""}
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="mt-1 space-y-1.5">
                      <textarea
                        autoFocus
                        rows={2}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => handleComposerKeyDown(e, editDraft, setEditDraft, () => saveEdit(c.id))}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none transition-colors resize-none"
                        style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--accent-a44)" }}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => saveEdit(c.id)}
                          disabled={savingEdit || !editDraft.trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold disabled:opacity-50"
                          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
                        >
                          {savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <X size={10} />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
                  )}
                </div>
                {mine && !isEditing && (
                  <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(c.id, c.content)}
                      className="p-1"
                      style={{ color: "var(--text-quaternary)" }}
                      aria-label="Editar comentário"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="p-1"
                      style={{ color: "var(--text-quaternary)" }}
                      aria-label="Excluir comentário"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={composerRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => handleComposerKeyDown(e, draft, setDraft, submitComment)}
          placeholder="Escreva um comentário... (Enter envia, Ctrl+Enter quebra linha)"
          className="flex-1 rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors resize-none"
          style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
        />
        <button
          type="button"
          onClick={submitComment}
          disabled={!draft.trim() || sending}
          className="flex-shrink-0 p-2 rounded-lg disabled:opacity-40 transition-all"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
