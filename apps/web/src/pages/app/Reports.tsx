import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { formatDate, formatMonth, makeXlsx } from "@voyadesk/core";
import { useList, useReport } from "../../lib/hooks";
import { XLSX_MIME, downloadBytes } from "../../lib/files";
import { formatCompact, money, SOURCE_LABEL, titleCase } from "../../lib/format";
import { Button, Card, CardTitle, ErrorNote, Field, Input, Loading, PageHeader, Select, Stat } from "../../components/ui";
import { TrackBadge, type TrackRow } from "./Tracking";
import { MonthBars, RankBars } from "../../components/charts";
import { type DashboardData } from "./Dashboard";

interface PnlData { rows: { key: string; label: string; bookings: number; sell: number; cost: number; margin: number; marginPct: number }[]; totals: { bookings: number; sell: number; cost: number; margin: number } }
interface VisaData { byCountry: { country: string; total: number; approved: number; rejected: number; open: number; revenue: number }[]; total: number }

interface RegisterData { rows: TrackRow[]; totals: { count: number; total: number; advance: number; balance: number; days: number } }

/** Booking register: one line per trip with the staff name, date of travel and number of days. Filter, then export to Excel. */
function BookingRegister() {
  const users = useList("users");
  const [f, setF] = useState({ from: "", to: "", ownerId: "", destination: "", minDays: "", maxDays: "", q: "" });
  const params = useMemo(() => ({
    from: f.from || null, to: f.to || null, ownerId: f.ownerId || null, destination: f.destination || undefined,
    minDays: f.minDays ? Number(f.minDays) : null, maxDays: f.maxDays ? Number(f.maxDays) : null, q: f.q || undefined,
  }), [f]);
  const reg = useReport<RegisterData>("bookingRegister", params);
  const all = useReport<RegisterData>("bookingRegister", {});
  const destinations = useMemo(() => [...new Set((all.data?.rows ?? []).map((r) => r.destination).filter(Boolean))].sort(), [all.data]);
  const staff = (users.data ?? []).filter((u) => u.active && !["agent", "driver"].includes(u.role));
  const exportXlsx = () => {
    if (!reg.data) return;
    const head = ["Tour code", "Booking no.", "Customer", "Phone", "Destination", "Name of the staff", "Date of travel", "Return date", "No. of days", "Booking type", "Total cost (INR)", "Advance received (INR)", "Balance (INR)", "Balance due by", "Payment status"];
    const rows = reg.data.rows.map((r) => [r.tourCode, r.number, r.contactName, r.phone, r.destination, r.staffName, r.startDate, r.endDate, r.days, r.bookingType ? titleCase(r.bookingType) : "", r.total / 100, r.advance / 100, r.balance / 100, r.balance > 0 ? r.balanceDue : "", r.status.replace(/_/g, " ")]);
    downloadBytes(`Booking register ${new Date().toISOString().slice(0, 10)}.xlsx`, makeXlsx([{ name: "Booking register", rows: [head, ...rows] }]), XLSX_MIME);
  };
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
        <CardTitle title="Booking register" subtitle="By name of staff, date of travel and number of days" />
        <Button variant="secondary" size="sm" icon={<Download className="size-4" />} disabled={!reg.data || reg.data.rows.length === 0} onClick={exportXlsx}>Export to Excel</Button>
      </div>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <Field label="Name of the staff"><Select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">All staff</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Travelling from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Travelling to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Destination"><Select value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })}><option value="">All destinations</option>{destinations.map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="No. of days: at least"><Input type="number" min={1} value={f.minDays} onChange={(e) => setF({ ...f, minDays: e.target.value })} /></Field>
        <Field label="No. of days: at most"><Input type="number" min={1} value={f.maxDays} onChange={(e) => setF({ ...f, maxDays: e.target.value })} /></Field>
        <Field label="Search tour code, customer" className="sm:col-span-2"><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="BAL-2612-001 or a name" /></Field>
      </div>
      {!reg.data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:px-5 lg:grid-cols-4">
            <Stat label="Trips" value={reg.data.totals.count} hint={`${reg.data.totals.days} travel days`} />
            <Stat label="Total cost" value={formatCompact(reg.data.totals.total)} />
            <Stat label="Advance received" value={formatCompact(reg.data.totals.advance)} tone="good" />
            <Stat label="Balance" value={formatCompact(reg.data.totals.balance)} tone={reg.data.totals.balance ? "warn" : "good"} />
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-ink-500"><tr><th className="px-5 py-2">Tour code</th><th className="px-3">Customer</th><th className="px-3">Name of the staff</th><th className="px-3">Date of travel</th><th className="px-3 text-right">No. of days</th><th className="px-3">Destination</th><th className="px-3 text-right">Total cost</th><th className="px-3 text-right">Advance</th><th className="px-3 text-right">Balance</th><th className="px-5">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {reg.data.rows.map((r) => <tr key={r.bookingId}><td className="px-5 py-2.5 font-medium">{r.tourCode || r.number}</td><td className="px-3">{r.contactName}</td><td className="px-3">{r.staffName}</td><td className="whitespace-nowrap px-3">{formatDate(r.startDate)}</td><td className="px-3 text-right">{r.days}</td><td className="px-3">{r.destination}</td><td className="px-3 text-right tabular-nums">{money(r.total)}</td><td className="px-3 text-right tabular-nums">{money(r.advance)}</td><td className="px-3 text-right tabular-nums">{money(r.balance)}</td><td className="px-5"><TrackBadge status={r.status} /></td></tr>)}
              {reg.data.rows.length === 0 && <tr><td colSpan={10} className="px-5 py-8 text-center text-ink-500">No trips match these filters.</td></tr>}
            </tbody></table></div>
        </>
      )}
    </Card>
  );
}

