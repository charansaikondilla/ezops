import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Clock, Flame, PlaneLanding, PlaneTakeoff, Timer } from "lucide-react";
import { formatDate, type Activity, type Task } from "@voyadesk/core";
import { api } from "../../lib/api";
import { useAction, useReport } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { formatCompact, relTime, SOURCE_LABEL, titleCase } from "../../lib/format";
import { Card, CardTitle, ErrorNote, Loading, PageHeader, Stat, StatusBadge, cx } from "../../components/ui";
import { Funnel, MonthBars, RankBars } from "../../components/charts";
import { AttentionPanel } from "../../components/plus";

export interface DashboardData {
  today: string;
  kpis: {
    newLeadsToday: number; openLeads: number; hotLeads: number; agingLeads: number; quotesSentMonth: number; proposalViews: number;
    conversionRate: number | null; bookingsMonth: number; revenueMonth: number; collectedMonth: number; receivables: number;
    overdueReceivables: number; payablesDue: number; avgResponseMins: number | null; onTrip: number; pendingServices: number; openVisaCases: number;
  };
  pipeline: { stage: string; count: number; value: number }[];
  sources: { source: string; count: number }[];
  destinations: { destination: string; count: number }[];
  revenueTrend: { month: string; invoiced: number; collected: number }[];
  arrivals: { id: string; number: string; contactName: string; destination: string; date: string; pax: number }[];
  departures: { id: string; number: string; contactName: string; destination: string; date: string; pax: number }[];
  tasks: Task[];
  overdueTasks: number;
  activity: Activity[];
  visaByStatus: { status: string; count: number }[];
  staff: { userId: string; name: string; leads: number; open: number; won: number; revenue: number }[];
}

const STAGE_COLORS: Record<string, string> = { new: "#3b6af5", contacted: "#0891b2", quoted: "#7c3aed", negotiation: "#d97706", won: "#059669", lost: "#94a3b8" };

