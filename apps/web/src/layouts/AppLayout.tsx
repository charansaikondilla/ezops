import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bot, BookOpenCheck, Briefcase, Building2, CalendarClock, ChevronDown, ClipboardList, CreditCard, FileText,
  Globe2, Handshake, Home, Inbox, Landmark, LayoutDashboard, LogOut, Megaphone, Menu, Plane, Plus, Receipt, Rocket,
  Settings as SettingsIcon, Stamp, Truck, Users, Wallet, X, PhoneCall, Boxes, ShieldCheck, BadgeCheck, Link2, MessagesSquare, Ticket, UserCog, Route, HandCoins, Bell, Activity,
} from "lucide-react";
import { canRead, ROLE_HOME, type Collection, type ModuleKey, type Role } from "@voyadesk/core";
import { isDemo } from "../lib/api";
import { useSession } from "../lib/session";
import { ROLE_LABEL } from "../lib/format";
import { Avatar, Button, ErrorBoundary, Loading, cx } from "../components/ui";
import { Brand } from "../components/Brand";
import { NotificationBell } from "../pages/app/Notifications";
import { PaymentReminderPopup } from "../components/PaymentReminder";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  module?: ModuleKey;
  needs?: Collection;
  roles?: Role[];
  end?: boolean;
}

const I = "size-[18px]";
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [
    { to: "/app", label: "Dashboard", icon: <LayoutDashboard className={I} />, end: true },
    { to: "/app/onboarding", label: "Setup guide", icon: <Rocket className={I} />, roles: ["owner", "admin"] },
    { to: "/app/notifications", label: "Daily notifications", icon: <Bell className={I} /> },
    { to: "/app/inbox", label: "Inbox", icon: <Inbox className={I} />, needs: "messages" },
    { to: "/app/tasks", label: "Tasks", icon: <ClipboardList className={I} />, needs: "tasks" },
    { to: "/app/messages", label: "Messages & follow-ups", icon: <MessagesSquare className={I} />, needs: "outbox" },
  ] },
  { group: "Sales", items: [
    { to: "/app/leads", label: "Pipeline & leads", icon: <Users className={I} />, module: "sales", needs: "leads" },
    { to: "/app/quotes", label: "Quotes & itineraries", icon: <FileText className={I} />, module: "itinerary", needs: "quotes" },
    { to: "/app/tracker", label: "Trip tracker", icon: <Route className={I} />, module: "itinerary", needs: "quotes" },
    { to: "/app/tracking", label: "Payment tracking", icon: <HandCoins className={I} />, roles: ["owner", "admin", "accounts", "sales"], needs: "bookings" },
    { to: "/app/contacts", label: "Customers", icon: <Home className={I} />, module: "sales", needs: "contacts" },
    { to: "/app/calls", label: "Calls", icon: <PhoneCall className={I} />, module: "sales", needs: "calls" },
    { to: "/app/engines", label: "Flights, hotels & more", icon: <Ticket className={I} />, module: "itinerary", roles: ["owner", "admin", "sales", "ops"] },
    { to: "/app/ai", label: "AI studio", icon: <Bot className={I} />, module: "ai", needs: "leads" },
  ] },
  { group: "Operations", items: [
    { to: "/app/bookings", label: "Bookings", icon: <Briefcase className={I} />, module: "operations", needs: "bookings" },
    { to: "/app/operations", label: "Ops board", icon: <CalendarClock className={I} />, module: "operations", needs: "services", end: true },
    { to: "/app/operations/groups", label: "Group departures", icon: <Plane className={I} />, module: "operations", needs: "groupDepartures" },
    { to: "/app/resources", label: "Drivers & guides", icon: <Truck className={I} />, module: "operations", needs: "resources" },
    { to: "/app/inventory", label: "Inventory & rates", icon: <Boxes className={I} />, module: "operations", needs: "allotments" },
    { to: "/app/insurance", label: "Insurance", icon: <ShieldCheck className={I} />, module: "operations", needs: "policies" },
    { to: "/app/approvals", label: "Approvals", icon: <BadgeCheck className={I} />, needs: "amendments" },
  ] },
  { group: "Finance", items: [
    { to: "/app/finance", label: "Finance overview", icon: <Landmark className={I} />, module: "finance", needs: "invoices", end: true },
    { to: "/app/finance/invoices", label: "Invoices", icon: <Receipt className={I} />, module: "finance", needs: "invoices" },
    { to: "/app/finance/payments", label: "Payments", icon: <CreditCard className={I} />, module: "finance", needs: "payments" },
    { to: "/app/finance/links", label: "Payment links", icon: <Link2 className={I} />, module: "finance", needs: "paymentLinks" },
    { to: "/app/finance/payables", label: "Supplier payables", icon: <Wallet className={I} />, module: "finance", needs: "supplierBills" },
    { to: "/app/finance/ledger", label: "Ledger & books", icon: <BookOpenCheck className={I} />, module: "finance", needs: "ledger" },
    { to: "/app/finance/tax", label: "GST & TCS", icon: <Stamp className={I} />, module: "finance", needs: "invoices", roles: ["owner", "admin", "accounts"] },
  ] },
  { group: "Growth", items: [
    { to: "/app/b2b", label: "B2B agents", icon: <Handshake className={I} />, module: "b2b", needs: "agents" },
    { to: "/app/visa", label: "Visa desk", icon: <Stamp className={I} />, module: "visa", needs: "visaCases" },
    { to: "/app/marketing", label: "Marketing", icon: <Megaphone className={I} />, module: "marketing", needs: "campaigns" },
    { to: "/app/portals", label: "Website & portals", icon: <Globe2 className={I} />, module: "portals", roles: ["owner", "admin", "marketing"] },
  ] },
  { group: "Manage", items: [
    { to: "/app/masters", label: "Masters & suppliers", icon: <Building2 className={I} />, needs: "hotels" },
    { to: "/app/team", label: "Team performance", icon: <Activity className={I} />, roles: ["owner", "admin"] },
    { to: "/app/staff", label: "Staff & team", icon: <UserCog className={I} />, roles: ["owner", "admin"] },
    { to: "/app/reports", label: "Reports", icon: <BarChart3 className={I} />, roles: ["owner", "admin", "accounts"] },
    { to: "/app/settings", label: "Settings", icon: <SettingsIcon className={I} />, roles: ["owner", "admin"] },
  ] },
];