export function ReportsPage() {
  const [groupBy, setGroupBy] = useState("destination");
  const pnl = useReport<PnlData>("pnl", { groupBy });
  const dash = useReport<DashboardData>("dashboard");
  const visa = useReport<VisaData>("visa");
  if (pnl.error && !pnl.data) return <ErrorNote message={pnl.error.message} />;
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Profit, growth and team performance from the same records your team works on." />
      {pnl.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Bookings" value={pnl.data.totals.bookings} />
          <Stat label="Sales (ex-tax)" value={formatCompact(pnl.data.totals.sell)} />
          <Stat label="Supplier cost" value={formatCompact(pnl.data.totals.cost)} />
          <Stat label="Gross margin" value={formatCompact(pnl.data.totals.margin)} tone="good" hint={pnl.data.totals.sell ? `${((pnl.data.totals.margin / pnl.data.totals.sell) * 100).toFixed(1)}% of sales` : undefined} />
        </div>
      )}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
          <CardTitle title="Profit & loss" subtitle="Non-cancelled bookings, by travel date" />
          <Select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-48"><option value="destination">By destination</option><option value="owner">By name of staff</option><option value="days">By number of days</option><option value="bookingType">By booking type</option><option value="agent">By agent / direct</option><option value="month">By month</option><option value="booking">By booking file</option></Select>
        </div>
        {!pnl.data ? <Loading /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-ink-500"><tr><th className="px-5 py-2">{({ owner: "Name of staff", days: "No. of days", bookingType: "Booking type", month: "Month of travel" } as Record<string, string>)[groupBy] ?? titleCase(groupBy)}</th><th className="px-3 text-right">Files</th><th className="px-3 text-right">Sales</th><th className="px-3 text-right">Cost</th><th className="px-3 text-right">Margin</th><th className="px-5 text-right">Margin %</th></tr></thead>
            <tbody className="divide-y divide-line">{pnl.data.rows.map((r) => <tr key={r.key}><td className="px-5 py-2.5 font-medium">{groupBy === "month" ? formatMonth(r.label) : r.label}</td><td className="px-3 text-right">{r.bookings}</td><td className="px-3 text-right tabular-nums">{money(r.sell)}</td><td className="px-3 text-right tabular-nums">{money(r.cost)}</td><td className="px-3 text-right tabular-nums text-emerald-700">{money(r.margin)}</td><td className="px-5 text-right">{r.marginPct}%</td></tr>)}</tbody></table></div>
        )}
      </Card>
      <BookingRegister />
      {dash.data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardTitle title="Revenue trend" /><MonthBars data={dash.data.revenueTrend} series={[{ key: "invoiced", label: "Invoiced", color: "#1d5fd1" }, { key: "collected", label: "Collected", color: "#10b981" }]} /></Card>
          <Card><CardTitle title="Lead sources (30 days)" /><RankBars items={dash.data.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.count }))} /></Card>
          <Card><CardTitle title="Revenue by sales person" /><RankBars color="#7c3aed" format={formatCompact} items={dash.data.staff.map((s) => ({ label: s.name, value: s.revenue }))} /></Card>
          {visa.data && <Card><CardTitle title="Visa by country" /><RankBars color="#0891b2" items={visa.data.byCountry.map((c) => ({ label: `${c.country} (${c.approved} approved, ${c.open} open)`, value: c.total }))} /></Card>}
        </div>
      )}
    </div>
  );
}
