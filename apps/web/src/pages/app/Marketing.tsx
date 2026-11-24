import { Link, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { formatDate, WHATSAPP_MARKETING_COST } from "@voyadesk/core";
import { useAction, useList } from "../../lib/hooks";
import { money, pct, titleCase } from "../../lib/format";
import { ResourcePage } from "../../components/ResourcePage";
import { Button, Callout, PageHeader, StatusBadge, Tabs } from "../../components/ui";

type Tab = "campaigns" | "segments" | "drips" | "landing" | "coupons";

export function MarketingPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "campaigns";
  const segments = useList("segments");
  const packages = useList("packages");
  const { act, busy } = useAction();
  const segName = (id: string | null) => segments.data?.find((s) => s.id === id)?.name ?? "All contacts";
  return (
    <div>
      <PageHeader title="Marketing" subtitle="Bring past travellers back and turn campaigns into leads." />
      <Tabs tabs={[{ key: "campaigns", label: "Campaigns" }, { key: "segments", label: "Segments" }, { key: "drips", label: "Drip sequences" }, { key: "landing", label: "Landing pages" }, { key: "coupons", label: "Coupons" }]} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === "campaigns" && <>
        <div className="mb-4"><Callout tone="info">Messages are delivered through the WhatsApp/email provider you connect in Settings → Integrations{" "}(in the demo nothing is actually sent). WhatsApp marketing messages cost about ₹{(WHATSAPP_MARKETING_COST / 100).toFixed(2)} each (Meta India rate card, Jan 2026) plus your provider's fee and 18% GST.</Callout></div>
        <ResourcePage embedded collection="campaigns" title="Campaigns" singular="Campaign" search={(c) => c.name} defaults={{ channel: "whatsapp", status: "draft" }}
          fields={[
            { name: "name", label: "Campaign name", type: "text", required: true },
            { name: "channel", label: "Channel", type: "select", options: [{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }] },
            { name: "segmentId", label: "Audience", type: "ref", ref: "segments", hint: "Leave empty to send to all contacts" },
            { name: "message", label: "Message", type: "textarea", required: true },
          ]}
          columns={[
            { key: "name", header: "Campaign", render: (c) => <span><span className="font-medium">{c.name}</span><span className="block text-xs text-ink-500">{titleCase(c.channel)} · {segName(c.segmentId)}</span></span> },
            { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
            { key: "sent", header: "Sent", render: (c) => c.sentCount, align: "right" },
            { key: "cost", header: "Est. cost", render: (c) => money(c.cost), align: "right" },
            { key: "when", header: "Scheduled", render: (c) => (c.status === "scheduled" && c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : c.status === "draft" ? <Button size="sm" variant="ghost" busy={busy} onClick={(e) => { e.stopPropagation(); void act("scheduleCampaign", { campaignId: c.id, at: null }, "Scheduled for the best time to reach this audience"); }}>Send at best time</Button> : "—"), hideOnMobile: true },
            { key: "go", header: "", align: "right", render: (c) => c.status !== "sent" ? <Button size="sm" busy={busy} icon={<Send className="size-4" />} onClick={(e) => { e.stopPropagation(); void act<{ sentCount: number; cost: number }>("sendCampaign", { campaignId: c.id }, (r) => `Queued for ${r.sentCount} contacts · est. ${money(r.cost)}`); }}>Send</Button> : <span className="text-xs text-ink-500">{c.scheduledAt ? formatDate(c.scheduledAt.slice(0, 10)) : ""}</span> },
          ]} />
      </>}
      {tab === "segments" && (
        <ResourcePage embedded collection="segments" title="Segments" singular="Segment" search={(s) => s.name} defaults={{ rules: [] }}
          fields={[
            { name: "name", label: "Segment name", type: "text", required: true },
            { name: "description", label: "Description", type: "text" },
          ]}
          columns={[
            { key: "name", header: "Segment", render: (s) => <span><span className="font-medium">{s.name}</span><span className="block text-xs text-ink-500">{s.description}</span></span> },
            { key: "rules", header: "Rules", render: (s) => s.rules.map((r) => `${titleCase(r.field)} ${r.op === "gte" ? "≥" : r.op === "lte" ? "≤" : r.op === "contains" ? "contains" : "="} ${r.value}`).join(" and ") || "Everyone" },
          ]} />
      )}
      {tab === "drips" && (
        <ResourcePage embedded collection="dripSequences" title="Drip sequences" singular="Sequence" search={(d) => d.name} defaults={{ trigger: "new_lead", active: true, steps: [] }}
          fields={[
            { name: "name", label: "Name", type: "text", required: true },
            { name: "trigger", label: "Starts when", type: "select", options: [{ value: "new_lead", label: "A new lead arrives" }, { value: "quote_sent", label: "A quote is sent" }, { value: "no_reply_3d", label: "No reply for 3 days" }, { value: "trip_completed", label: "A trip is completed" }] },
            { name: "active", label: "Active", type: "toggle" },
          ]}
          columns={[
            { key: "name", header: "Sequence", render: (d) => <span className="font-medium">{d.name}</span> },
            { key: "trigger", header: "Trigger", render: (d) => titleCase(d.trigger) },
            { key: "steps", header: "Steps", render: (d) => d.steps.map((s) => `Day ${s.afterDays}: ${titleCase(s.channel)}`).join(" → ") || "—" },
            { key: "active", header: "", render: (d) => <StatusBadge status={d.active ? "active" : "inactive"} /> },
          ]} />
      )}
      {tab === "landing" && (
        <ResourcePage embedded collection="landingPages" title="Landing pages" singular="Landing page" search={(l) => `${l.title} ${l.slug}`} defaults={{ published: false }}
          fields={[
            { name: "title", label: "Title", type: "text", required: true },
            { name: "slug", label: "Web address", type: "text", required: true, hint: "lowercase-with-dashes" },
            { name: "packageId", label: "Featured package", type: "ref", ref: "packages" },
            { name: "headline", label: "Headline", type: "text", span: 2 },
            { name: "body", label: "Body", type: "textarea" },
            { name: "published", label: "Published", type: "toggle" },
          ]}
          columns={[
            { key: "title", header: "Page", render: (l) => <span><span className="font-medium">{l.title}</span><span className="block text-xs text-ink-500">/{l.slug}{l.packageId ? ` · ${packages.data?.find((p) => p.id === l.packageId)?.name ?? ""}` : ""}</span></span> },
            { key: "leads", header: "Leads", render: (l) => l.leads, align: "right" },
            { key: "pub", header: "", render: (l) => <span className="inline-flex items-center gap-2"><StatusBadge status={l.published ? "active" : "draft"} label={l.published ? "Live" : "Draft"} />{l.published && <Link className="text-xs text-brand-700 hover:underline" to={`/lp/demo/${l.slug}`} onClick={(e) => e.stopPropagation()}>Open</Link>}</span> },
          ]} />
      )}
      {tab === "coupons" && (
        <ResourcePage embedded collection="coupons" title="Coupons" singular="Coupon" search={(c) => c.code} defaults={{ kind: "percent", value: 1000, active: true, maxUses: 0 }}
          fields={[
            { name: "code", label: "Code", type: "text", required: true, placeholder: "FESTIVE10" },
            { name: "kind", label: "Type", type: "select", options: [{ value: "percent", label: "Percent off" }, { value: "flat", label: "Flat amount off" }] },
            { name: "value", label: "Discount", type: "percent", typeFrom: (v) => (v["kind"] === "flat" ? "money" : "percent") },
            { name: "maxUses", label: "Max uses (0 = unlimited)", type: "number" },
            { name: "validFrom", label: "Valid from", type: "date", nullable: true },
            { name: "validTo", label: "Valid to", type: "date", nullable: true },
            { name: "active", label: "Active", type: "toggle" },
          ]}
          columns={[
            { key: "code", header: "Code", render: (c) => <span className="font-mono font-medium">{c.code}</span> },
            { key: "val", header: "Discount", render: (c) => (c.kind === "percent" ? pct(c.value) : money(c.value)) },
            { key: "uses", header: "Used", render: (c) => `${c.uses}${c.maxUses ? ` / ${c.maxUses}` : ""}`, align: "right" },
            { key: "valid", header: "Valid", render: (c) => `${c.validFrom ? formatDate(c.validFrom) : "now"} → ${c.validTo ? formatDate(c.validTo) : "no end"}` },
            { key: "active", header: "", render: (c) => <StatusBadge status={c.active ? "active" : "inactive"} /> },
          ]} />
      )}
    </div>
  );
}
