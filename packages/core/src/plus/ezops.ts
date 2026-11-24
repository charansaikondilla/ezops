/**
 * EZ ops additions: lead hand-over history, editable supplier payables, payment tracking with advance and
 * travel follow-up reminders, and the booking register (staff, date of travel, number of days).
 */
import { z } from "zod";
import { internals, registerActions } from "../actions.js";
import { daysBetween, type ISODate } from "../dates.js";
import { supplierBillLegs, type Leg } from "../ledger.js";
import { registerActionRoles } from "../permissions.js";
import { registerReports } from "../reports.js";
import { DomainError } from "../rules.js";
import { getSettings, mustGet, patchRow, todayOf, type Ctx, type Store } from "../store.js";
import { isValidISODate } from "../dates.js";
import { action, log, money, optStr, rupees } from "./shared.js";

const { postLedger } = internals;
const reverse = (legs: Leg[]): Leg[] => legs.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));

/* ───────────────────────── actions ───────────────────────── */

registerActionRoles({
  assignLead: ["owner", "admin"],
  updateSupplierBill: ["owner", "admin", "accounts"],
});

registerActions({
  /** Hand a lead to another staff member; the hand-over is written to the lead's history with both names. */
  assignLead: action(z.object({ leadId: z.string(), ownerId: z.string().nullable() }), async (s, ctx, i) => {
    const lead = await mustGet(s, "leads", i.leadId);
    const to = i.ownerId ? await mustGet(s, "users", i.ownerId) : null;
    if (to && !to.active) throw new DomainError(`${to.name} is deactivated and can't be given leads.`, 409);
    if ((lead.ownerId ?? null) === (i.ownerId ?? null)) return lead;
    const from = lead.ownerId ? await s.get("users", lead.ownerId) : undefined;
    const by = await s.get("users", ctx.userId);
    const out = await patchRow(s, "leads", lead.id, { ownerId: i.ownerId, lastActivityAt: ctx.now.toISOString() }, ctx.now);
    await log(s, ctx, { leadId: lead.id, body: `Handed over from ${from?.name ?? "Unassigned"} to ${to?.name ?? "Unassigned"} by ${by?.name ?? "system"}.` });
    return out;
  }),

  /** Edit a supplier bill. A changed amount posts a balanced ledger adjustment so the books stay correct. */
  updateSupplierBill: action(z.object({
    billId: z.string(), amount: money.optional(), dueDate: z.string().refine(isValidISODate, "Use a valid date").optional(), reference: optStr(80),
  }), async (s, ctx, i) => {
    const bill = await mustGet(s, "supplierBills", i.billId);
    const patch: Record<string, unknown> = {};
    if (i.dueDate !== undefined) patch["dueDate"] = i.dueDate;
    if (i.reference !== undefined) patch["reference"] = i.reference;
    if (i.amount !== undefined && i.amount !== bill.amount) {
      if (i.amount <= 0) throw new DomainError("A bill amount must be more than zero.", 422);
      if (i.amount < bill.paid) throw new DomainError(`${bill.supplierName || "This supplier"} has already been paid ${rupees(bill.paid)}, so the bill can't go below that.`, 409);
      const settings = await getSettings(s, ctx.now);
      const today = todayOf(ctx, settings);
      const party = { type: "supplier" as const, id: bill.supplierId, name: bill.supplierName };
      const delta = i.amount - bill.amount;
      const legs = supplierBillLegs({ party, amount: Math.abs(delta) });
      await postLedger(s, ctx, today, delta > 0 ? legs : reverse(legs), { type: "supplierBill", id: bill.id, memo: `Bill amount changed ${rupees(bill.amount)} → ${rupees(i.amount)} — ${bill.supplierName}` });
      patch["amount"] = i.amount;
      patch["status"] = bill.paid >= i.amount ? "paid" : bill.paid > 0 ? "partially_paid" : "open";
    }
    if (Object.keys(patch).length === 0) return bill;
    const out = await patchRow(s, "supplierBills", bill.id, patch, ctx.now);
    if (bill.bookingId) await log(s, ctx, { bookingId: bill.bookingId, body: `Supplier bill for ${bill.supplierName || "supplier"} edited.` });
    return out;
  }),
});

/* ───────────────────────── reports ───────────────────────── */

const outstandingOf = (i: { total: number; paid: number; credited: number }) => Math.max(0, i.total - i.paid - i.credited);

type TrackStatus = "paid" | "overdue" | "due_soon" | "advance_received" | "no_advance";

