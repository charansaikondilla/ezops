import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { addDays, formatDate, isoDate, priceOfQuote, type Booking, type FileRow, type Invoice, type Quote, type Service, type Settings, type User } from "@voyadesk/core";
import { api, ApiError } from "../../lib/api";
import { money, SERVICE_ICON_LABEL } from "../../lib/format";
import { Button, ErrorNote, Loading } from "../../components/ui";
import { DestinationBanner, DestinationGallery, destinationInfo } from "../../components/DestinationArt";
import { staysFromLines } from "../app/QuoteBuilder";

function usePrintData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    load().then(setData, (e: unknown) => setError(e instanceof ApiError ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

function Sheet({ settings, title, children, brand }: { settings: Settings; title: string; children: ReactNode; brand?: { name: string; phone: string; email: string } | null }) {
  const nav = useNavigate();
  return (
    <div className="min-h-full bg-canvas py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2 px-4">
        <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => nav(-1)}>Back</Button>
        <span className="flex items-center gap-2"><span className="hidden text-xs text-ink-500 sm:inline">Choose "Save as PDF" in the print dialog</span><Button icon={<Printer className="size-4" />} onClick={() => { try { window.print(); } catch { /* blocked in some embedded viewers */ } }}>Print / save as PDF</Button></span>
      </div>
      <div className="print-page mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between border-b-2 pb-4" style={{ borderColor: settings.brandColor }}>
          <div>
            {!brand?.name && settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.companyName} logo`} className="mb-2 max-h-14 max-w-[200px] object-contain" />}
            <div className="text-xl font-semibold" style={{ color: settings.brandColor }}>{brand?.name || settings.companyName}</div>
            {brand?.name && <div className="mt-1 text-xs text-ink-600">{[brand.phone, brand.email].filter(Boolean).join(" · ")}</div>}
            <div className={brand?.name ? "hidden" : "mt-1 whitespace-pre-line text-xs text-ink-600"}>{settings.legalName}{settings.address ? `\n${settings.address}` : ""}{settings.gstin ? `\nGSTIN ${settings.gstin}` : ""}{settings.phone ? ` · ${settings.phone}` : ""}</div>
          </div>
          <div className="text-right text-lg font-semibold uppercase tracking-wide text-ink-700">{title}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PrintInvoicePage() {
  const { id = "" } = useParams();
  const { data, error } = usePrintData(async () => ({ inv: await api.get("invoices", id), me: await api.me() }), [id]);
  if (error) return <div className="p-6"><ErrorNote message={error} /></div>;
  if (!data) return <Loading />;
  const { inv, me } = data as { inv: Invoice; me: { settings: Settings } };
  return (
    <Sheet settings={me.settings} title="Tax invoice">
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-xs uppercase text-ink-500">Billed to</div><div className="font-medium">{inv.partyName}</div>{inv.gstin && <div>GSTIN {inv.gstin}</div>}<div>Place of supply: {inv.placeOfSupply}</div></div>
        <div className="text-right"><div>Invoice <b>{inv.number}</b></div><div>Date {formatDate(inv.issueDate)}</div><div>Due {formatDate(inv.dueDate)}</div></div>
      </div>
      <table className="mt-6 w-full text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-ink-500"><th className="py-2">Description</th><th>SAC</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{inv.lines.map((l, i) => <tr key={i} className="border-b border-line"><td className="py-2">{l.description}</td><td>{l.sac}</td><td className="text-right">{money(l.amount, inv.currency)}</td></tr>)}</tbody></table>
      <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Taxable value</dt><dd>{money(inv.sell)}</dd></div>
        {inv.igst ? <div className="flex justify-between"><dt>IGST</dt><dd>{money(inv.igst)}</dd></div> : <><div className="flex justify-between"><dt>CGST</dt><dd>{money(inv.cgst)}</dd></div><div className="flex justify-between"><dt>SGST</dt><dd>{money(inv.sgst)}</dd></div></>}
        {inv.tcs > 0 && <div className="flex justify-between"><dt>TCS (sec. 206C(1G) / 394)</dt><dd>{money(inv.tcs)}</dd></div>}
        <div className="flex justify-between border-t border-ink-800 pt-1 text-base font-semibold"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
        <div className="flex justify-between text-ink-600"><dt>Paid</dt><dd>{money(inv.paid)}</dd></div>
        {inv.credited > 0 && <div className="flex justify-between text-ink-600"><dt>Credit notes</dt><dd>{money(inv.credited)}</dd></div>}
        <div className="flex justify-between font-medium"><dt>Balance due</dt><dd>{money(inv.total - inv.paid - inv.credited)}</dd></div>
      </dl>
      <p className="mt-8 text-xs text-ink-500">This is a computer-generated invoice. Tour operator services billed at a gross package value attract GST at the applicable rate without input tax credit.</p>
    </Sheet>
  );
}

export function PrintVoucherPage() {
  const { id = "" } = useParams();
  const { data, error } = usePrintData(async () => {
    const sv = await api.get("services", id);
    const [bk, me, suppliers] = await Promise.all([api.get("bookings", sv.bookingId), api.me(), api.list("suppliers").catch(() => [])]);
    const agent = bk.agentId ? await api.get("agents", bk.agentId).catch(() => null) : null;
    return { sv, bk, me, supplier: suppliers.find((s) => s.id === sv.supplierId), brand: agent?.brandName ? { name: agent.brandName, phone: agent.brandPhone || agent.phone, email: agent.brandEmail || agent.email } : null };
  }, [id]);
  if (error) return <div className="p-6"><ErrorNote message={error} /></div>;
  if (!data) return <Loading />;
  const { sv, bk, me, supplier, brand } = data as { sv: Service; bk: Booking; me: { settings: Settings }; supplier?: { name: string; phone: string }; brand: { name: string; phone: string; email: string } | null };
  return (
    <Sheet settings={me.settings} title="Service voucher" brand={brand}>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-xs uppercase text-ink-500">Guest</div><div className="text-lg font-medium">{bk.contactName}</div><div>{bk.pax.adults} adults{bk.pax.children ? `, ${bk.pax.children} children` : ""}</div></div>
        <div className="text-right"><div>Voucher <b>{sv.voucherNo || "—"}</b></div><div>Booking {bk.number}</div></div>
      </div>
      <div className="mt-6 rounded-xl border border-line p-4 text-sm">
        <div className="text-xs uppercase text-ink-500">{SERVICE_ICON_LABEL[sv.type]}</div>
        <div className="text-lg font-medium">{sv.title}</div>
        <div className="mt-2 grid grid-cols-2 gap-2"><div>Date: <b>{formatDate(sv.date)}</b>{sv.endDate ? ` → ${formatDate(sv.endDate)}` : ""}</div><div>Confirmation: <b>{sv.confirmationNo || "—"}</b></div>{supplier && <div>Supplier: {supplier.name}</div>}</div>
      </div>
      <p className="mt-6 text-xs text-ink-500">Please present this voucher at check-in / pickup. For help during travel call {brand?.phone || me.settings.phone || "your travel consultant"}.</p>
    </Sheet>
  );
}

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-1.5 mt-6 border-b border-line pb-1 text-sm font-bold uppercase tracking-wide text-ink-800">{children}</h2>;

export function PrintQuotePage() {
  const { id = "" } = useParams();
  const [internal, setInternal] = useState(false);
  const { data, error } = usePrintData(async () => {
    const q = await api.get("quotes", id);
    const agent = q.agentId ? await api.get("agents", q.agentId).catch(() => null) : null;
    const booking = q.bookingId ? await api.get("bookings", q.bookingId).catch(() => null) : null;
    const invoice = booking?.invoiceId ? await api.get("invoices", booking.invoiceId).catch(() => null) : null;
    const users = await api.list("users").catch(() => [] as User[]);
    const files = await api.list("files").catch(() => [] as FileRow[]);
    return { q, me: await api.me(), booking, invoice, users, files, brand: agent?.brandName ? { name: agent.brandName, phone: agent.brandPhone || agent.phone, email: agent.brandEmail || agent.email } : null };
  }, [id]);
  if (error) return <div className="p-6"><ErrorNote message={error} /></div>;
  if (!data) return <Loading />;
  const { q, me, brand, booking, invoice, users, files } = data as { q: Quote; me: { settings: Settings }; brand: { name: string; phone: string; email: string } | null; booking: Booking | null; invoice: Invoice | null; users: User[]; files: FileRow[] };
  const st = me.settings;
  const p = priceOfQuote(q, isoDate(new Date()));
  const priced = new Map(p.lines.map((l) => [l.id, l]));
  const chosen = q.options.length ? q.chosenOption || q.options[0]!.key : "";
  const lines = q.lines.filter((l) => !q.options.length || !l.option || l.option === chosen);
  const flightSell = lines.reduce((a, l) => a + (l.type === "flight" && priced.get(l.id)?.included ? priced.get(l.id)!.sell : 0), 0);
  const groundSell = Math.max(0, p.sell - flightSell);
  const stays = q.stays.length ? q.stays : staysFromLines({ lines, destination: q.destination });
  const flights = q.flightDetails.trim() || lines.filter((l) => l.type === "flight").map((l) => l.title).join("\n");
  const days = q.days.length ? q.days : [];
  const totalDays = q.nights + 1;
  const photo = (i: number) => { const pid = q.days[i]?.photoId; return pid ? files.find((f) => f.id === pid && f.mime.startsWith("image/"))?.dataUrl : undefined; };
  const info = destinationInfo(q.destination);
  const paymentTerms = q.paymentTerms.trim() || st.paymentTerms.trim();
  const advance = invoice?.paid ?? 0;
  const balance = invoice ? Math.max(0, invoice.total - invoice.paid - invoice.credited) : p.total;
  const balanceBy = q.startDate ? addDays(q.startDate, -st.balanceDueDaysBefore) : null;
  const staff = users.find((u) => u.id === (q.preparedById ?? q.ownerId))?.name ?? "";
  return (
    <Sheet settings={st} title="Travel proposal" brand={brand}>
      <div className="no-print mt-3 flex items-center gap-2 text-xs text-ink-600">
        <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-brand-600" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Include the internal "For our reference" block (don't send to the customer)</label>
      </div>

      <h1 className="mt-4 text-center text-2xl font-bold uppercase tracking-wide">{q.destination || "Holiday"} tour itinerary</h1>
      <div className="mt-1 text-center text-sm text-ink-600">{totalDays} Days / {q.nights} Nights{q.startDate ? ` · ${formatDate(q.startDate)} to ${formatDate(addDays(q.startDate, q.nights))}` : ""}</div>
      <div className="mt-1 text-center text-xs text-ink-500">{q.title} · {q.number}{q.tourCode ? ` · Tour code ${q.tourCode}` : ""} · prepared for {q.contactName} · {q.pax.adults} adult{q.pax.adults === 1 ? "" : "s"}{q.pax.children ? `, ${q.pax.children} children` : ""}{q.bookingType ? ` · ${q.bookingType[0]!.toUpperCase()}${q.bookingType.slice(1)} trip` : ""}</div>

      <div className="mt-4">{files.some((f) => q.days.some((d) => d.photoId === f.id)) ? (
        <div className="grid grid-cols-3 gap-2">{days.map((_, i) => photo(i)).filter(Boolean).slice(0, 3).map((src, i) => <img key={i} src={src} alt={`${q.destination} ${i + 1}`} className="h-36 w-full rounded-lg object-cover" />)}</div>
      ) : <DestinationGallery destination={q.destination} />}</div>

      <H>Hotels</H>
      <table className="w-full border border-line text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-ink-600"><tr><th className="border border-line px-2 py-1.5">City</th><th className="border border-line px-2">Hotel name</th><th className="border border-line px-2">Room</th><th className="border border-line px-2 text-right">No of nights</th><th className="border border-line px-2">Meal plan</th></tr></thead>
        <tbody>{stays.length ? stays.map((r, i) => <tr key={i}><td className="border border-line px-2 py-1.5">{r.city}</td><td className="border border-line px-2">{r.hotel}</td><td className="border border-line px-2">{r.room}</td><td className="border border-line px-2 text-right">{r.nights}</td><td className="border border-line px-2">{r.mealPlan}</td></tr>) : <tr><td colSpan={5} className="border border-line px-2 py-3 text-center text-ink-500">Hotels will be confirmed with your final itinerary.</td></tr>}</tbody></table>

      <H>Package cost (INR)</H>
      <dl className="max-w-sm space-y-1 text-sm">
        <div className="flex justify-between"><dt>Ground package cost</dt><dd className="tabular-nums">{money(groundSell, q.currency)}</dd></div>
        <div className="flex justify-between"><dt>Flight cost</dt><dd className="tabular-nums">{flightSell ? money(flightSell, q.currency) : "Not included"}</dd></div>
        {p.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd className="tabular-nums">−{money(p.discount, q.currency)}</dd></div>}
        <div className="flex justify-between text-ink-600"><dt>GST</dt><dd className="tabular-nums">{money(p.gst, q.currency)}</dd></div>
        {p.tcs > 0 && <div className="flex justify-between text-ink-600"><dt>TCS</dt><dd className="tabular-nums">{money(p.tcs, q.currency)}</dd></div>}
        <div className="flex justify-between border-t border-ink-800 pt-1 text-base font-bold"><dt>Total package cost</dt><dd className="tabular-nums">{money(p.total, q.currency)}</dd></div>
        <div className="flex justify-between text-xs text-ink-500"><dt>Per traveller ({p.payingPax})</dt><dd>{money(p.perPerson, q.currency)}</dd></div>
      </dl>

      <H>Tentative itinerary</H>
      {days.length === 0 ? <p className="text-sm text-ink-500">Day-by-day plan to follow.</p> : (
        <ol className="space-y-2.5 text-sm">{days.map((d, i) => (
          <li key={i} className="break-inside-avoid"><div className="font-semibold">Day {i + 1}{q.startDate ? ` · ${formatDate(addDays(q.startDate, i))}` : ""}: {d.title}</div><div className="text-ink-700">{d.description}</div>{photo(i) && <img src={photo(i)} alt={d.title} className="mt-1.5 max-h-40 rounded-lg object-cover" />}</li>
        ))}</ol>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div><H>Inclusions</H><ul className="list-disc pl-5">{q.inclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><H>Exclusions</H><ul className="list-disc pl-5">{q.exclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>

      {(q.checkInOut || st.checkInOut) && <><H>Hotel check-in / check-out</H><p className="whitespace-pre-wrap text-sm">{q.checkInOut || st.checkInOut}</p></>}
      <H>Terms and conditions</H>
      <p className="whitespace-pre-wrap text-xs text-ink-700">{q.terms || st.defaultTerms}</p>
      <H>Payment terms & bank details</H>
      <p className="whitespace-pre-wrap text-sm">{paymentTerms || `Advance to confirm; balance by ${balanceBy ? formatDate(balanceBy) : `${st.balanceDueDaysBefore} days before travel`}.`}</p>
      {st.bankDetails.trim() && <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-slate-50 p-3 font-sans text-sm">{st.bankDetails}</pre>}
      {flights && <><H>Flight details</H><pre className="whitespace-pre-wrap rounded-lg border border-line p-3 font-sans text-sm">{flights}</pre></>}

      {internal && (
        <div className="mt-6 break-inside-avoid rounded-lg border-2 border-dashed border-slate-400 p-4 text-sm">
          <div className="mb-2 text-center text-sm font-bold uppercase tracking-wide">For our reference</div>
          <dl className="mx-auto grid max-w-md grid-cols-[1fr_1.2fr] gap-x-4 gap-y-1">
            {([
              ["Customer name", q.contactName], ["Mobile number", q.phone || "—"], ["DOB (sending wishes)", q.dateOfBirth ? formatDate(q.dateOfBirth) : "—"], ["Package done by", staff || "—"],
              ["Tour code", q.tourCode || booking?.tourCode || "—"], ["Total cost of the package", money(p.total, q.currency)], ["Advance received", money(advance, q.currency)],
              ["Balance amount to be paid before", `${money(balance, q.currency)}${balanceBy ? ` by ${formatDate(balanceBy)}` : ""}`],
            ] as [string, string][]).map(([k, v]) => <div key={k} className="contents"><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      )}

      <div className="mt-8 border-t border-line pt-3 text-center text-sm font-bold uppercase tracking-wide">{brand?.name || st.legalName || st.companyName}</div>
      <div className="mt-1 text-center text-[11px] text-ink-400">{info.name} · {q.number}</div>
      <div className="hidden"><DestinationBanner destination={q.destination} /></div>
    </Sheet>
  );
}
