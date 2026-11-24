import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, MessageCircle, X } from "lucide-react";
import { canRead, type Role } from "@voyadesk/core";
import { useReport } from "../lib/hooks";
import { useSession } from "../lib/session";
import { money } from "../lib/format";
import { dueText, TrackBadge, whatsappReminderLink, type TrackingData } from "../pages/app/Tracking";
import { Button } from "./ui";

const DAY = 86_400_000;
const key = (uid: string) => `ezops.payreminder.next.${uid}`;
const read = (uid: string): number => { try { return Number(window.localStorage.getItem(key(uid))) || 0; } catch { return 0; } };
const write = (uid: string, at: number) => { try { window.localStorage.setItem(key(uid), String(at)); } catch { /* private mode: it will simply show again */ } };

/**
 * Regular follow-up reminder: a non-blocking pop-up listing trips that still owe money before travel.
 * It comes back every "reminderEveryDays" days (Settings → Payments & automation) until the balance is paid.
 */
export function PaymentReminderPopup() {
  const { user, settings } = useSession();
  const role = user?.role as Role | undefined;
  const allowed = Boolean(user && role && ["owner", "admin", "accounts", "sales"].includes(role) && canRead(role, "bookings"));
  const report = useReport<TrackingData>("paymentTracking", {}, allowed);
  const [open, setOpen] = useState(false);
  const urgent = useMemo(() => (report.data?.reminders ?? []).filter((r) => r.status === "overdue" || r.status === "due_soon" || r.daysToTravel <= 30), [report.data]);

  useEffect(() => {
    if (!allowed || !user || urgent.length === 0) { setOpen(false); return; }
    if (Date.now() >= read(user.id)) setOpen(true);
  }, [allowed, user, urgent.length]);

  if (!open || !user || !report.data || urgent.length === 0) return null;
  const every = report.data.reminderEveryDays;
  const close = (ms: number) => { write(user.id, Date.now() + ms); setOpen(false); };
  const shown = urgent.slice(0, 5);
  return (
    <div role="dialog" aria-label="Payment follow-up reminders" className="no-print fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-amber-100 text-amber-700"><BellRing className="size-4" /></span><div><div className="text-sm font-semibold">Payment follow-ups</div><div className="text-xs text-ink-500">{urgent.length} trip{urgent.length === 1 ? "" : "s"} still owe money before travel</div></div></div>
        <button className="rounded p-1 text-ink-400 hover:bg-slate-100" aria-label="Close reminder" onClick={() => close(every * DAY)}><X className="size-4" /></button>
      </div>
      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {shown.map((r) => {
          const wa = whatsappReminderLink(r, settings?.companyName ?? "our team");
          return (
            <li key={r.bookingId} className="rounded-lg border border-line p-2.5 text-sm">
              <div className="flex items-start justify-between gap-2"><Link to={`/app/bookings/${r.bookingId}`} onClick={() => close(DAY)} className="font-medium hover:text-brand-700">{r.contactName}<span className="ml-1 text-xs font-normal text-ink-500">{r.tourCode || r.number}</span></Link><TrackBadge status={r.status} /></div>
              <div className="mt-0.5 text-xs text-ink-600">Balance {money(r.balance)} of {money(r.total)} · {dueText(r)}</div>
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"><MessageCircle className="size-3.5" />Remind on WhatsApp</a>}
            </li>
          );
        })}
      </ul>
      {urgent.length > shown.length && <div className="mt-1 text-xs text-ink-500">+ {urgent.length - shown.length} more</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link to="/app/tracking" onClick={() => close(every * DAY)} className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">Open payment tracking</Link>
        <Button size="sm" variant="secondary" onClick={() => close(4 * 3_600_000)}>Remind in 4 hours</Button>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">Shows again every {every} day{every === 1 ? "" : "s"} until paid.</p>
    </div>
  );
}
