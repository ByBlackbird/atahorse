import { useAuth } from "@/hooks/useAuth";
import { HaizLogo } from "@/components/brand/HaizLogo";
import { NotificationBell, NotificationToasts } from "@/components/NotificationBell";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { PlanBadge, usePlan, LockBadge } from "@/components/premium";
import { Tour, startTour } from "@/components/Tour";
import { PROFESSION_LABEL, isProfession } from "@contracts/workflow";
import type { Feature } from "@contracts/plans";
import { trpc } from "@/providers/trpc";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Activity,
  Bug,
  FileText,
  Gauge,
  Megaphone,
  Package,
  Radio,
  Search,
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  HelpCircle,
  Inbox,
  Landmark,
  LifeBuoy,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mic,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { HelpDialog } from "@/components/HelpDialog";
import { useLocation, useNavigate, Link, Navigate } from "react-router";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";

const ROLE_LABEL: Record<string, string> = {
  owner: "Yönetici",
  manager: "Şantiye Şefi",
  member: "Usta",
};

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  tour?: string;
  feature?: Feature;
  /** Alt öğeler (girintili, daha küçük ve soluk) */
  children?: { label: string; path: string }[];
  /** Yalnız tam adres eşleşince etkin (alt adresleri olan ana sayfalar için) */
  exact?: boolean;
  /** Sağda sayı rozeti (bekleyen iş) */
  badge?: number;
  /** Rozet acil mi (kırmızı) */
  badgeUrgent?: boolean;
}

interface NavGroup {
  /** Grup başlığı; boşsa başlıksız üst grup */
  label?: string;
  items: NavItem[];
}

/**
 * Menü hiyerarşisi:
 *   üst grup (başlıksız, en sık kullanılanlar) → PROJELERİM → ANALİZ → ŞİRKET & AYARLAR → YÖNETİM (yalnız site yöneticisi)
 * Ana modüller kalın ve büyük; şantiye adları gibi alt öğeler girintili, ince ve soluk.
 */
type AdminBadges = { newLeads: number; overdueLeads: number; dueFollowUps: number; openFeedback: number; errors7: number; pendingPayments: number } | undefined;

function menuFor(role: string, isSiteAdmin: boolean, projects: { id: number; name: string; status: string }[], b?: AdminBadges): NavGroup[] {
  const projectChildren = projects
    .filter((p) => p.status === "active")
    .slice(0, 5)
    .map((p) => ({ label: p.name, path: `/santiye/${p.id}` }));

  if (role === "member") {
    return [
      {
        items: [
          { icon: ClipboardList, label: "Görevlerim", path: "/usta" },
          { icon: ListChecks, label: "Tüm İşler", path: "/isler", tour: "nav-tasks" },
          { icon: Mic, label: "Sesli Not", path: "/rapor" },
        ],
      },
      { label: "Şirket", items: [{ icon: Briefcase, label: "Şirketim", path: "/sirketim" }] },
    ];
  }

  const groups: NavGroup[] = [
    {
      items: [
        { icon: LayoutDashboard, label: "Panel", path: "/panel" },
        { icon: Wallet, label: "Patron", path: "/patron" },
        { icon: ListChecks, label: "Tüm İşler", path: "/isler", tour: "nav-tasks" },
        { icon: Sparkles, label: "AI Asistan", path: "/asistan" },
      ],
    },
    {
      label: "Projelerim",
      items: [
        { icon: Building2, label: "Şantiyeler", path: "/santiyeler", tour: "nav-projects", children: projectChildren },
        { icon: Mic, label: "Sesli Rapor", path: "/rapor" },
        { icon: Landmark, label: "Restorasyon", path: "/resto" },
      ],
    },
    {
      label: "Analiz & Rapor",
      items: [{ icon: BarChart3, label: "Verimlilik", path: "/analitik", feature: "analytics" }],
    },
    {
      label: "Şirket & Ayarlar",
      items: [
        { icon: Briefcase, label: "Şirketim", path: "/sirketim" },
        { icon: Users, label: "Ekip", path: "/ekip", feature: "team" },
        ...(role === "owner" ? [{ icon: CreditCard, label: "Abonelik", path: "/abonelik" }] : []),
      ],
    },
  ];
  if (isSiteAdmin) {
    // Kurucu Paneli — Shopify yönetim menüsü düzeni (Ana sayfa · Siparişler · Ürünler · Müşteriler · Analitik · Pazarlama …)
    groups.push(
      {
        label: "Kurucu Paneli",
        items: [
          { icon: Gauge, label: "Ana sayfa", path: "/kurucu", exact: true },
          { icon: Inbox, label: "Başvurular", path: "/kurucu/basvurular", badge: (b?.newLeads ?? 0) + (b?.dueFollowUps ?? 0), badgeUrgent: !!(b?.overdueLeads || b?.dueFollowUps) },
          { icon: Package, label: "Ürünler", path: "/kurucu/urunler" },
          { icon: Users, label: "Müşteriler", path: "/kurucu/musteriler" },
          { icon: BarChart3, label: "Analitik", path: "/kurucu/analitik" },
          { icon: Radio, label: "Canlı görünüm", path: "/kurucu/canli" },
          { icon: Megaphone, label: "Pazarlama", path: "/kurucu/pazarlama" },
          { icon: Search, label: "SEO", path: "/kurucu/seo" },
          { icon: CreditCard, label: "Ödemeler", path: "/kurucu/odemeler", badge: b?.pendingPayments },
        ],
      },
      {
        label: "Operasyon",
        items: [
          { icon: FileText, label: "Danışmanlık dosyaları", path: "/kurucu/dosyalar" },
          { icon: LifeBuoy, label: "Yardım talepleri", path: "/kurucu/yardim", badge: b?.openFeedback },
          { icon: Bug, label: "Hatalar", path: "/kurucu/hatalar", badge: b?.errors7, badgeUrgent: true },
          { icon: Activity, label: "Sistem Durumu", path: "/sistem" },
        ],
      },
    );
  }
  return groups;
}

