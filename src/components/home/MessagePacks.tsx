import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MessageSquare, Check } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

type TopUpPack = {
  id: string;
  name: string;
  messages: number;
  price_kz: number;
  position?: number;
};

const defaultPacks: TopUpPack[] = [
  { id: "small", name: "Muwoyo Small", messages: 500, price_kz: 7500, position: 1 },
  { id: "medium", name: "Muwoyo Medium", messages: 1000, price_kz: 14000, position: 2 },
  { id: "medium-ii", name: "Muwoyo Big", messages: 2500, price_kz: 30000, position: 3 },
];

const packDetails: Record<string, { description: string; benefits: string[] }> = {
  "Muwoyo Small": {
    description: "Para começar ou para um menor volume de uso.",
    benefits: ["500 mensagens", "Ideal para começar", "Sem expiração mensal", "Recarga pelo painel"],
  },
  "Muwoyo Medium": {
    description: "O equilíbrio entre preço e volume para o dia a dia.",
    benefits: ["Melhor custo-benefício", "1.000 mensagens", "Sem expiração mensal", "Recarga pelo painel"],
  },
  "Muwoyo Big": {
    description: "Mais volume para quem atende mais clientes.",
    benefits: ["2.500 mensagens", "Menor custo por uso", "Maior volume", "Sem expiração mensal"],
  },
};

export const MessagePacks = () => {
  const [packs, setPacks] = useState<TopUpPack[]>(defaultPacks);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const loadPacks = async () => {
      const { data, error } = await supabase
        .from("top_up_packages")
        .select("id,name,messages,price_kz,position")
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (!error) {
        const loadedPacks = ((data as TopUpPack[]) || []).filter((pack) => !pack.name.toLowerCase().includes("big"));
        setPacks(loadedPacks.length > 0 ? [...defaultPacks.map((fallback) => loadedPacks.find((pack) => pack.name === fallback.name) || fallback)] : defaultPacks);
      }
    };

    void loadPacks();
  }, []);
  return (
    <section id="messages" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            Pacotes de mensagens
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">Depois, recarregue mensagens quando precisar.</h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Depois de utilizar os créditos disponíveis, escolha apenas o pacote
            adequado ao volume do seu negócio. Sem mensalidade e sem expiração
            mensal dos pacotes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {packs.map((p, index) => (
            <div
              key={p.id}
              className={`relative h-full rounded-2xl border bg-card p-6 flex flex-col ${
                index === 1
                  ? "border-primary shadow-elevated ring-1 ring-primary/20"
                  : "border-border shadow-soft"
              }`}
            >
              {index === 1 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-foreground text-background px-3 py-1 text-[11px] font-semibold tracking-wide">
                  Mais escolhido
                </span>
              )}

              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-accent text-primary mb-4">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {p.name}
              </h3>
              <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {packDetails[p.name]?.description || "Mais capacidade para acompanhar o volume do seu negócio."}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                {p.messages.toLocaleString("pt-AO")} mensagens
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {p.price_kz.toLocaleString("pt-AO")}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Kz
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                ≈ {(p.price_kz / p.messages).toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz por mensagem
              </p>

              <ul className="mt-5 min-h-[92px] space-y-2 text-xs text-foreground">
                {(packDetails[p.name]?.benefits || ["Mensagens com a IA Muwoyo", "Sem expiração mensal", "Recarga simples no painel", "Mais capacidade para a sua operação"]).map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={3} />
                    {benefit}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`mt-auto w-full rounded-xl h-11 font-semibold ${
                  index === 1
                    ? "bg-foreground hover:bg-foreground/90 text-background"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                }`}
              >
                <Link to="/login">Comprar agora</Link>
              </Button>
            </div>
          ))}
          <div className="relative h-full rounded-2xl border border-dashed border-primary bg-card p-6 flex flex-col shadow-soft">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-accent text-primary mb-4">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Muwoyo Business</h3>
            <p className="text-sm text-muted-foreground mt-1">Para empresas com maior volume</p>
            <p className="mt-3 text-sm font-medium text-foreground">Precisa de mais mensagens ou de uma solução adaptada à sua operação?</p>
            <p className="mt-4 text-sm font-semibold text-primary">Volume personalizado</p>
            <div className="mt-5 text-3xl font-bold text-foreground">Sob consulta</div>
            <p className="text-sm text-muted-foreground mt-2">Definimos uma solução de acordo com as necessidades e o volume de atendimento da sua empresa.</p>
            <ul className="mt-4 space-y-2 text-xs text-foreground">
              <li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />Volume personalizado</li>
              <li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />Mais capacidade para a sua operação</li>
              <li className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />Solução adaptada ao seu negócio</li>
            </ul>
            <Button asChild className="mt-auto w-full rounded-xl h-11 font-semibold">
              <a href="https://wa.me/244928663898" target="_blank" rel="noreferrer">Falar com a nossa equipa</a>
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Os créditos não possuem expiração mensal. Compre apenas quando
          precisar de mais mensagens.
        </p>
        <p className="text-center text-sm font-semibold text-foreground mt-3">
          Quanto mais mensagens comprar, menor fica o custo por mensagem.
        </p>
      </div>
    </section>
  );
};
