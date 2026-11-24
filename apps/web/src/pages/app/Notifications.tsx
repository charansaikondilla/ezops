import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, ClipboardList, Clock, MessageCircle, UserPlus } from "lucide-react";
import { canRead, type Role } from "@voyadesk/core";
import { useList } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { relTime, SOURCE_LABEL } from "../../lib/format";
import { Badge, Card, CardTitle, Empty, Loading, PageHeader, Stat, cx } from "../../components/ui";

const DAY = 86_400_000;

export interface NoticeItem { id: string; to: string; title: string; sub: string; at: string }
export interface Notices { newToday: NoticeItem[]; unread: NoticeItem[]; tasks: NoticeItem[]; idle: NoticeItem[]; total: number; ready: boolean }

/** Everything that needs attention today, scoped to the person (owners and admins see the whole team). */
export function useNotices(): Notices {
  const { user } = useSession();
  const role = user?.role as Role | undefined;
  const seeAll = role === "owner" || role === "admin";
  const leads = useList("leads", Boolean(role && canRead(role, "leads")));
  const msgs = useList("messages", Boolean(role && canRead(role, "messages")));
  const tasks = useList("tasks", Boolean(role && canRead(role, "tasks")));
  return useMemo(() => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const L = (leads.data ?? []).filter((l) => seeAll || !l.ownerId || l.ownerId === user?.id);
    const newToday = L.filter((l) => Date.parse(l.createdAt) >= start.getTime()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((l) => ({ id: l.id, to: `/app/leads/${l.id}`, title: l.name, sub: `${l.destination || l.service} · ${SOURCE_LABEL[l.source] ?? l.source}`, at: l.createdAt }));
    const unread = (msgs.data ?? []).filter((m) => m.direction === "in" && !m.read).sort((a, b) => (a.at < b.at ? 1 : -1))
      .map((m) => ({ id: m.id, to: m.leadId ? `/app/leads/${m.leadId}` : "/app/inbox", title: m.from || m.phone, sub: m.body, at: m.at }));
    const due = (tasks.data ?? []).filter((t) => !t.done && Date.parse(t.dueAt) < start.getTime() + DAY && (seeAll || !t.assigneeId || t.assigneeId === user?.id))
      .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
      .map((t) => ({ id: t.id, to: t.leadId ? `/app/leads/${t.leadId}` : "/app/tasks", title: t.title, sub: Date.parse(t.dueAt) < now ? "Overdue" : "Due today", at: t.dueAt }));
    const idle = L.filter((l) => !["won", "lost"].includes(l.stage) && now - Date.parse(l.lastActivityAt ?? l.createdAt) > 2 * DAY)
      .sort((a, b) => ((a.lastActivityAt ?? a.createdAt) < (b.lastActivityAt ?? b.createdAt) ? -1 : 1))
      .map((l) => ({ id: l.id, to: `/app/leads/${l.id}`, title: l.name, sub: `No activity · ${l.stage}`, at: l.lastActivityAt ?? l.createdAt }));
    return { newToday, unread, tasks: due, idle, total: newToday.length + unread.length + due.length + idle.length, ready: Boolean(leads.data || msgs.data || tasks.data) };
  }, [leads.data, msgs.data, tasks.data, user?.id, seeAll]);
}

/** Header bell with a live count and a short list; the full daily box is on /app/notifications. */
export function NotificationBell() {
  const n = useNotices();
  const [open, setOpen] = useState(false);
  const top = [
    ...n.newToday.slice(0, 3).map((i) => ({ ...i, kind: "New client" })),
    ...n.unread.slice(0, 3).map((i) => ({ ...i, kind: "Message" })),
    ...n.tasks.slice(0, 3).map((i) => ({ ...i, kind: "Task" })),
    ...n.idle.slice(0, 2).map((i) => ({ ...i, kind: "Follow up" })),
  ];
  return (
    <div className="relative">
      <button className="relative rounded-lg p-2 hover:bg-slate-100" aria-label={`Notifications${n.total ? `, ${n.total} new` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="size-5" />
        {n.total > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">{n.total > 99 ? "99+" : n.total}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold">Today's notifications</span>
              <Link to="/app/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-700 hover:underline">Open daily box</Link>
            </div>
            {top.length === 0 ? <p className="px-2 py-6 text-center text-sm text-ink-500">You're all caught up.</p> : (
              <ul className="max-h-80 overflow-y-auto">
                {top.map((i) => (
                  <li key={`${i.kind}-${i.id}`}>
                    <Link to={i.to} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{i.title}</span><Badge>{i.kind}</Badge></div>
                      <div className="truncate text-xs text-ink-500">{i.sub} · {relTime(i.at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Box({ title, subtitle, icon, items, empty, tone }: { title: string; subtitle: string; icon: ReactNode; items: NoticeItem[]; empty: string; tone: string }) {
  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", tone)}>{icon}</span>
        <CardTitle title={`${title} (${items.length})`} subtitle={subtitle} />
      </div>
      {items.length === 0 ? <p className="px-5 pb-5 text-sm text-ink-500">{empty}</p> : (
        <ul className="max-h-96 divide-y divide-line overflow-y-auto border-t border-line">
          {items.map((i) => (
            <li key={i.id}>
              <Link to={i.to} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 sm:px-5">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{i.title}</span><span className="block truncate text-xs text-ink-500">{i.sub}</span></span>
                <span className="shrink-0 text-xs text-ink-400">{relTime(i.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The daily box: today's new clients, unread customer messages, tasks due and leads gone quiet. */
export function NotificationsPage() {
  const n = useNotices();
  return (
    <div className="space-y-5">
      <PageHeader title="Daily notifications" subtitle={`${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: new clients and everything that needs a reply today.`} />
      {!n.ready ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="New clients today" value={n.newToday.length} tone="good" />
            <Stat label="Unread messages" value={n.unread.length} tone={n.unread.length ? "warn" : "default"} />
            <Stat label="Tasks due / overdue" value={n.tasks.length} tone={n.tasks.length ? "warn" : "default"} />
            <Stat label="Leads gone quiet" value={n.idle.length} tone={n.idle.length ? "bad" : "default"} hint="No activity for 2+ days" />
          </div>
          {n.total === 0 && <Empty>Nothing needs attention right now.</Empty>}
          <div className="grid gap-4 lg:grid-cols-2">
            <Box title="New clients today" subtitle="Enquiries that arrived today" icon={<UserPlus className="size-4" />} items={n.newToday} empty="No new clients yet today." tone="bg-emerald-100 text-emerald-700" />
            <Box title="Customer messages" subtitle="Unread WhatsApp, email and chat" icon={<MessageCircle className="size-4" />} items={n.unread} empty="No unread messages." tone="bg-sky-100 text-sky-700" />
            <Box title="Tasks" subtitle="Due today or overdue" icon={<ClipboardList className="size-4" />} items={n.tasks} empty="No tasks due." tone="bg-amber-100 text-amber-700" />
            <Box title="Follow up" subtitle="Open leads with no activity for 2+ days" icon={<Clock className="size-4" />} items={n.idle} empty="Every open lead has been touched recently." tone="bg-rose-100 text-rose-700" />
          </div>
        </>
      )}
    </div>
  );
}
