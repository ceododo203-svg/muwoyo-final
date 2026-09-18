import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_URL = (Deno.env.get("EVOLUTION_API_URL") || "https://api.muwoyo.com").replace(/\/+$/, "");
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const evoFetch = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY, ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const targetPhone = String(body?.phoneNumber || "").replace(/\D/g, "");
    const kind = String(body?.kind || body?.mediaType || "text");
    const text = typeof body?.messageText === "string" ? body.messageText.trim() : "";

    if (!targetPhone) return json({ error: "missing_fields" }, 400);

    const { data: instanceRow } = await admin.from("instances").select("instance_name,connection_state,status").eq("user_id", userId).maybeSingle();
    const instanceName = instanceRow?.instance_name as string | undefined;
    if (!instanceName || !["open", "connected"].includes(String(instanceRow?.connection_state || instanceRow?.status))) {
      return json({ error: "whatsapp_disconnected" }, 409);
    }
    const { data: contact } = await admin.from("whatsapp_contacts").select("id").eq("user_id", userId).eq("phone_number", targetPhone).maybeSingle();
    if (!contact) return json({ error: "contact_not_owned" }, 403);

    let sent: any = null;
    const payloadBase = { number: targetPhone } as Record<string, any>;

    if (kind === "text") {
      if (!text) return json({ error: "missing_text" }, 400);
      sent = await evoFetch(`/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ ...payloadBase, text }),
      });
    } else {
      const mediaUrl = String(body?.mediaUrl || "");
      const caption = typeof body?.caption === "string" ? body.caption : text;
      const fileName = String(body?.fileName || "media");

      if (kind === "audio") {
        const audioPayload = mediaUrl ? { ...payloadBase, audio: mediaUrl, caption } : { ...payloadBase, audio: body?.audioBase64 || body?.base64 || "", caption };
        sent = await evoFetch(`/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          body: JSON.stringify(audioPayload),
        });
      } else {
        sent = await evoFetch(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          body: JSON.stringify({
            ...payloadBase,
            media: mediaUrl || body?.mediaUrl || "",
            mediatype: kind,
            caption,
            fileName,
            mimetype: String(body?.mimetype || "application/octet-stream"),
            type: kind,
          }),
        });
      }
    }

    if (!sent || !sent.ok) return json({ error: "whatsapp_send_failed", details: sent?.data || null }, 502);

    await admin.from("messages").insert({
      user_id: userId,
      phone_number: targetPhone,
      message_text: (text || (kind !== "text" ? String(body?.caption || "") : "")).slice(0, 4000),
      direction: "outbound",
      kind,
      media_url: body?.mediaUrl || null,
      whatsapp_instance_id: instanceName,
      external_id: sent.data?.key?.id || null,
    });

    return json({ ok: true, data: sent.data });
  } catch (e: any) {
    console.error("inbox-send error", e);
    return json({ error: e?.message || "internal" }, 500);
  }
});
