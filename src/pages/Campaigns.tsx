import { FormEvent, useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
type Campaign = { id: string; name: string; description: string | null; message_text: string; status: string; scheduled_at: string | null };

export default function Campaigns() {
  const { user } = useAuth();
  const { entitlements, planName, loading } = usePlanEntitlements();
  const [items, setItems] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ name: "", description: "", message_text: "", scheduled_at: "" });
  const [sending, setSending] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await db.from("campaigns").select("id,name,description,message_text,status,scheduled_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { void load(); }, [user]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const { data: campaign, error } = await db.from("campaigns").insert({ ...form, user_id: user.id, status: form.scheduled_at ? "scheduled" : "draft", scheduled_at: form.scheduled_at || null }).select().single();
    if (error) return;
    const { data: contacts } = await db.from("whatsapp_contacts").select("id").eq("user_id", user.id).eq("should_respond", true);
    if (campaign && contacts?.length) await db.from("campaign_contacts").insert(contacts.map((contact: { id: string }) => ({ campaign_id: campaign.id, contact_id: contact.id, user_id: user.id })));
    setForm({ name: "", description: "", message_text: "", scheduled_at: "" });
    load();
  };

  const send = async (campaignId: string) => {
    setSending(campaignId);
    const { error } = await supabase.functions.invoke("evolution-api", { body: { action: "sendCampaign", campaignId } });
    setSending("");
    if (!error) load();
  };

  if (loading) return <DashboardShell title="Campanhas" description="A carregar acesso do plano...">A carregar...</DashboardShell>;
  if (!entitlements.campaigns) return <DashboardShell title="Campanhas" description="Comunicação segmentada do seu negócio."><Card><CardContent className="space-y-3 p-6"><CardTitle>Campanhas</CardTitle><p className="text-sm text-muted-foreground">Esta funcionalidade está disponível a partir do plano Growth. Plano atual: {planName}.</p><Button onClick={() => window.location.assign("/recargas")}>Fazer upgrade</Button></CardContent></Card></DashboardShell>;
  return <DashboardShell title="Campanhas" description="Crie, envie e acompanhe comunicações para os seus contactos.">
    <Card><CardHeader><CardTitle>Nova campanha</CardTitle></CardHeader><CardContent><form onSubmit={create} className="grid gap-3 md:grid-cols-2"><Input required placeholder="Nome da campanha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="Data/hora (opcional)" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /><Input placeholder="Descrição opcional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Textarea required className="md:col-span-2" placeholder="Mensagem da campanha" value={form.message_text} onChange={(e) => setForm({ ...form, message_text: e.target.value })} /><Button className="w-fit">Guardar campanha</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent className="space-y-2">{items.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{item.name}</div><div className="text-sm text-muted-foreground">{item.status} · {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("pt-AO") : "Sem agendamento"}</div></div><Button disabled={Boolean(sending)} onClick={() => void send(item.id)}>{sending === item.id ? "A enviar..." : "Enviar agora"}</Button></div>)}</CardContent></Card>
  </DashboardShell>;
}
