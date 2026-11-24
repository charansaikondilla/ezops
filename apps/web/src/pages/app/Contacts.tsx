import { useState } from "react";
import { formatDate } from "@voyadesk/core";
import { useList } from "../../lib/hooks";
import { money } from "../../lib/format";
import { ResourcePage } from "../../components/ResourcePage";
import { Badge, Button, Modal } from "../../components/ui";
import { ContactDocuments } from "../../components/plus";

export function ContactsPage() {
  const leads = useList("leads");
  const files = useList("files");
  const [docs, setDocs] = useState<{ id: string; name: string } | null>(null);
  return (
    <>
    <ResourcePage collection="contacts" title="Customers" singular="Customer" subtitle="One profile per traveller: family, documents, preferences, trips and spend. Duplicates are merged by phone and email."
      search={(c) => `${c.name} ${c.phone} ${c.email} ${c.city} ${c.passportNo} ${c.tags.join(" ")}`} defaults={{ kind: "customer", tags: [], family: [] }}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "kind", label: "Type", type: "select", options: [{ value: "customer", label: "Individual" }, { value: "corporate", label: "Corporate" }] },
        { name: "phone", label: "Phone", type: "phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "city", label: "City", type: "text" },
        { name: "pan", label: "PAN (for TCS)", type: "text" },
        { name: "dob", label: "Date of birth (for sending wishes)", type: "date", nullable: true },
        { name: "passportNo", label: "Passport no.", type: "text", section: "Passport details" },
        { name: "passportFirstName", label: "First name (as per passport)", type: "text" },
        { name: "passportLastName", label: "Last name (as per passport)", type: "text" },
        { name: "passportIssue", label: "Date of issue", type: "date", nullable: true },
        { name: "passportExpiry", label: "Date of expiry", type: "date", nullable: true, hint: "Most countries need at least 6 months of validity after travel." },
        { name: "tags", label: "Tags", type: "tags", placeholder: "vip, honeymoon, repeat", section: "Other" },
        { name: "preferences", label: "Preferences", type: "textarea", placeholder: "Veg meals, sea-facing rooms, aisle seats…" },
      ]}
      columns={[
        { key: "name", header: "Customer", render: (c) => <span><span className="font-medium">{c.name}</span><span className="block text-xs text-ink-500">{c.phone || c.email}</span></span>, sort: (c) => c.name },
        { key: "pp", header: "Passport", hideOnMobile: true, render: (c) => (c.passportNo ? <span><span className="font-medium">{c.passportNo}</span><span className={`block text-xs ${c.passportExpiry && c.passportExpiry < new Date().toISOString().slice(0, 10) ? "text-rose-700" : "text-ink-500"}`}>{c.passportExpiry ? `expires ${formatDate(c.passportExpiry)}` : "no expiry"}</span></span> : "—") },
        { key: "tags", header: "Tags", render: (c) => <span className="inline-flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span>, hideOnMobile: true },
        { key: "leads", header: "Enquiries", render: (c) => (leads.data ?? []).filter((l) => l.contactId === c.id).length, align: "right" },
        { key: "trips", header: "Trips", render: (c) => c.trips, sort: (c) => c.trips, align: "right" },
        { key: "spend", header: "Lifetime spend", render: (c) => money(c.totalSpend), sort: (c) => c.totalSpend, align: "right" },
        { key: "docs", header: "Documents", align: "right", render: (c) => { const n = (files.data ?? []).filter((f) => f.ownerType === "contact" && f.ownerId === c.id).length; return <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDocs({ id: c.id, name: c.name }); }}>{n ? `${n} file${n > 1 ? "s" : ""}` : "Add"}</Button>; } },
      ]} />
    <Modal open={docs !== null} onClose={() => setDocs(null)} size="lg" title={`${docs?.name ?? ""} — documents`}>{docs && <ContactDocuments contactId={docs.id} />}</Modal>
    </>
  );
}