async function trackingRows(s: Store, ctx: Ctx) {
  const settings = await getSettings(s, ctx.now);
  const today = todayOf(ctx, settings);
  const [bookings, invoices, users] = await Promise.all([s.list("bookings"), s.list("invoices"), s.list("users")]);
  const scoped = bookings.filter((b) => b.status !== "cancelled" && (ctx.role !== "sales" || b.ownerId === ctx.userId));
  return scoped.map((b) => {
    const inv = b.invoiceId ? invoices.find((x) => x.id === b.invoiceId) : undefined;
    const total = inv ? inv.total : b.sellTotal;
    const advance = inv ? inv.paid : 0;
    const balance = inv ? outstandingOf(inv) : total;
    const balanceDue: ISODate = new Date(Date.parse(`${b.startDate}T00:00:00Z`) - settings.balanceDueDaysBefore * 86_400_000).toISOString().slice(0, 10);
    const daysToTravel = daysBetween(today, b.startDate);
    const daysToBalanceDue = daysBetween(today, balanceDue);
    let status: TrackStatus;
    if (balance <= 0) status = "paid";
    else if (daysToBalanceDue < 0) status = "overdue";
    else if (daysToBalanceDue <= 7) status = "due_soon";
    else status = advance > 0 ? "advance_received" : "no_advance";
    return {
      bookingId: b.id, number: b.number, tourCode: b.tourCode, contactName: b.contactName, phone: b.phone, destination: b.destination,
      startDate: b.startDate, endDate: b.endDate, days: Math.max(1, daysBetween(b.startDate, b.endDate) + 1), bookingType: b.bookingType,
      ownerId: b.ownerId, staffName: users.find((u) => u.id === b.ownerId)?.name ?? "Unassigned",
      total, advance, balance, balanceDue, daysToTravel, daysToBalanceDue, status, invoiceId: b.invoiceId,
      /** Needs a follow-up: money still owed and the trip has not finished. */
      needsReminder: balance > 0 && daysToTravel >= -1,
    };
  });
}

async function paymentTracking(s: Store, ctx: Ctx) {
  const settings = await getSettings(s, ctx.now);
  const rows = (await trackingRows(s, ctx)).sort((a, b) => a.daysToBalanceDue - b.daysToBalanceDue);
  const open = rows.filter((r) => r.balance > 0);
  return {
    today: todayOf(ctx, settings), balanceDueDaysBefore: settings.balanceDueDaysBefore, reminderEveryDays: settings.reminderEveryDays,
    rows,
    totals: {
      total: rows.reduce((a, r) => a + r.total, 0), advance: rows.reduce((a, r) => a + r.advance, 0), balance: open.reduce((a, r) => a + r.balance, 0),
      overdue: rows.filter((r) => r.status === "overdue").length, dueSoon: rows.filter((r) => r.status === "due_soon").length,
      noAdvance: rows.filter((r) => r.status === "no_advance").length,
    },
    reminders: rows.filter((r) => r.needsReminder).slice(0, 50),
  };
}

const registerParams = z.object({
  from: z.string().nullable().optional(), to: z.string().nullable().optional(), ownerId: z.string().nullable().optional(),
  destination: z.string().max(80).optional(), minDays: z.number().int().min(1).max(120).nullable().optional(), maxDays: z.number().int().min(1).max(120).nullable().optional(),
  q: z.string().max(80).optional(),
});

async function bookingRegister(s: Store, ctx: Ctx, p: z.output<typeof registerParams>) {
  const q = (p.q ?? "").trim().toLowerCase();
  const rows = (await trackingRows(s, ctx)).filter((r) =>
    (!p.from || r.startDate >= p.from) && (!p.to || r.startDate <= p.to) && (!p.ownerId || r.ownerId === p.ownerId) &&
    (!p.destination || r.destination.toLowerCase() === p.destination.toLowerCase()) && (!p.minDays || r.days >= p.minDays) && (!p.maxDays || r.days <= p.maxDays) &&
    (!q || `${r.tourCode} ${r.number} ${r.contactName} ${r.phone} ${r.destination} ${r.staffName}`.toLowerCase().includes(q)),
  ).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return {
    rows,
    totals: { count: rows.length, total: rows.reduce((a, r) => a + r.total, 0), advance: rows.reduce((a, r) => a + r.advance, 0), balance: rows.reduce((a, r) => a + r.balance, 0), days: rows.reduce((a, r) => a + r.days, 0) },
  };
}

registerReports({
  paymentTracking: { params: z.object({}).passthrough(), roles: ["owner", "admin", "accounts", "sales"], run: paymentTracking as never },
  bookingRegister: { params: registerParams, roles: ["owner", "admin", "accounts", "sales"], run: bookingRegister as never },
});
