import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Search } from "lucide-react";
import { formatDate } from "@voyadesk/core";
import { useList, useReport } from "../../lib/hooks";
import { money, titleCase } from "../../lib/format";
import { Badge, Card, CardTitle, DataTable, ErrorNote, Input, Loading, PageHeader, Stat, StatusBadge, Tabs } from "../../components/ui";

export interface TrackRow {
  bookingId: string; number: string; tourCode: string; contactName: string; phone: string; destination: string; startDate: string; endDate: string;
  days: number; bookingType: string; ownerId: string | null; staffName: string; total: number; advance: number; balance: number; balanceDue: string;
  daysToTravel: number; daysToBalanceDue: number; status: "paid" | "overdue" | "due_soon" | "advance_received" | "no_advance"; invoiceId: string | null; needsReminder: boolean;
}
export interface TrackingData {
  today: string; balanceDueDaysBefore: number; reminderEveryDays: number; rows: TrackRow[]; reminders: TrackRow[];
  totals: { total: number; advance: number; balance: number; overdue: number; dueSoon: number; noAdvance: number };
}

export const TRACK_LABEL: Record<TrackRow["status"], string> = {
  paid: "Fully paid", overdue: "Balance overdue", due_soon: "Balance due soon", advance_received: "Advance received", no_advance: "No advance yet",
};
const TONE: Record<TrackRow["status"], "green" | "red" | "amber" | "blue" | "gray"> = { paid: "green", overdue: "red", due_soon: "amber", advance_received: "blue", no_advance: "gray" };

export function TrackBadge({ status }: { status: TrackRow["status"] }) {
  return <Badge tone={TONE[status]}>{TRACK_LABEL[status]}</Badge>;
}

/** Plain-language line for "when" — used in the table and the reminder pop-up. */
export function dueText(r: TrackRow): string {
  if (r.balance <= 0) return "Paid in full";
  if (r.daysToBalanceDue < 0) return `Balance was due ${-r.daysToBalanceDue} day${r.daysToBalanceDue === -1 ? "" : "s"} ago`;
  if (r.daysToBalanceDue === 0) return "Balance due today";
  return `Balance due in ${r.daysToBalanceDue} day${r.daysToBalanceDue === 1 ? "" : "s"} (${formatDate(r.balanceDue)})`;
}

