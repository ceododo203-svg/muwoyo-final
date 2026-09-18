import { useEffect, useMemo, useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Paperclip, Image as ImageIcon, Send, CheckCheck, Mic, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DateTimeSelect from "@/components/DateTimeSelect";

const db = supabase as any;
type Conversation = { id: string; contact_id: string; status: string; assigned_to: string | null; unread_count: number; last_message_at: string | null; contact?: { name: string | null; phone_number: string } };
type Message = { id: string; direction: string; message_text: string | null; ai_responded: boolean; created_at: string; kind?: string; media_url?: string | null };

export default function Inbox() {
  const { user } = useAuth();
  const { entitlements, planName, loading } = usePlanEntitlements();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [showCustomer, setShowCustomer] = useState(true);
  const [quickAction, setQuickAction] = useState<"order" | "appointment" | null>(null);
  const [quickForm, setQuickForm] = useState({ service: "", item: "", scheduled_at: "", notes: "" });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: rows }, { data: contacts }] = await Promise.all([
      db.from("inbox_conversations").select("id,contact_id,status,assigned_to,unread_count,last_message_at").eq("user_id", user.id).order("last_message_at", { ascending: false, nullsFirst: false }),
      db.from("whatsapp_contacts").select("id,name,phone_number").eq("user_id", user.id),
    ]);
    const contactMap = new Map((contacts || []).map((contact: { id: string; name: string | null; phone_number: string }) => [contact.id, contact]));
    setConversations((rows || []).map((row: Conversation) => ({ ...row, contact: contactMap.get(row.contact_id) })));
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase.channel(`inbox-${user.id}`, { config: { presence: { key: user.id } } }).on("postgres_changes", { event: "*", schema: "public", table: "inbox_conversations", filter: `user_id=eq.${user.id}` }, () => void load()).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` }, () => { if (selected) void loadMessages(selected); }).on("presence", { event: "sync" }, () => { const states = channel.presenceState(); setTyping(Object.values(states).some((entries: any) => entries.some((entry: any) => entry.typing && entry.user_id !== user.id)); }).subscribe(async (status) => { if (status === "SUBSCRIBED") await channel.track({ user_id: user.id, typing: false }); });
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const loadMessages = async (conversation: Conversation) => {
    if (!user) return;
    const { data } = await db.from("messages").select("id,direction,message_text,ai_responded,created_at,kind,media_url").eq("user_id", user.id).eq("phone_number", conversation.contact?.phone_number || "").order("created_at", { ascending: false }).limit(100);
    setMessages((data || []).reverse());
    await db.from("inbox_conversations").update({ unread_count: 0 }).eq("id", conversation.id).eq("user_id", user.id);
    setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unread_count: 0 } : item));
  };

  const selectConversation = (conversation: Conversation) => { setSelected(conversation); void loadMessages(conversation); };
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const toggleRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      setMediaFile(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
      setRecording(false);
      recorderRef.current = null;
    };
    mediaStreamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };
  const visible = useMemo(() => conversations.filter((conversation) => {
    const term = search.toLowerCase();
    const matchesSearch = `${conversation.contact?.name || ""} ${conversation.contact?.phone_number || ""}`.toLowerCase().includes(term);
    const matchesFilter = filter === "unread" ? conversation.unread_count > 0 : filter === "mine" ? conversation.assigned_to === user?.id : filter === "unassigned" ? !conversation.assigned_to : filter === "ai" ? conversation.status !== "human" : filter === "human" ? conversation.status === "human" : filter === "resolved" ? conversation.status === "closed" : true;
    return matchesSearch && matchesFilter;
  }), [conversations, filter, search, user]);

  const assignToMe = async () => {
    if (!selected || !user) return;
    const { error } = await db.from("inbox_conversations").update({ assigned_to: user.id, status: "human" }).eq("id", selected.id).eq("user_id", user.id);
    if (error) return toast({ title: "Não foi possível atribuir a conversa", description: error.message, variant: "destructive" });
    setSelected({ ...selected, assigned_to: user.id, status: "human" });
    await load();
  };

  const toggleAi = async () => {
    if (!selected || !user) return;
    const nextStatus = selected.status === "human" ? "open" : "human";
    const { error } = await db.from("inbox_conversations").update({ status: nextStatus, assigned_to: nextStatus === "open" ? null : user.id }).eq("id", selected.id).eq("user_id", user.id);
    if (error) return toast({ title: "Não foi possível alterar o atendimento", description: error.message, variant: "destructive" });
    setSelected({ ...selected, status: nextStatus, assigned_to: nextStatus === "open" ? null : user.id });
    await load();
  };

  const resolveConversation = async () => {
    if (!selected || !user) return;
    await db.from("inbox_conversations").update({ status: "closed" }).eq("id", selected.id).eq("user_id", user.id);
    setSelected({ ...selected, status: "closed" });
    await load();
  };

  const createQuickAction = async () => {
    if (!selected?.contact || !user || !quickAction) return;
    if (quickAction === "appointment" && !quickForm.scheduled_at) return;
    const result = quickAction === "appointment"
      ? await db.from("appointments").insert({ user_id: user.id, customer_name: selected.contact.name, customer_phone: selected.contact.phone_number, service: quickForm.service || "Atendimento", description: quickForm.notes || null, scheduled_at: new Date(quickForm.scheduled_at).toISOString(), status: "confirmed" })
      : await db.from("store_orders").insert({ user_id: user.id, customer_name: selected.contact.name, customer_phone: selected.contact.phone_number, items: [{ name: quickForm.item || "Pedido criado no Inbox", qty: 1 }], notes: quickForm.notes || null, status: "new" });
    if (result.error) return toast({ title: "Não foi possível criar", description: result.error.message, variant: "destructive" });
    setQuickAction(null);
    setQuickForm({ service: "", item: "", scheduled_at: "", notes: "" });
    toast({ title: quickAction === "appointment" ? "Agendamento criado" : "Pedido criado" });
  };

  const publishTyping = async (value: string) => {
    setText(value);
    const channel = supabase.getChannels().find((item) => item.topic === `realtime:inbox-${user?.id}`);
    if (channel && user) await channel.track({ user_id: user.id, typing: Boolean(value.trim()) });
  };

  const send = async () => {
    if (!selected || !user || (!text.trim() && !mediaFile)) return;
    setSending(true);
    const { data: instance } = await db.from("instances").select("instance_name").eq("user_id", user.id).maybeSingle();
    if (!instance?.instance_name) { setSending(false); return toast({ title: "WhatsApp não conectado", description: "Conecte o WhatsApp antes de enviar mensagens.", variant: "destructive" }); }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setSending(false); return toast({ title: "Sessão expirada", description: "Faça login novamente para enviar mensagens.", variant: "destructive" }); }
    let mediaUrl = "";
    if (mediaFile) {
      const path = `${user.id}/${Date.now()}-${mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await supabase.storage.from("store-assets").upload(path, mediaFile, { upsert: false, contentType: mediaFile.type });
      if (upload.error) { setSending(false); return toast({ title: "Não foi possível carregar o ficheiro", description: upload.error.message, variant: "destructive" }); }
      mediaUrl = supabase.storage.from("store-assets").getPublicUrl(path).data.publicUrl;
    }
    const kind = mediaFile ? (mediaFile.type.startsWith("image/") ? "image" : mediaFile.type.startsWith("video/") ? "video" : mediaFile.type.startsWith("audio/") ? "audio" : "document") : "text";
    const { error } = await supabase.functions.invoke("inbox-send", { body: { instanceName: instance.instance_name, phoneNumber: selected.contact?.phone_number, messageText: text.trim(), caption: mediaCaption || text.trim(), kind, mediaUrl, fileName: mediaFile?.name, mimetype: mediaFile?.type }, headers: { Authorization: `Bearer ${accessToken}` } });
    setSending(false);
    if (error) return toast({ title: "Não foi possível enviar", description: error.message, variant: "destructive" });
    setText("");
    setMediaCaption("");
    setMediaFile(null);
    await loadMessages(selected);
  };

  if (loading) return <DashboardShell title="Inbox" description="A carregar acesso...">A carregar...</DashboardShell>;
  if (!entitlements.inbox) return <DashboardShell title="Inbox" description="Centro de conversas do negócio."><Card><CardContent className="p-6">A Inbox não está disponível no plano atual: {planName}.</CardContent></Card></DashboardShell>;

  return <DashboardShell wide title={entitlements.sharedInbox ? "Shared Inbox" : "Inbox"} description="Converse com clientes e acompanhe o contexto do CRM.">
    <div data-inbox data-has-selection={selected ? "true" : "false"} className="grid h-[calc(100vh-10.5rem)] min-h-[560px] gap-3 overflow-hidden lg:grid-cols-[minmax(250px,36%)_minmax(0,64%)]">
      <Card className="min-h-0 min-w-0 overflow-hidden"><CardHeader className="shrink-0"><CardTitle className="text-base">Conversas</CardTitle><Input placeholder="Pesquisar nome ou número" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="grid grid-cols-2 gap-1"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas</Button><Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>Não lidas</Button><Button size="sm" variant={filter === "mine" ? "default" : "outline"} onClick={() => setFilter("mine")}>Minhas</Button><Button size="sm" variant={filter === "unassigned" ? "default" : "outline"} onClick={() => setFilter("unassigned")}>Não atribuídas</Button><Button size="sm" variant={filter === "ai" ? "default" : "outline"} onClick={() => setFilter("ai")}>IA</Button><Button size="sm" variant={filter === "human" ? "default" : "outline"} onClick={() => setFilter("human")}>Humanos</Button></div></CardHeader><CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">{visible.map((conversation) => <button type="button" key={conversation.id} onClick={() => selectConversation(conversation)} className={`w-full rounded-md border p-3 text-left ${selected?.id === conversation.id ? "border-primary bg-primary/5" : ""}`}><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{conversation.contact?.name || conversation.contact?.phone_number}</span>{conversation.unread_count > 0 && <Badge>{conversation.unread_count}</Badge>}</div><div className="text-xs text-muted-foreground">{conversation.contact?.phone_number}</div><div className="mt-1 text-xs text-muted-foreground">{conversation.assigned_to ? "Atribuída" : "Sem responsável"} · {conversation.status === "human" ? "Humano" : "IA"}</div></button>)}{visible.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>}</CardContent></Card>
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden border-[#d8d0c4] bg-[#efeae2]"><CardHeader className="shrink-0 border-b border-[#d8d0c4] bg-[#f7f3ed] py-3"><button type="button" className="flex items-center gap-3 text-left" disabled={!selected} onClick={() => selected && setProfileOpen(true)}><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7b98e] text-sm font-semibold text-[#4a3d31]">{(selected?.contact?.name || selected?.contact?.phone_number || "?").slice(0, 1).toUpperCase()}</div><div><CardTitle className="text-base">{selected?.contact?.name || selected?.contact?.phone_number || "Selecione uma conversa"}</CardTitle>{selected && <div className="text-xs text-[#756b62]">{selected.status === "human" ? "Atendimento humano" : "Muwoyo IA"} · {selected.contact?.phone_number}</div>}</div></button></CardHeader><CardContent className="flex min-h-0 flex-1 flex-col gap-3 bg-[radial-gradient(#d8d0c4_0.7px,transparent_0.7px)] [background-size:16px_16px]"><div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-3">{selected ? messages.map((message) => <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-lg px-3 py-2 text-base shadow-sm ${message.direction === "outbound" ? "rounded-br-sm bg-[#d9fdd3] text-[#26342a]" : "rounded-bl-sm bg-white text-[#2e2b28]"}`}>{message.media_url && message.kind === "image" && <img src={message.media_url} alt="Imagem enviada" className="mb-2 max-h-72 rounded object-cover" />}{message.media_url && message.kind === "video" && <video src={message.media_url} controls className="mb-2 max-h-72 rounded" />}{message.media_url && message.kind === "audio" && <audio src={message.media_url} controls className="mb-2 w-full" />}{message.media_url && message.kind === "document" && <a href={message.media_url} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 text-sm underline"><FileText className="h-4 w-4" /> Abrir documento</a>}<div>{message.message_text || (message.kind ? `[${message.kind}]` : "(mídia)")}</div><div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#748178]">{new Date(message.created_at).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}{message.direction === "outbound" && <CheckCheck className="h-3.5 w-3.5 text-[#53a548]" />}</div></div></div>) : <p className="m-auto text-sm text-[#756b62]">Escolha uma conversa para ver o histórico.</p>}<div ref={messagesEndRef} /></div>{selected && <div className="sticky bottom-0 rounded-xl border border-[#d8d0c4] bg-[#f7f3ed] p-2"><div className="flex items-center gap-2"><label className="cursor-pointer rounded-full p-2 text-[#5d6d61] hover:bg-[#e8e1d7]" title="Anexar imagem, vídeo, áudio ou documento"><Paperclip className="h-5 w-5" /><input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={(event) => setMediaFile(event.target.files?.[0] || null)} /></label><Input className="border-0 bg-white text-base shadow-none focus-visible:ring-0" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={recording ? "A gravar voice note..." : mediaFile ? mediaFile.name : "Escrever mensagem"} /><Button size="icon" variant={recording ? "destructive" : "ghost"} onClick={() => void toggleRecording()}>{recording ? "■" : <Mic className="h-4 w-4" />}</Button><Button size="icon" className="rounded-full bg-[#128c7e] hover:bg-[#0d766a]" disabled={sending || (!text.trim() && !mediaFile)} onClick={() => void send()}>{sending ? <Mic className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}</Button></div>{mediaFile && <div className="mt-2 flex items-center gap-2 text-xs text-[#5d6d61]"><ImageIcon className="h-4 w-4" />{mediaFile.name}<Input className="h-8" placeholder="Legenda" value={mediaCaption} onChange={(event) => setMediaCaption(event.target.value)} /><Button size="sm" variant="ghost" onClick={() => setMediaFile(null)}>Remover</Button></div>}</div>}</CardContent></Card>
    </div>
      {selected && <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Perfil do cliente</DialogTitle><DialogDescription>Dados reais do contacto e ações da conversa.</DialogDescription></DialogHeader><div className="space-y-5"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d7b98e] text-xl font-semibold">{(selected.contact?.name || selected.contact?.phone_number || "?").slice(0, 1).toUpperCase()}</div><div><div className="text-lg font-semibold">{selected.contact?.name || "Sem nome"}</div><div className="text-sm text-muted-foreground">{selected.contact?.phone_number}</div></div></div><div className="grid gap-2 text-sm"><div><span className="text-muted-foreground">Estado:</span> {selected.status === "human" ? "Atendimento humano" : selected.status === "closed" ? "Resolvida" : "IA ativa"}</div><div><span className="text-muted-foreground">Não lidas:</span> {selected.unread_count}</div><div><span className="text-muted-foreground">Última interação:</span> {selected.last_message_at ? new Date(selected.last_message_at).toLocaleString("pt-AO") : "-"}</div></div><div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => { void toggleAi(); setProfileOpen(false); }}>{selected.status === "human" ? "Devolver à IA" : "Assumir atendimento"}</Button><Button variant="outline" onClick={() => { void resolveConversation(); setProfileOpen(false); }}>{selected.status === "closed" ? "Reabrir" : "Resolver"}</Button><Button variant="outline" onClick={() => { setQuickAction("order"); setProfileOpen(false); }}>Criar pedido</Button><Button variant="outline" onClick={() => { setQuickAction("appointment"); setProfileOpen(false); }}>Agendar</Button></div></div></DialogContent></Dialog>}
      <Dialog open={Boolean(quickAction)} onOpenChange={(open) => !open && setQuickAction(null)}><DialogContent><DialogHeader><DialogTitle>{quickAction === "appointment" ? "Novo agendamento" : "Novo pedido"}</DialogTitle></DialogHeader><div className="grid gap-4">{quickAction === "appointment" ? <><Input placeholder="Serviço" value={quickForm.service} onChange={(event) => setQuickForm({ ...quickForm, service: event.target.value })} /><DateTimeSelect value={quickForm.scheduled_at} onChange={(scheduled_at) => setQuickForm({ ...quickForm, scheduled_at })} required /></> : <Input placeholder="Produto ou descrição" value={quickForm.item} onChange={(event) => setQuickForm({ ...quickForm, item: event.target.value })} />}<Textarea placeholder="Nota interna" value={quickForm.notes} onChange={(event) => setQuickForm({ ...quickForm, notes: event.target.value })} /><Button onClick={() => void createQuickAction()}>Criar</Button></div></DialogContent></Dialog>
  </DashboardShell>;
}
