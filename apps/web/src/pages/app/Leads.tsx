import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText, LayoutGrid, List, MessageCircle, Phone, Plus, Sparkles } from "lucide-react";
import { BOOKING_TYPES, LEAD_SOURCES, LEAD_STAGES, formatDate, type Lead, type Quote } from "@voyadesk/core";
import { api } from "../../lib/api";
import { useAction, useList, useMutation, useOne } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { money, relTime, SOURCE_LABEL, titleCase } from "../../lib/format";
import {
  Avatar, Badge, Button, Callout, Card, CardTitle, DataTable, ErrorNote, Field, Input, KeyValue, Loading, Modal, MoneyInput,
  PageHeader, Select, StatusBadge, Tabs, Textarea, cx,
} from "../../components/ui";
import { ActivityFeed, TaskList } from "./Dashboard";

const STAGE_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiation: "Negotiation", won: "Won", lost: "Lost" };

type LeadForm = { source: string; sourceDetail: string; referredBy: string };

/** Extra input for the chosen source: what "Other" means, or who referred the customer. */
function SourceExtra<T extends LeadForm>({ f, setF }: { f: T; setF: (v: T) => void }) {
  if (f.source === "other") return <Field label="Source — please specify" required><Input value={f.sourceDetail} onChange={(e) => setF({ ...f, sourceDetail: e.target.value })} placeholder="e.g. Travel expo, newspaper ad, hoarding" /></Field>;
  if (f.source === "referral") return <Field label="Referred by" hint="Name or phone of the person who referred this customer"><Input value={f.referredBy} onChange={(e) => setF({ ...f, referredBy: e.target.value })} placeholder="e.g. Ravi Kumar, +91 98xxx xxxxx" /></Field>;
  return null;
}

export function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { act, busy, fieldErrors } = useAction();
  const [mode, setMode] = useState<"form" | "paste">("form");
  const blank = { name: "", phone: "", email: "", source: "website", sourceDetail: "", referredBy: "", service: "holiday", destination: "", travelDate: "", nights: "", days: "", bookingType: "", adults: "2", children: "0", budget: null as number | null, notes: "", text: "" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const submit = async () => {
    const input = mode === "paste"
      ? { text: f.text, name: f.name || undefined, phone: f.phone || undefined, source: f.source, sourceDetail: f.sourceDetail || undefined, referredBy: f.referredBy || undefined }
      : {
          name: f.name, phone: f.phone || undefined, email: f.email || undefined, source: f.source, service: f.service, destination: f.destination || undefined,
          travelDate: f.travelDate || null, nights: f.nights ? Number(f.nights) : null, days: f.days ? Number(f.days) : null, sourceDetail: f.sourceDetail || undefined, referredBy: f.referredBy || undefined, bookingType: f.bookingType || undefined, adults: Number(f.adults) || 1, children: Number(f.children) || 0, budget: f.budget, notes: f.notes || undefined,
        };
    const r = await act<{ lead: Lead; duplicate: boolean }>("captureLead", input, (x) => (x.duplicate ? "This person already had an open lead — it was updated instead" : "Lead created and assigned"));
    if (r) {
      onClose();
      nav(`/app/leads/${r.lead.id}`);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="New lead" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={submit}>Create lead</Button></>}>
      <Tabs tabs={[{ key: "form", label: "Fill in details" }, { key: "paste", label: <span className="inline-flex items-center gap-1"><Sparkles className="size-4" />Paste a message</span> }]} value={mode} onChange={setMode} />
      {mode === "paste" ? (
        <div className="space-y-4">
          <Field label="Customer's message" hint={'e.g. "5N Dubai, 4 pax, 27 Jan, budget 1.2L, 4 star" — destination, nights, travellers, date and budget are picked out automatically.'}>
            <Textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={4} placeholder="Paste a WhatsApp or email enquiry" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Phone"><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</Select></Field>
          </div>
          <SourceExtra f={f} setF={setF} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={fieldErrors["name"]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone" error={fieldErrors["phone"]}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 98765 43210" /></Field>
          <Field label="Email" error={fieldErrors["email"]}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</Select></Field>
          <SourceExtra f={f} setF={setF} />
          <Field label="Service"><Select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{["holiday", "visa", "flight", "hotel", "transfer"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
          <Field label="Destination"><Input value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} placeholder="e.g. Dubai" /></Field>
          <Field label="Travel date" error={fieldErrors["travelDate"]}><Input type="date" value={f.travelDate} onChange={(e) => setF({ ...f, travelDate: e.target.value })} /></Field>
          <Field label="Days"><Input type="number" min={1} max={91} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value, nights: e.target.value ? String(Math.max(0, Number(e.target.value) - 1)) : "" })} /></Field>
          <Field label="Nights"><Input type="number" min={0} max={90} value={f.nights} onChange={(e) => setF({ ...f, nights: e.target.value, days: e.target.value ? String(Number(e.target.value) + 1) : "" })} /></Field>
          <Field label="Booking type"><Select value={f.bookingType} onChange={(e) => setF({ ...f, bookingType: e.target.value })}><option value="">Select…</option>{BOOKING_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></Field>
          <Field label="Adults"><Input type="number" min={1} value={f.adults} onChange={(e) => setF({ ...f, adults: e.target.value })} /></Field>
          <Field label="Children"><Input type="number" min={0} value={f.children} onChange={(e) => setF({ ...f, children: e.target.value })} /></Field>
          <Field label="Budget (total)"><MoneyInput value={f.budget} onChange={(v) => setF({ ...f, budget: v })} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      )}
    </Modal>
  );
}