export function whatsappReminderLink(r: TrackRow, company: string): string | null {
  const digits = r.phone.replace(/\D/g, "");
  if (!digits) return null;
  const text = `Hi ${r.contactName.split(" ")[0]}, this is ${company}. A gentle reminder for your ${r.destination || "trip"} (${r.tourCode || r.number}) starting ${formatDate(r.startDate)}: the balance of ${money(r.balance)} is due by ${formatDate(r.balanceDue)}. Please let us know once paid. Thank you!`;
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

/** Payment tracking: total cost, advance received, balance and when it is due — for every trip. */
export function PaymentTrackingPage() {
  const r = useReport<TrackingData>("paymentTracking");
  const nav = useNavigate();
  const [tab, setTab] = useState<"open" | TrackRow["status"] | "all">("open");
  const rows = useMemo(() => (r.data?.rows ?? []).filter((x) => (tab === "all" ? true : tab === "open" ? x.balance > 0 : x.status === tab)), [r.data, tab]);
  if (r.error && !r.data) return <ErrorNote message={r.error.message} onRetry={r.reload} />;
  if (!r.data) return <Loading />;
  const t = r.data.totals;
  const count = (s: TrackRow["status"]) => r.data!.rows.filter((x) => x.status === s).length;
  return (
    <div className="space-y-5">
      <PageHeader title="Payment tracking" subtitle={`Total cost, advance received and balance for every trip. The balance is due ${r.data.balanceDueDaysBefore} days before travel; you get a reminder pop-up every ${r.data.reminderEveryDays} days until it is paid.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total cost of trips" value={money(t.total)} />
        <Stat label="Advance / paid" value={money(t.advance)} tone="good" />
        <Stat label="Balance to collect" value={money(t.balance)} tone={t.balance > 0 ? "warn" : "good"} />
        <Stat label="Overdue balances" value={t.overdue} tone={t.overdue ? "bad" : "good"} hint={`${t.dueSoon} due within 7 days · ${t.noAdvance} with no advance`} />
      </div>
      <Tabs tabs={[
        { key: "open", label: "To collect", count: r.data.rows.filter((x) => x.balance > 0).length },
        { key: "overdue", label: "Overdue", count: count("overdue") }, { key: "due_soon", label: "Due soon", count: count("due_soon") },
        { key: "no_advance", label: "No advance", count: count("no_advance") }, { key: "advance_received", label: "Advance received", count: count("advance_received") },
        { key: "paid", label: "Paid", count: count("paid") }, { key: "all", label: "All" },
      ]} value={tab} onChange={setTab} />
      <DataTable rows={rows.map((x) => ({ ...x, id: x.bookingId }))} onRowClick={(x) => nav(`/app/bookings/${x.bookingId}`)} initialSort={{ key: "due", dir: "asc" }}
        search={(x) => `${x.tourCode} ${x.number} ${x.contactName} ${x.phone} ${x.destination} ${x.staffName}`} empty="Nothing to show here." columns={[
          { key: "code", header: "Tour code", sort: (x) => x.tourCode, render: (x) => <span><span className="font-medium">{x.tourCode || "—"}</span><span className="block text-xs text-ink-500">{x.number}</span></span> },
          { key: "cust", header: "Customer", sort: (x) => x.contactName, render: (x) => <span>{x.contactName}<span className="block text-xs text-ink-500">{x.destination} · {x.days} days</span></span> },
          { key: "travel", header: "Travel date", sort: (x) => x.startDate, render: (x) => <span>{formatDate(x.startDate)}<span className="block text-xs text-ink-500">{x.daysToTravel >= 0 ? `in ${x.daysToTravel} days` : "started"}</span></span>, hideOnMobile: true },
          { key: "total", header: "Total cost", align: "right", sort: (x) => x.total, render: (x) => money(x.total) },
          { key: "adv", header: "Advance received", align: "right", sort: (x) => x.advance, render: (x) => money(x.advance) },
          { key: "bal", header: "Balance", align: "right", sort: (x) => x.balance, render: (x) => <span className={x.balance > 0 ? "font-medium" : "text-ink-500"}>{money(x.balance)}</span> },
          { key: "due", header: "Balance due", sort: (x) => x.balanceDue, render: (x) => <span>{x.balance > 0 ? formatDate(x.balanceDue) : "—"}<span className="block text-xs text-ink-500">{dueText(x)}</span></span>, hideOnMobile: true },
          { key: "staff", header: "Staff", sort: (x) => x.staffName, render: (x) => x.staffName, hideOnMobile: true },
          { key: "st", header: "Status", render: (x) => <TrackBadge status={x.status} /> },
        ]} />
    </div>
  );
}

/** Trip tracker: find any itinerary by tour code or the traveller's name, and see where it stands. */
export function TripTrackerPage() {
  const quotes = useList("quotes");
  const users = useList("users");
  const tracking = useReport<TrackingData>("paymentTracking");
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const byBooking = useMemo(() => new Map((tracking.data?.rows ?? []).map((r) => [r.bookingId, r])), [tracking.data]);
  const rows = useMemo(() => (quotes.data ?? []).map((x) => {
    const t = x.bookingId ? byBooking.get(x.bookingId) : undefined;
    return {
      id: x.id, tourCode: x.tourCode, number: x.number, contactName: x.contactName, phone: x.phone, destination: x.destination, startDate: x.startDate, nights: x.nights,
      bookingType: x.bookingType, staff: users.data?.find((u) => u.id === (x.preparedById ?? x.ownerId))?.name ?? "—", total: t?.total ?? x.total, advance: t?.advance ?? 0, balance: t ? t.balance : x.total,
      stage: t ? "Booked" : titleCase(x.status), bookingId: x.bookingId, quoteStatus: x.status, track: t,
    };
  }).sort((a, b) => (a.startDate ?? "9") < (b.startDate ?? "9") ? -1 : 1), [quotes.data, users.data, byBooking]);
  const needle = q.trim().toLowerCase();
  const hits = needle ? rows.filter((r) => `${r.tourCode} ${r.number} ${r.contactName} ${r.phone} ${r.destination} ${r.staff}`.toLowerCase().includes(needle)) : rows;
  if (quotes.error && !quotes.data) return <ErrorNote message={quotes.error.message} onRetry={quotes.reload} />;
  return (
    <div className="space-y-5">
      <PageHeader title="Trip tracker" subtitle="Type a tour code (e.g. BAL-2612-001) or the traveller's name to see the itinerary, staff, cost and payment status." />
      <Card>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" /><Input autoFocus aria-label="Search by tour code or name" className="pl-9" placeholder="Tour code or customer name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <p className="mt-2 text-xs text-ink-500">{needle ? `${hits.length} match${hits.length === 1 ? "" : "es"}` : `${rows.length} itineraries`}</p>
      </Card>
      {!quotes.data ? <Loading /> : (
        <Card padded={false}>
          <div className="p-4 sm:p-5"><CardTitle title="Itineraries" /></div>
          <DataTable rows={hits} onRowClick={(r) => nav(`/app/quotes/${r.id}`)} empty="No itinerary matches." columns={[
            { key: "code", header: "Tour code", sort: (r) => r.tourCode, render: (r) => <span><span className="font-medium">{r.tourCode || "—"}</span><span className="block text-xs text-ink-500">{r.number}</span></span> },
            { key: "cust", header: "Customer", sort: (r) => r.contactName, render: (r) => <span>{r.contactName}<span className="block text-xs text-ink-500">{r.phone}</span></span> },
            { key: "trip", header: "Trip", render: (r) => <span>{r.destination || "—"}<span className="block text-xs text-ink-500">{r.nights + 1} days · {r.bookingType ? titleCase(r.bookingType) : "type not set"}</span></span>, hideOnMobile: true },
            { key: "start", header: "Travel date", sort: (r) => r.startDate ?? "", render: (r) => formatDate(r.startDate) },
            { key: "staff", header: "Staff", render: (r) => r.staff, hideOnMobile: true },
            { key: "total", header: "Total cost", align: "right", sort: (r) => r.total, render: (r) => money(r.total) },
            { key: "pay", header: "Advance / balance", align: "right", hideOnMobile: true, render: (r) => (r.track ? <span>{money(r.advance)}<span className="block text-xs text-ink-500">balance {money(r.balance)}</span></span> : "—") },
            { key: "stage", header: "Stage", render: (r) => r.track ? <span className="inline-flex flex-col items-start gap-0.5"><StatusBadge status="confirmed" label="Booked" /><TrackBadge status={r.track.status} /></span> : <StatusBadge status={r.quoteStatus} /> },
          ]} />
        </Card>
      )}
      <p className="text-xs text-ink-500">Booked trips open the itinerary; the booking file is linked inside. <Link to="/app/tracking" className="text-brand-700 underline">See payment tracking</Link>.</p>
    </div>
  );
}
