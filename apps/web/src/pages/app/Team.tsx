import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LEAD_STAGES } from "@voyadesk/core";
import { useList } from "../../lib/hooks";
import { money, ROLE_LABEL } from "../../lib/format";
import { Avatar, Badge, Card, CardTitle, DataTable, ErrorNote, Loading, PageHeader, Stat } from "../../components/ui";

const MIN = 60_000;
const STAGE_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiation: "Negotiation", won: "Won", lost: "Lost" };

/** "12 min", "3 h 05 m", "2 d" — compact duration for response times. */
export function durationText(ms: number | null): string {
  if (ms === null) return "—";
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} m`;
  return `${Math.round(h / 24)} d`;
}

/** Owner/admin page: how many leads each employee manages and how fast they respond. */
export function TeamPage() {
  const users = useList("users");
  const leads = useList("leads");
  const acts = useList("activities");
  const tasks = useList("tasks");

  const model = useMemo(() => {
    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const today = startOfDay.getTime();
    const staff = (users.data ?? []).filter((u) => u.active && !["agent", "driver"].includes(u.role));
    const rows = staff.map((u) => {
      const mine = (leads.data ?? []).filter((l) => l.ownerId === u.id);
      const open = mine.filter((l) => !["won", "lost"].includes(l.stage));
      // First response = first outbound/human activity on the lead after it was created.
      const gaps: number[] = [];
      for (const l of mine) {
        const first = (acts.data ?? [])
          .filter((a) => a.leadId === l.id && a.byId === u.id && a.kind !== "system" && a.kind !== "quote_view" && a.direction !== "in")
          .map((a) => Date.parse(a.at)).filter((t) => t >= Date.parse(l.createdAt)).sort((a, b) => a - b)[0];
        if (first !== undefined) gaps.push(first - Date.parse(l.createdAt));
      }
      const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
      const todayActs = (acts.data ?? []).filter((a) => a.byId === u.id && a.kind !== "system" && Date.parse(a.at) >= today).length;
      const untouched = open.filter((l) => !l.lastActivityAt || now - Date.parse(l.lastActivityAt) > 2 * 86_400_000).length;
      const overdue = (tasks.data ?? []).filter((t) => t.assigneeId === u.id && !t.done && Date.parse(t.dueAt) < now).length;
      const won = mine.filter((l) => l.stage === "won").length;
      const closed = won + mine.filter((l) => l.stage === "lost").length;
      return {
        id: u.id, name: u.name, role: u.role, title: u.title, total: mine.length, open: open.length, won,
        conv: closed ? Math.round((won / closed) * 100) : null, pipeline: open.reduce((a, l) => a + (l.budget ?? 0), 0),
        avg, todayActs, untouched, overdue, responded: gaps.length,
        stages: LEAD_STAGES.map((s) => mine.filter((l) => l.stage === s).length),
      };
    }).sort((a, b) => b.open - a.open || b.total - a.total);
    const answered = rows.filter((r) => r.avg !== null);
    const teamAvg = answered.length ? answered.reduce((a, r) => a + (r.avg ?? 0), 0) / answered.length : null;
    const fastest = answered.length ? answered.reduce((a, b) => ((a.avg ?? 0) <= (b.avg ?? 0) ? a : b)) : null;
    return { rows, teamAvg, fastest };
  }, [users.data, leads.data, acts.data, tasks.data]);

  if (users.error && !users.data) return <ErrorNote message={users.error.message} onRetry={users.reload} />;
  const loading = !users.data || !leads.data || !acts.data || !tasks.data;
  const { rows, teamAvg, fastest } = model;
  return (
    <div className="space-y-5">
      <PageHeader title="Team performance" subtitle="Leads each employee is managing right now and how quickly they respond." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees" value={rows.length} />
        <Stat label="Open leads" value={rows.reduce((a, r) => a + r.open, 0)} />
        <Stat label="Avg first response" value={durationText(teamAvg)} hint="Lead created → first staff action" />
        <Stat label="Fastest" value={fastest ? fastest.name : "—"} tone="good" hint={fastest ? durationText(fastest.avg) : undefined} />
      </div>
      <Card padded={false}>
        <div className="p-4 sm:p-5"><CardTitle title="Per employee" subtitle="Click a name to open their leads." /></div>
        {loading ? <Loading /> : (
          <DataTable rows={rows} empty="No staff yet." search={(r) => r.name} columns={[
            { key: "n", header: "Employee", sort: (r) => r.name, render: (r) => <Link to={`/app/leads?staff=${r.id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar name={r.name} size={6} /><span><span className="font-medium">{r.name}</span><span className="block text-xs text-ink-500">{r.title || ROLE_LABEL[r.role] || r.role}</span></span></Link> },
            { key: "o", header: "Open leads", align: "right", sort: (r) => r.open, render: (r) => r.open },
            { key: "t", header: "Total", align: "right", sort: (r) => r.total, render: (r) => r.total, hideOnMobile: true },
            { key: "w", header: "Won", align: "right", sort: (r) => r.won, render: (r) => r.won, hideOnMobile: true },
            { key: "c", header: "Win rate", align: "right", sort: (r) => r.conv ?? -1, render: (r) => (r.conv === null ? "—" : `${r.conv}%`), hideOnMobile: true },
            { key: "a", header: "Avg response", align: "right", sort: (r) => r.avg ?? Number.MAX_SAFE_INTEGER, render: (r) => <Badge tone={r.avg === null ? "gray" : r.avg <= 30 * MIN ? "green" : r.avg <= 4 * 60 * MIN ? "amber" : "red"}>{durationText(r.avg)}</Badge> },
            { key: "d", header: "Actions today", align: "right", sort: (r) => r.todayActs, render: (r) => r.todayActs },
            { key: "u", header: "Needs attention", align: "right", sort: (r) => r.untouched + r.overdue, render: (r) => (r.untouched + r.overdue === 0 ? "—" : <span className="text-rose-700">{r.untouched} idle · {r.overdue} overdue</span>), hideOnMobile: true },
            { key: "p", header: "Pipeline value", align: "right", sort: (r) => r.pipeline, render: (r) => money(r.pipeline), hideOnMobile: true },
          ]} />
        )}
      </Card>
      {!loading && rows.length > 0 && (
        <Card>
          <CardTitle title="Pipeline by employee" subtitle="Where each person's leads sit across the stages." />
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-1.5 pr-3">Employee</th>{LEAD_STAGES.map((s) => <th key={s} className="px-2 text-right">{STAGE_LABEL[s]}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.id}><td className="py-1.5 pr-3 font-medium">{r.name}</td>{r.stages.map((n, i) => <td key={i} className="px-2 text-right tabular-nums">{n}</td>)}</tr>)}</tbody></table></div>
        </Card>
      )}
    </div>
  );
}