/**
 * Usta için telefon alt menüsü: başparmakla ulaşılan 3 büyük düğme.
 * (Yan menü ustaya gereksiz derinlik; alt menü tek dokunuş.)
 */
function MemberTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = [
    { icon: ClipboardList, label: "Görevlerim", path: "/usta" },
    { icon: Mic, label: "Sesli Not", path: "/rapor" },
    { icon: ListChecks, label: "Tüm İşler", path: "/isler" },
  ];
  return (
    <nav
      aria-label="Usta menüsü"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {tabs.map((t) => {
        const active = location.pathname === t.path;
        return (
          <button
            key={t.path}
            type="button"
            onClick={() => navigate(t.path)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
          >
            <t.icon className={`h-6 w-6 ${active ? "text-mint" : ""}`} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Bulunulan sayfaya uygun rehber */
function tourForPath(pathname: string, search: string, role?: string): string {
  if (role === "member") return "usta";
  if (pathname.startsWith("/santiyeler")) return "projects";
  if (/^\/santiye\/\d+/.test(pathname)) return search.includes("sekme=plan") ? "plan" : "project";
  return "main";
}

function NavLinks({ groups }: { groups: NavGroup[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();
  const { status } = usePlan();
  const go = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };
  const isActive = (path: string, exact?: boolean) => location.pathname === path || (!exact && location.pathname.startsWith(`${path}/`));

  return (
    <nav aria-label="Uygulama menüsü" className="px-2 pb-4">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className={gi === 0 ? "pt-3" : "mt-4 border-t border-sidebar-border/60 pt-3"}>
          {g.label && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">{g.label}</p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item.path, item.exact) || (item.children ?? []).some((c) => isActive(c.path));
              const locked = item.feature && status ? !status.features[item.feature] : false;
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    data-tour={item.tour}
                    onClick={() => go(item.path)}
                    aria-current={isActive(item.path, item.exact) ? "page" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] font-semibold tracking-tight transition-colors ${
                      active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    }`}
                  >
                    <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {locked && <LockBadge />}
                    {!!item.badge && (
                      <span className={`min-w-5 rounded px-1.5 text-center text-[11px] font-bold tnum ${item.badgeUrgent ? "bg-destructive text-white" : "bg-sidebar-foreground/15 text-sidebar-foreground"}`} aria-label={`${item.badge} bekleyen`}>
                        {item.badge}
                      </span>
                    )}
                    {active && <span className="h-4 w-0.5 rounded-full bg-primary" aria-hidden />}
                  </button>
                  {item.children && item.children.length > 0 && (
                    <ul className="mb-1 ml-[22px] mt-0.5 border-l border-sidebar-border pl-2">
                      {item.children.map((c) => (
                        <li key={c.path}>
                          <button
                            type="button"
                            onClick={() => go(`${c.path}?sekme=genel`)}
                            aria-current={isActive(c.path) ? "page" : undefined}
                            className={`block w-full truncate rounded px-2.5 py-1.5 text-left text-[12.5px] font-normal transition-colors ${
                              isActive(c.path) ? "font-medium text-primary" : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                            }`}
                          >
                            {c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isLoading, user, logout } = useAuth();
  const location = useLocation();
  const { data: companyData, isLoading: companyLoading } = trpc.iarch.company.mine.useQuery(undefined, {
    retry: false,
    enabled: !!user,
  });
  const projects = trpc.iarch.project.list.useQuery(undefined, {
    retry: false,
    enabled: !!user && !!companyData?.membership && companyData.membership.role !== "member",
  });

  const [helpOpen, setHelpOpen] = useState(false);
  // Kurucu menüsündeki bekleyen iş sayıları (yalnız site yöneticisi)
  const adminBadges = trpc.founder.badges.useQuery(undefined, { enabled: user?.role === "admin", refetchInterval: 60_000, retry: false });

  // Rol bilinmeden menü çizilmez: eskiden yüklenirken herkes "usta" sayılıyordu (yönetici usta menüsü görüyordu)
  if (isLoading || (user && companyLoading)) return <AuthLayoutSkeleton />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Şirketi olmayan (kurulum aşaması) kullanıcı usta DEĞİLDİR; yalnız gerçekten "member" olan usta menüsü görür
  const role = companyData?.membership?.role ?? "owner";
  const isCrew = role === "member";
  const groups = menuFor(role, user.role === "admin", projects.data ?? [], adminBadges.data);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <Link to="/" aria-label="HAIZ ana sayfa" className="flex items-center">
              <HaizLogo size={28} tone="dark" />
            </Link>
            <NotificationBell tone="dark" />
          </div>
          {companyData?.company && (
            <div className="flex items-center gap-2.5 px-2 pb-1">
              {companyData.company.logoVersion ? (
                <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-white p-0.5">
                  <img src={`/api/logo/${companyData.company.id}?v=${companyData.company.logoVersion}`} alt="" className="max-h-7 max-w-11 object-contain" />
                </span>
              ) : null}
              <p className="truncate text-[12px] font-medium text-sidebar-foreground/70">{companyData.company.name}</p>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <NavLinks groups={groups} />
        </SidebarContent>
        <SidebarFooter className="space-y-2 border-t border-sidebar-border p-3">
          {!isCrew && (
            <div data-tour="plan-badge">
              <PlanBadge />
            </div>
          )}
          <button
            type="button"
            data-tour="help"
            onClick={() => startTour(tourForPath(location.pathname, location.search, role))}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Bu ekranın rehberi
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <LifeBuoy className="h-3.5 w-3.5" /> Yardım ve geri bildirim
          </button>
          <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page={location.pathname} />
          <div className="flex items-center gap-3 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                {companyData?.membership?.displayName ?? user.name ?? "Kullanıcı"}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">
                {isProfession(companyData?.membership?.profession)
                  ? `${PROFESSION_LABEL[companyData!.membership!.profession!]} · ${ROLE_LABEL[role] ?? role}`
                  : (ROLE_LABEL[role] ?? role)}
              </p>
            </div>
            <button type="button" onClick={logout} title="Çıkış yap" aria-label="Çıkış yap" className="text-sidebar-foreground/60 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <div className="flex h-12 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-display font-bold">HAIZ</span>
          <span className="ml-auto">
            <NotificationBell />
          </span>
        </div>
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-24">{children}</main>
      </SidebarInset>
      {role !== "member" || user.role === "admin" ? <VoiceAssistant /> : <MemberTabBar />}
      <NotificationToasts />
      {/* Yönetici rehberi (şantiyeler, paket, sesli asistan) ustaya GÖSTERİLMEZ; ustanın kendi kısa rehberi var */}
      {isCrew ? (
        <Tour id="usta" auto={location.pathname === "/usta"} />
      ) : (
        <>
          <Tour id="main" auto={location.pathname === "/panel"} />
          {location.pathname === "/santiyeler" && <Tour id="projects" />}
        </>
      )}
    </SidebarProvider>
  );
}
