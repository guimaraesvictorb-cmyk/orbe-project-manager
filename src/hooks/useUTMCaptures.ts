import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { UTMCapture } from "../lib/database.types";

export type { UTMCapture };

export function useUTMCaptures() {
  const [captures, setCaptures] = useState<UTMCapture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("utm_captures")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(200);
    if (error) console.error("Failed to fetch utm_captures:", error.message);
    setCaptures(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function convertToLead(capture: UTMCapture, stageId: string, createdBy: string) {
    const { data, error } = await supabase.from("leads").insert({
      name: capture.name ?? "Lead sem nome",
      contact_name: capture.name,
      contact_email: capture.email,
      contact_phone: capture.phone,
      stage_id: stageId,
      source: capture.utm_source ?? "organico",
      utm_source: capture.utm_source,
      utm_medium: capture.utm_medium,
      utm_campaign: capture.utm_campaign,
      utm_content: capture.utm_content,
      utm_term: capture.utm_term,
      landing_page: capture.landing_page,
      probability: 10,
      data_source: "utm_capture",
      created_by: createdBy,
    }).select().single();

    if (error) throw error;

    await supabase.from("utm_captures").update({ lead_id: data.id }).eq("id", capture.id);
    await fetch();
    return data;
  }

  async function deleteCapture(id: string) {
    const { error } = await supabase.from("utm_captures").delete().eq("id", id);
    if (error) return { error: error.message };
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    return {};
  }

  return { captures, loading, convertToLead, deleteCapture, refetch: fetch };
}