function LeadCard({ lead, owner }: { lead: Lead; owner?: string | undefined }) {
  return (
    <Link to={`/app/leads/${lead.id}`} className="block rounded-xl border border-line bg-white p-3 shadow-xs transition hover:border-brand-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate font-medium text-ink-900">{lead.name}</div><div className="truncate text-xs text-ink-500">{lead.destination || titleCase(lead.service)} · {lead.pax.adults + lead.pax.children} pax</div></div>
        <StatusBadge status={lead.temperature} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
        <span>{lead.travelDate ? formatDate(lead.travelDate) : "Date TBD"}</span>
        <span>{lead.budget ? money(lead.budget) : ""}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink-400">{SOURCE_LABEL[lead.source]} · {relTime(lead.lastActivityAt ?? lead.createdAt)}</span>
        {owner && <Avatar name={owner} size={6} />}
      </div>
    </Link>
  );
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
  const leads = useList("leads");
  const users = useList("users");
  const [view, setView] = useState<"board" | "list">(() => (window.innerWidth < 768 ? "list" : "board"));
  const [who, setWho] = useState<"all" | "mine">("all");
  const [temp, setTemp] = useState("");
  const [staff, setStaff] = useState(params.get("staff") ?? "");
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const newOpen = params.get("new") === "1";
  const ownerName = (id: string | null) => users.data?.find((u) => u.id === id)?.name;

  const rows = useMemo(() => (leads.data ?? []).filter((l) =>
    (who === "all" || l.ownerId === user?.id) && (!staff || l.ownerId === staff) && (!temp || l.temperature === temp) &&
    (!q || `${l.name} ${l.destination} ${l.phone} ${l.email} ${l.referredBy} ${l.sourceDetail}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.score - a.score), [leads.data, who, temp, staff, q, user?.id]);

  return (
    <div>
      <PageHeader title="Leads" subtitle="Every enquiry, scored and assigned. Hot leads first." actions={<>
        <div className="flex rounded-lg border border-line bg-white p-0.5">
          <button onClick={() => setView("board")} aria-pressed={view === "board"} className={cx("rounded-md px-2.5 py-1.5", view === "board" && "bg-slate-100")} aria-label="Board view"><LayoutGrid className="size-4" /></button>
          <button onClick={() => setView("list")} aria-pressed={view === "list"} className={cx("rounded-md px-2.5 py-1.5", view === "list" && "bg-slate-100")} aria-label="List view"><List className="size-4" /></button>
        </div>
        <Button icon={<Plus className="size-4" />} onClick={() => setParams({ new: "1" })}>New lead</Button>
      </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input aria-label="Search leads" placeholder="Search name, phone, destination, referral…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Owner filter" value={who} onChange={(e) => setWho(e.target.value as "all" | "mine")} className="w-auto"><option value="all">Everyone's leads</option><option value="mine">My leads</option></Select>
        <Select aria-label="Staff filter" value={staff} onChange={(e) => setStaff(e.target.value)} className="w-auto"><option value="">All staff</option>{(users.data ?? []).filter((u) => u.active && !["agent", "driver"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Select aria-label="Temperature filter" value={temp} onChange={(e) => setTemp(e.target.value)} className="w-auto"><option value="">All temperatures</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></Select>
      </div>
      {leads.error && !leads.data ? <ErrorNote message={leads.error.message} onRetry={leads.reload} /> : !leads.data ? <Loading /> : view === "board" ? (
        <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-3 sm:mx-0 sm:px-0">
          {LEAD_STAGES.map((stage) => {
            const col = rows.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-72 shrink-0 rounded-xl bg-slate-100/70 p-2">
                <div className="mb-2 flex items-center justify-between px-1.5 pt-1"><span className="text-sm font-semibold text-ink-700">{STAGE_LABEL[stage]}</span><Badge>{col.length}</Badge></div>
                <div className="mb-2 px-1.5 text-xs text-ink-500">{money(col.reduce((a, l) => a + (l.budget ?? 0), 0))} total</div>
                <div className="space-y-2">{col.map((l) => <LeadCard key={l.id} lead={l} owner={ownerName(l.ownerId)} />)}{col.length === 0 && <div className="py-6 text-center text-xs text-ink-400">Empty</div>}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable rows={rows} onRowClick={(l) => nav(`/app/leads/${l.id}`)} columns={[
          { key: "name", header: "Lead", render: (l) => <span><span className="font-medium">{l.name}</span><span className="block text-xs text-ink-500">{l.phone || l.email}</span></span>, sort: (l) => l.name },
          { key: "dest", header: "Trip", render: (l) => `${l.destination || titleCase(l.service)} · ${l.pax.adults + l.pax.children} pax`, sort: (l) => l.destination },
          { key: "date", header: "Travel", render: (l) => formatDate(l.travelDate), sort: (l) => l.travelDate ?? "9" },
          { key: "stage", header: "Stage", render: (l) => <StatusBadge status={l.stage} />, sort: (l) => LEAD_STAGES.indexOf(l.stage) },
          { key: "score", header: "Score", render: (l) => <span className="inline-flex items-center gap-1.5"><StatusBadge status={l.temperature} />{l.score}</span>, sort: (l) => l.score, align: "right" },
          { key: "owner", header: "Handled by", render: (l) => ownerName(l.ownerId) ?? "Unassigned", sort: (l) => ownerName(l.ownerId) ?? "", hideOnMobile: true },
          { key: "src", header: "Source", render: (l) => <span>{SOURCE_LABEL[l.source]}{(l.sourceDetail || l.referredBy) && <span className="block text-xs text-ink-500">{l.sourceDetail || `by ${l.referredBy}`}</span>}</span>, hideOnMobile: true },
          { key: "type", header: "Type", render: (l) => (l.bookingType ? titleCase(l.bookingType) : "—"), hideOnMobile: true },
        ]} />
      )}
      <NewLeadModal open={newOpen} onClose={() => setParams({})} />
    </div>
  );
}

function LostModal({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const { act, busy } = useAction();
  const [reason, setReason] = useState("Price");
  const [other, setOther] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Mark lead as lost" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" busy={busy} onClick={async () => { const r = await act("updateLeadStage", { leadId: lead.id, stage: "lost", lostReason: reason === "Other" ? other : reason }, "Lead marked lost"); if (r) onClose(); }}>Mark lost</Button></>}>
      <Field label="Why was it lost?"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{["Price", "Booked elsewhere", "Dates changed", "No response", "Trip cancelled", "Other"].map((r) => <option key={r}>{r}</option>)}</Select></Field>
      {reason === "Other" && <Field label="Reason" className="mt-3"><Input value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
    </Modal>
  );
}

/** Admin-only: who handled this lead and what each person did, newest first, with staff names. */
function HandlingHistory({ lead, items, users }: { lead: Lead; items: { id: string; at: string; kind: string; body: string; byId: string | null }[]; users: { id: string; name: string }[] }) {
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "System";
  const current = users.find((u) => u.id === lead.ownerId)?.name ?? "Unassigned";
  const people = new Map<string, number>();
  for (const a of items) if (a.byId && a.kind !== "system") people.set(a.byId, (people.get(a.byId) ?? 0) + 1);
  const KIND: Record<string, string> = { call: "Call", whatsapp: "WhatsApp", email: "Email", note: "Note", system: "Update", quote_view: "Quote viewed", payment: "Payment" };
  return (
    <Card>
      <CardTitle title="Handling history" subtitle={`Currently handled by ${current} · visible to admins only`} />
      {people.size > 0 && <div className="mb-3 flex flex-wrap gap-2">{[...people].map(([id, n]) => <Badge key={id}>{name(id)} · {n} {n === 1 ? "action" : "actions"}</Badge>)}</div>}
      {items.length === 0 ? <p className="text-sm text-ink-500">Nothing recorded yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-ink-500"><tr><th className="py-1.5 pr-3">When</th><th className="pr-3">Staff</th><th className="pr-3">Type</th><th>What happened</th></tr></thead>
          <tbody className="divide-y divide-line">{items.map((a) => <tr key={a.id}><td className="whitespace-nowrap py-1.5 pr-3 text-ink-500">{relTime(a.at)}</td><td className="whitespace-nowrap pr-3 font-medium">{name(a.byId)}</td><td className="pr-3">{KIND[a.kind] ?? a.kind}</td><td className="text-ink-700">{a.body}</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}

export function LeadDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const lead = useOne("leads", id);
  const acts = useList("activities");
  const quotes = useList("quotes");
  const tasks = useList("tasks");
  const users = useList("users");
  const packages = useList("packages");
  const { act, busy } = useAction();
  const m = useMutation();
  const { user } = useSession();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [kind, setKind] = useState<"call" | "whatsapp" | "email" | "note">("call");
  const [body, setBody] = useState("");
  const [mins, setMins] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [pkgId, setPkgId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  if (lead.error) return <ErrorNote message={lead.error.message} />;
  if (!lead.data) return <Loading />;
  const l = lead.data;
  const myQuotes = (quotes.data ?? []).filter((q) => q.leadId === l.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const timeline = (acts.data ?? []).filter((a) => a.leadId === l.id).sort((a, b) => (a.at < b.at ? 1 : -1));
  const myTasks = (tasks.data ?? []).filter((t) => t.leadId === l.id);
  const salesUsers = (users.data ?? []).filter((u) => ["sales", "owner", "admin", "marketing"].includes(u.role) && u.active);
  const phoneDigits = l.phone.replace(/\D/g, "");
  const nextStages = { new: ["contacted"], contacted: ["negotiation"], quoted: ["negotiation", "contacted"], negotiation: ["quoted"], won: [], lost: ["contacted"] }[l.stage] ?? [];

  const buildQuote = async () => {
    const q = await act<Quote>("createQuoteFromLead", { leadId: l.id, packageId: pkgId || null }, "Draft quote ready — review and send");
    if (q) nav(`/app/quotes/${q.id}`);
  };

  return (
    <div>
      <PageHeader back={{ to: "/app/leads", label: "Leads" }} title={l.name}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={l.stage} /><StatusBadge status={l.temperature} label={`${titleCase(l.temperature)} · ${l.score}`} /><span>{SOURCE_LABEL[l.source]} · created {relTime(l.createdAt)}</span></span>}
        actions={<>
          {l.phone && <a href={`tel:${l.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm shadow-sm hover:bg-slate-50"><Phone className="size-4" />Call</a>}
          {phoneDigits && <a href={`https://wa.me/${phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm shadow-sm hover:bg-slate-50"><MessageCircle className="size-4 text-emerald-600" />WhatsApp</a>}
          {!["won", "lost"].includes(l.stage) && <Button variant="secondary" onClick={() => setLostOpen(true)}>Mark lost</Button>}
        </>} />

      {l.stage === "won" && l.bookingId && <div className="mb-4"><Callout tone="good">Won — <Link to={`/app/bookings/${l.bookingId}`} className="font-medium underline">open the booking file</Link>.</Callout></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {!["won", "lost"].includes(l.stage) && (
            <Card className="border-brand-200 bg-brand-50/40">
              <CardTitle title="Next step: send a quote" subtitle="We'll suggest hotels, transfers and sightseeing for the destination; you adjust and send." />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select aria-label="Start from package" value={pkgId} onChange={(e) => setPkgId(e.target.value)} className="sm:max-w-xs">
                  <option value="">Auto-suggest for {l.destination || "destination"}</option>
                  {(packages.data ?? []).map((p) => <option key={p.id} value={p.id}>Template: {p.name}</option>)}
                </Select>
                <Button icon={<FileText className="size-4" />} busy={busy} onClick={buildQuote}>Build quote</Button>
              </div>
            </Card>
          )}

          <Card>
            <CardTitle title="Log activity" />
            <Tabs tabs={[{ key: "call", label: "Call" }, { key: "whatsapp", label: "WhatsApp" }, { key: "email", label: "Email" }, { key: "note", label: "Note" }]} value={kind} onChange={setKind} />
            <Textarea aria-label="Activity details" value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "call" ? "What did you discuss?" : kind === "note" ? "Internal note" : "Message summary"} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {kind === "call" ? <Input aria-label="Call minutes" type="number" min={0} placeholder="Minutes" value={mins} onChange={(e) => setMins(e.target.value)} className="w-28" /> : <span />}
              <Button busy={busy} disabled={!body.trim()} onClick={async () => {
                const r = await act("logActivity", { leadId: l.id, kind, body, durationSec: kind === "call" && mins ? Number(mins) * 60 : null }, "Logged");
                if (r) { setBody(""); setMins(""); }
              }}>Save</Button>
            </div>
          </Card>

          {isAdmin && <HandlingHistory lead={l} items={timeline} users={users.data ?? []} />}
          <Card><CardTitle title="Timeline" /><ActivityFeed items={timeline} /></Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle title="Trip" />
            <KeyValue items={[
              ["Destination", l.destination || "—"], ["Service", titleCase(l.service)], ["Booking type", l.bookingType ? titleCase(l.bookingType) : "—"], ["Travel date", formatDate(l.travelDate)], ["Days / nights", l.days || l.nights !== null ? `${l.days ?? (l.nights ?? 0) + 1} days / ${l.nights ?? Math.max(0, (l.days ?? 1) - 1)} nights` : "—"],
              ["Source", `${SOURCE_LABEL[l.source]}${l.sourceDetail ? ` — ${l.sourceDetail}` : ""}${l.referredBy ? ` — referred by ${l.referredBy}` : ""}`],
              ["Travellers", `${l.pax.adults} adults${l.pax.children ? `, ${l.pax.children} children` : ""}`], ["Budget", money(l.budget)], ["Phone", l.phone || "—"], ["Email", l.email || "—"],
            ]} />
            {l.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-ink-700">{l.notes}</p>}
            <div className="mt-4 grid gap-3">
              <Field label="Handled by" hint={isAdmin ? undefined : "Only an admin can hand a lead to someone else."}>
                <Select disabled={!isAdmin} value={l.ownerId ?? ""} onChange={(e) => act("assignLead", { leadId: l.id, ownerId: e.target.value || null }, "Lead reassigned")}>
                  <option value="">Unassigned</option>{salesUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              {nextStages.length > 0 && (
                <Field label="Move stage">
                  <Select value="" onChange={(e) => e.target.value && act("updateLeadStage", { leadId: l.id, stage: e.target.value }, "Stage updated")}>
                    <option value="">Choose…</option>{nextStages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle title="Why this score" subtitle={`${l.score}/100 · ${titleCase(l.temperature)}`} />
            <ul className="space-y-1 text-sm text-ink-700">{l.scoreReasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>

          <Card>
            <CardTitle title="Quotes" />
            {myQuotes.length === 0 ? <p className="text-sm text-ink-500">No quotes yet.</p> : (
              <ul className="divide-y divide-line">{myQuotes.map((q) => (
                <li key={q.id}><Link to={`/app/quotes/${q.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-brand-700">
                  <span><span className="font-medium">{q.number}</span> <span className="text-xs text-ink-500">v{q.version} · {q.views} views</span></span>
                  <span className="flex items-center gap-2">{money(q.total)}<StatusBadge status={q.status} /></span>
                </Link></li>
              ))}</ul>
            )}
          </Card>

          <Card>
            <CardTitle title="Tasks" />
            <TaskList tasks={myTasks} />
            <div className="mt-2 flex gap-2">
              <Input aria-label="New task" placeholder="Add a follow-up…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Button variant="secondary" disabled={!taskTitle.trim()} onClick={async () => {
                const r = await act("createTask", { title: taskTitle, dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(), leadId: l.id }, "Follow-up added for tomorrow");
                if (r) setTaskTitle("");
              }}>Add</Button>
            </div>
          </Card>
        </div>
      </div>
      <LostModal lead={l} open={lostOpen} onClose={() => setLostOpen(false)} />
    </div>
  );
}