export function TaskList({ tasks }: { tasks: Task[] }) {
  const { act } = useAction();
  if (tasks.length === 0) return <p className="py-4 text-center text-sm text-ink-500">Nothing due. Nice.</p>;
  const now = new Date().toISOString();
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-2.5">
          <button aria-label={t.done ? "Mark not done" : "Mark done"} onClick={() => act("completeTask", { taskId: t.id, done: !t.done }, t.done ? "Task reopened" : "Task done")} className="mt-0.5 text-ink-400 hover:text-emerald-600">
            {t.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className={cx("text-sm", t.done ? "text-ink-400 line-through" : "text-ink-900")}>
              {t.leadId ? <Link to={`/app/leads/${t.leadId}`} className="hover:underline">{t.title}</Link> : t.bookingId ? <Link to={`/app/bookings/${t.bookingId}`} className="hover:underline">{t.title}</Link> : t.visaCaseId ? <Link to={`/app/visa/${t.visaCaseId}`} className="hover:underline">{t.title}</Link> : t.title}
            </div>
            <div className={cx("mt-0.5 flex items-center gap-1 text-xs", !t.done && t.dueAt < now ? "text-rose-600" : "text-ink-500")}><Clock className="size-3" />{relTime(t.dueAt)}{t.priority === "high" && <span className="ml-1 font-medium text-rose-600">· High</span>}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ActivityFeed({ items }: { items: Activity[] }) {
  if (items.length === 0) return <p className="py-4 text-center text-sm text-ink-500">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", a.kind === "payment" ? "bg-emerald-500" : a.kind === "quote_view" ? "bg-violet-500" : a.kind === "system" ? "bg-slate-300" : "bg-brand-500")} />
          <div className="min-w-0">
            <div className="text-ink-800">
              {a.leadId ? <Link to={`/app/leads/${a.leadId}`} className="hover:underline">{a.body}</Link> : a.bookingId ? <Link to={`/app/bookings/${a.bookingId}`} className="hover:underline">{a.body}</Link> : a.visaCaseId ? <Link to={`/app/visa/${a.visaCaseId}`} className="hover:underline">{a.body}</Link> : a.body}
            </div>
            <div className="text-xs text-ink-500">{titleCase(a.kind)} · {relTime(a.at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user, settings } = useSession();
  const q = useReport<DashboardData>("dashboard");
  if (q.error && !q.data) return <ErrorNote message={q.error.message} onRetry={q.reload} />;
  if (!q.data || !user) return <Loading />;
  const d = q.data;
  const k = d.kpis;
  const role = user.role;
  const isBoss = role === "owner" || role === "admin";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <PageHeader title={`${greet}, ${user.name.split(" ")[0]}`} subtitle={`${formatDate(d.today)} · ${settings?.companyName ?? ""}`} />
      <div className="mb-5"><AttentionPanel /></div>

      {d.overdueTasks > 0 && (
        <Link to="/app/tasks" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="size-4" /> You have {d.overdueTasks} overdue task{d.overdueTasks > 1 ? "s" : ""}. <span className="ml-auto inline-flex items-center gap-1 font-medium">Open tasks <ArrowRight className="size-4" /></span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(isBoss || role === "sales" || role === "marketing") && <>
          <Stat label="New leads today" value={k.newLeadsToday} hint={`${k.openLeads} open in pipeline`} />
          <Stat label="Hot leads" value={k.hotLeads} tone={k.hotLeads ? "bad" : "default"} icon={<Flame className="size-4" />} hint={`${k.agingLeads} untouched for 3+ days`} />
          <Stat label="Conversion (90 days)" value={k.conversionRate === null ? "—" : `${k.conversionRate}%`} hint={`${k.quotesSentMonth} quotes sent this month`} />
          <Stat label="First response" value={k.avgResponseMins === null ? "—" : `${k.avgResponseMins} min`} icon={<Timer className="size-4" />} hint={`${k.proposalViews} proposal views`} />
        </>}
        {(isBoss || role === "accounts") && <>
          <Stat label="Revenue this month" value={formatCompact(k.revenueMonth)} hint={`${k.bookingsMonth} bookings`} tone="good" />
          <Stat label="Collected this month" value={formatCompact(k.collectedMonth)} />
          <Stat label="Receivables" value={formatCompact(k.receivables)} tone={k.overdueReceivables ? "warn" : "default"} hint={`${formatCompact(k.overdueReceivables)} overdue`} />
          <Stat label="Supplier payables" value={formatCompact(k.payablesDue)} />
        </>}
        {(isBoss || role === "ops") && <>
          <Stat label="Travelling now" value={k.onTrip} icon={<PlaneTakeoff className="size-4" />} />
          <Stat label="Arrivals next 7 days" value={d.arrivals.length} icon={<PlaneLanding className="size-4" />} />
          <Stat label="Services to confirm" value={k.pendingServices} tone={k.pendingServices ? "warn" : "good"} />
        </>}
        {(isBoss || role === "visa") && <Stat label="Open visa cases" value={k.openVisaCases} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {(isBoss || role === "accounts") && (
            <Card><CardTitle title="Revenue vs collections" subtitle="Invoiced sell value and money received, last 6 months" />
              <MonthBars data={d.revenueTrend} series={[{ key: "invoiced", label: "Invoiced", color: "#1d5fd1" }, { key: "collected", label: "Collected", color: "#10b981" }]} />
            </Card>
          )}
          {(isBoss || role === "sales" || role === "marketing") && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Card><CardTitle title="Pipeline" action={<Link to="/app/leads" className="text-sm text-brand-700 hover:underline">Open board</Link>} />
                <Funnel stages={d.pipeline.map((p) => ({ label: titleCase(p.stage), count: p.count, tone: STAGE_COLORS[p.stage] ?? "#64748b" }))} />
              </Card>
              <Card><CardTitle title="Lead sources" subtitle="Last 30 days" />
                <RankBars items={d.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.count }))} />
              </Card>
            </div>
          )}
          {(isBoss || role === "ops") && (
            <div className="grid gap-5 sm:grid-cols-2">
              {[["Arrivals", d.arrivals, PlaneLanding], ["Departures", d.departures, PlaneTakeoff]].map(([title, rows, Icon]) => {
                const list = rows as DashboardData["arrivals"];
                const Ic = Icon as typeof PlaneLanding;
                return (
                  <Card key={String(title)}><CardTitle title={`${title} · next 7 days`} />
                    {list.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">None scheduled.</p> : (
                      <ul className="divide-y divide-line">{list.map((b) => (
                        <li key={b.id} className="py-2"><Link to={`/app/bookings/${b.id}`} className="flex items-center gap-3 text-sm hover:text-brand-700">
                          <Ic className="size-4 text-ink-400" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.contactName}</span><span className="block text-xs text-ink-500">{b.destination} · {b.pax} pax · {b.number}</span></span><span className="text-xs text-ink-600">{formatDate(b.date)}</span>
                        </Link></li>
                      ))}</ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          {(isBoss || role === "visa") && (
            <Card><CardTitle title="Visa desk" action={<Link to="/app/visa" className="text-sm text-brand-700 hover:underline">Open board</Link>} />
              <div className="flex flex-wrap gap-2">{d.visaByStatus.map((v) => <span key={v.status} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"><StatusBadge status={v.status} /><span className="font-semibold">{v.count}</span></span>)}</div>
            </Card>
          )}
          {isBoss && (
            <Card padded={false}>
              <div className="p-4 sm:p-5"><CardTitle title="Team performance" subtitle="Leads owned, won and revenue booked" /></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-ink-500"><tr><th className="px-5 py-2">Name</th><th className="px-3 py-2 text-right">Leads</th><th className="px-3 py-2 text-right">Open</th><th className="px-3 py-2 text-right">Won</th><th className="px-5 py-2 text-right">Revenue</th></tr></thead>
                  <tbody className="divide-y divide-line">{d.staff.map((s) => <tr key={s.userId}><td className="px-5 py-2.5 font-medium">{s.name}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.leads}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.open}</td><td className="px-3 py-2.5 text-right tabular-nums">{s.won}</td><td className="px-5 py-2.5 text-right tabular-nums">{formatCompact(s.revenue)}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card><CardTitle title="My tasks" action={<Link to="/app/tasks" className="text-sm text-brand-700 hover:underline">All</Link>} /><TaskList tasks={d.tasks} /></Card>
          <Card><CardTitle title="Recent activity" /><ActivityFeed items={d.activity} /></Card>
          {(isBoss || role === "sales") && d.destinations.length > 0 && (
            <Card><CardTitle title="Top destinations" /><RankBars color="#7c3aed" items={d.destinations.map((x) => ({ label: x.destination, value: x.count }))} /></Card>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-ink-400">Data mode: {api.mode === "demo" ? "browser demo" : "live server"}</p>
    </div>
  );
}
