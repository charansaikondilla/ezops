import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useList } from "../../lib/hooks";
import { money, ROLE_LABEL } from "../../lib/format";
import { Avatar, Card, CardTitle, DataTable, ErrorNote, Loading, PageHeader, Stat, StatusBadge } from "../../components/ui";
import { TeamTab } from "./Settings";

/** Separate page for staff / team management: people and roles, plus what each person is handling. */
export function StaffPage() {
  const users = useList("users");
  const leads = useList("leads");
  const bookings = useList("bookings");
  const rows = useMemo(() => {
    const staff = (users.data ?? []).filter((u) => !["agent", "driver"].includes(u.role));
    return staff.map((u) => {
      const mine = (leads.data ?? []).filter((l) => l.ownerId === u.id);
      const trips = (bookings.data ?? []).filter((b) => b.ownerId === u.id && b.status !== "cancelled");
      return {
        id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, title: u.title,
        leads: mine.length, open: mine.filter((l) => !["won", "lost"].includes(l.stage)).length, won: mine.filter((l) => l.stage === "won").length,
        bookings: trips.length, revenue: trips.reduce((a, b) => a + b.sellTotal, 0),
      };
    }).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
  }, [users.data, leads.data, bookings.data]);

  if (users.error && !users.data) return <ErrorNote message={users.error.message} onRetry={users.reload} />;
  const active = rows.filter((r) => r.active);
  return (
    <div className="space-y-5">
      <PageHeader title="Staff & team" subtitle="Everyone who works in the system: roles, access and what each person is handling." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active staff" value={active.length} />
        <Stat label="Open leads" value={rows.reduce((a, r) => a + r.open, 0)} />
        <Stat label="Bookings handled" value={rows.reduce((a, r) => a + r.bookings, 0)} />
        <Stat label="Sales (ex-tax)" value={money(rows.reduce((a, r) => a + r.revenue, 0))} tone="good" />
      </div>
      <Card padded={false}>
        <div className="p-4 sm:p-5"><CardTitle title="Who is handling what" subtitle="Click a person to see their leads." /></div>
        {!leads.data || !bookings.data || !users.data ? <Loading /> : (
          <DataTable rows={rows} search={(r) => `${r.name} ${r.email} ${r.role}`} empty="No staff yet." columns={[
            { key: "n", header: "Staff", sort: (r) => r.name, render: (r) => <Link to={`/app/leads?staff=${r.id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar name={r.name} size={6} /><span><span className="font-medium">{r.name}</span><span className="block text-xs text-ink-500">{r.title || r.email}</span></span></Link> },
            { key: "r", header: "Role", render: (r) => ROLE_LABEL[r.role] ?? r.role },
            { key: "l", header: "Leads", align: "right", sort: (r) => r.leads, render: (r) => r.leads },
            { key: "o", header: "Open", align: "right", sort: (r) => r.open, render: (r) => r.open, hideOnMobile: true },
            { key: "w", header: "Won", align: "right", sort: (r) => r.won, render: (r) => r.won, hideOnMobile: true },
            { key: "b", header: "Bookings", align: "right", sort: (r) => r.bookings, render: (r) => r.bookings },
            { key: "v", header: "Sales", align: "right", sort: (r) => r.revenue, render: (r) => money(r.revenue) },
            { key: "s", header: "Status", render: (r) => <StatusBadge status={r.active ? "active" : "inactive"} /> },
          ]} />
        )}
      </Card>
      <TeamTab />
    </div>
  );
}
