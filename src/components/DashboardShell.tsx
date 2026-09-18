import { ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ChartArea,
  Building2,
  Menu,
  Settings,
  Store,
  Gift,
  ShoppingBag,
  CalendarDays,
  Boxes,
  ArrowRightLeft,
  PlayCircle,
  UsersRound,
  Wallet,
  CreditCard,
  KanbanSquare,
  Megaphone,
  Inbox as InboxIcon,
  Workflow,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import ProfileSheet from "@/components/ProfileSheet";
import logo from "@/assets/muwoyo-logo.png";

const items = [
  { title: "Dashboard", to: "/dashboard", icon: ChartArea },
  { title: "Informações do negócio", to: "/negocio", icon: Building2 },
  { title: "Meus contactos", to: "/whatsapp", icon: UsersRound },
  { title: "CRM", to: "/crm", icon: KanbanSquare },
  { title: "Inbox", to: "/inbox", icon: InboxIcon },
  { title: "Campanhas", to: "/campanhas", icon: Megaphone },
  { title: "Follow Up IA", to: "/follow-up", icon: Workflow },
  { title: "Pedidos", to: "/pedidos", icon: ShoppingBag },
  { title: "Minha Agenda", to: "/agenda", icon: CalendarDays },
  { title: "Transferido para humano", to: "/transferido-para-humano", icon: ArrowRightLeft },
  { title: "Meus Produtos", to: "/produtos", icon: Boxes },
  { title: "Minha Loja", to: "/minha-loja", icon: Store },
  { title: "Afiliados", to: "/afiliados", icon: Gift },
  { title: "Pagamentos", to: "/recargas", icon: CreditCard },
  { title: "Faturação", to: "/faturacao", icon: Wallet },
  { title: "Definições", to: "/definicoes", icon: Settings },
  { title: "Tutorial", to: "/tutorial", icon: PlayCircle },
];

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();
  return (
    <aside className={`flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] ${collapsed ? "w-16" : "w-60"}`}>
      <div className={`flex h-20 items-center gap-3 ${collapsed ? "justify-center px-2" : "px-6"}`}>
        <img src={logo} alt="Muwoyo" className="h-10 w-10 object-contain" />
        {!collapsed && <div className="text-2xl font-bold text-foreground">Muwoyo</div>}
      </div>
      <nav className={`flex-1 space-y-1 overflow-y-auto py-2 ${collapsed ? "px-1" : "px-2"}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors ${collapsed ? "justify-center px-2" : "px-3"} ${isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent"}`
            }
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={`border-t border-sidebar-border ${collapsed ? "p-1" : "p-2"}`}>
        <ProfileSheet>
          <button className={`flex w-full items-center gap-3 rounded-md bg-accent p-3 text-left transition-colors hover:bg-accent/80 ${collapsed ? "justify-center" : ""}`} title={collapsed ? user?.email || "Perfil" : undefined}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {(user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {user?.email?.split("@")[0] || "Usuário"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {user?.email}
              </div>
            </div>}
          </button>
        </ProfileSheet>
      </div>
    </aside>
  );
}

export default function DashboardShell({
  children,
  title,
  description,
  accountStatus,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  accountStatus?: string;
  wide?: boolean;
}) {
  const { user } = useAuth();
  const [currentAccountStatus, setCurrentAccountStatus] = useState(accountStatus || "trial");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCurrentAccountStatus(data?.account_status || accountStatus || "trial"));
  }, [accountStatus, user]);

  const statusLabel = currentAccountStatus === "trial"
    ? "Em teste"
    : currentAccountStatus === "awaiting_activation"
      ? "Pagamento confirmado"
      : "Ativa";
  const statusColor = currentAccountStatus === "trial"
    ? "bg-amber-400"
    : currentAccountStatus === "awaiting_activation"
      ? "bg-sky-500"
      : "bg-emerald-500";

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        <SidebarContent collapsed={sidebarCollapsed} />
      </div>
      <div className={sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-10">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-3 lg:gap-0">
                <img
                  src={logo}
                  alt="Muwoyo"
                  className="h-8 w-8 object-contain lg:hidden"
                />
                <div>
                  <h1 className="text-lg font-bold tracking-normal text-foreground lg:text-2xl">
                    {title}
                  </h1>
                  {description && (
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      {description}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="hidden lg:inline-flex" title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setSidebarCollapsed((value) => !value)}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                  <span>Status</span>
                  <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                  <span className="text-foreground">{statusLabel}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className={`${wide ? "w-full" : "mx-auto max-w-7xl"} space-y-5 px-4 py-5 sm:px-6 lg:px-10 lg:py-6`}>
          {children}
        </main>
      </div>
    </div>
  );
}
