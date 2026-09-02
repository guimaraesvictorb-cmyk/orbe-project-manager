import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { ShareToken } from "../lib/database.types";

export type { ShareToken };

export function useShareTokens(clientId: string) {
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("client_share_tokens")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) console.error("Failed to fetch client_share_tokens:", error.message);
    setTokens(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createToken(label?: string, expiresInDays?: number) {
    const expires_at = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("client_share_tokens").insert({
      client_id: clientId,
      label: label || null,
      expires_at,
      created_by: user.user?.id,
    }).select().single();
    if (error) return { error: error.message };
    setTokens((prev) => [data, ...prev]);
    return { data };
  }

  async function deleteToken(id: string) {
    const { error } = await supabase.from("client_share_tokens").delete().eq("id", id);
    if (error) return { error: error.message };
    setTokens((prev) => prev.filter((t) => t.id !== id));
    return {};
  }

  return { tokens, loading, createToken, deleteToken, refetch: fetch };
}