export function visibleNav(role: Role, moduleOn: (m: ModuleKey) => boolean) {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.module || moduleOn(i.module)) && (!i.needs || canRead(role, i.needs)) && (!i.roles || i.roles.includes(role))),
  })).filter((g) => g.items.length > 0);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, moduleOn, settings } = useSession();
  if (!user) return null;
  const groups = visibleNav(user.role as Role, moduleOn);
  return (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex h-14 items-center gap-2 px-4">
        <Brand dark />
      </div>
      <div className="px-4 pb-3 text-xs text-slate-400">{settings?.companyName}</div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g.group || "main"} className="mb-3">
            {g.group && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</div>}
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
                className={({ isActive }) => cx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", isActive ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
                {i.icon}{i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function QuickAdd() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { user, moduleOn } = useSession();
  if (!user) return null;
  const role = user.role as Role;
  const items = [
    { label: "New lead", to: "/app/leads?new=1", show: canRead(role, "leads") },
    { label: "Quote from a message (AI)", to: "/app/ai", show: moduleOn("ai") && canRead(role, "leads") },
    { label: "New visa case", to: "/app/visa?new=1", show: moduleOn("visa") && canRead(role, "visaCases") },
    { label: "New task", to: "/app/tasks?new=1", show: canRead(role, "tasks") },
  ].filter((i) => i.show);
  if (!items.length) return null;
  return (
    <div className="relative">
      <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>New</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-white p-1 shadow-lg">
            {items.map((i) => <button key={i.to} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setOpen(false); nav(i.to); }}>{i.label}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  if (!user) return null;
  return (
    <div className="relative">
      <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar name={user.name} />
        <span className="hidden text-left sm:block"><span className="block text-sm font-medium leading-tight">{user.name}</span><span className="block text-xs text-ink-500">{ROLE_LABEL[user.role]}</span></span>
        <ChevronDown className="size-4 text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-white p-1 shadow-lg">
            {isDemo && <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setOpen(false); nav("/login"); }}>Switch demo user</button>}
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50" onClick={() => { signOut(); nav("/"); }}><LogOut className="size-4" />Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role as Role)) return <Navigate to={ROLE_HOME[user.role as Role]} replace />;
  return <>{children}</>;
}

export function AppLayout() {
  const { user, loading } = useSession();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => setDrawer(false), [loc.pathname]);
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "agent") return <Navigate to="/agent" replace />;
  if (user.role === "driver") return <Navigate to="/field" replace />;
  return (
    <div className="flex min-h-full">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 bg-[#0f1b33] lg:block"><Sidebar /></aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#0f1b33] shadow-xl">
            <button className="absolute right-3 top-3 rounded p-1 text-slate-300 hover:bg-white/10" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="size-5" /></button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {isDemo && (
          <div className="no-print bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Demo mode — sample agency data stored in this browser only. <Link to="/app/settings?tab=data" className="font-medium underline">Reset demo</Link>
          </div>
        )}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="size-5" /></button>
            <span className="lg:hidden"><Brand /></span>
          </div>
          <div className="flex items-center gap-2"><NotificationBell /><QuickAdd /><UserMenu /></div>
        </header>
        <PaymentReminderPopup />
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-6">
          <ErrorBoundary key={loc.pathname}>
            <Suspense fallback={<Loading />}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
