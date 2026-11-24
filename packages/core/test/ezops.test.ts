import { describe, expect, it } from "vitest";
import {
  addDays, createRow, isoDate, MemoryStore, runAction, runPublicAction, runReport, trialBalance, type Ctx, type LedgerEntry, type Role,
} from "../src/index.js";

const NOW = new Date("2026-11-15T05:30:00Z");
const ctx = (role: Role = "owner", userId = "u1"): Ctx => ({ tenantId: "demo", userId, role, agentId: null, now: NOW });
const pub = (): Ctx => ({ ...ctx("admin"), userId: "public" });
const day = (n: number) => addDays(isoDate(NOW), n);
const balanced = async (s: MemoryStore) => trialBalance((await s.list("ledger")) as unknown as LedgerEntry[]).balanced;

async function setup() {
  const s = new MemoryStore();
  const sup = await createRow(s, "suppliers", { name: "Sea Breeze Resorts", category: "hotel", city: "Bali", paymentTermsDays: 7 }, NOW);
  await createRow(s, "hotels", { name: "Ubud Villa", city: "Bali", country: "Indonesia", stars: 4, supplierId: sup.id, rates: [{ roomType: "Pool villa", mealPlan: "CP", season: "regular", netPerNight: 450_000, currency: "INR" }] }, NOW);
  const owner = await createRow(s, "users", { name: "Owner One", email: "o@x.in", role: "owner" }, NOW);
  const sales = await createRow(s, "users", { name: "Sales Sam", email: "s@x.in", role: "sales" }, NOW);
  await createRow(s, "users", { name: "Accounts", email: "a@x.in", role: "accounts" }, NOW);
  return { s, owner, sales };
}

async function bookedTrip(s: MemoryStore, owner: { id: string }, extra: Record<string, unknown> = {}) {
  const { lead } = (await runAction(s, ctx("owner", owner.id), "captureLead", { name: "Tanvi Bhatt", phone: "+91 98765 43210", source: "website", destination: "Bali", travelDate: day(40), days: 7, adults: 2, bookingType: "honeymoon", ...extra })) as { lead: { id: string; nights: number; days: number } };
  const q = (await runAction(s, ctx("owner", owner.id), "createQuoteFromLead", { leadId: lead.id })) as { id: string; tourCode: string; bookingType: string };
  await runAction(s, ctx("owner", owner.id), "sendQuote", { quoteId: q.id, channel: "link" });
  const done = (await runAction(s, ctx("owner", owner.id), "acceptQuote", { quoteId: q.id })) as { booking: { id: string; tourCode: string; bookingType: string }; invoice: { id: string; total: number } };
  return { lead, q, ...done };
}

describe("EZ ops: lead form, tour code and booking type", () => {
  it("keeps days, 'other' source detail, referral, and booking type; nights follow days", async () => {
    const { s, owner } = await setup();
    const a = (await runAction(s, ctx("owner", owner.id), "captureLead", { name: "A", phone: "+91 90000 00001", source: "other", sourceDetail: "Travel expo stall", destination: "Dubai", days: 6, adults: 2, bookingType: "family" })) as { lead: Record<string, unknown> };
    expect(a.lead).toMatchObject({ source: "other", sourceDetail: "Travel expo stall", referredBy: "", days: 6, nights: 5, bookingType: "family" });
    const b = (await runAction(s, ctx("owner", owner.id), "captureLead", { name: "B", phone: "+91 90000 00002", source: "referral", referredBy: "Ravi (customer)", sourceDetail: "ignored", destination: "Goa", adults: 2 })) as { lead: Record<string, unknown> };
    expect(b.lead).toMatchObject({ source: "referral", referredBy: "Ravi (customer)", sourceDetail: "" });
  });

  it("generates a tour code on the quote and carries it with the booking type to the booking", async () => {
    const { s, owner } = await setup();
    const t = await bookedTrip(s, owner);
    expect(t.q.tourCode).toMatch(/^BAL-\d{4}-001$/);
    expect(t.booking).toMatchObject({ tourCode: t.q.tourCode, bookingType: "honeymoon" });
    const second = await bookedTrip(s, owner, { phone: "+91 90000 00003", name: "Second" });
    expect(second.q.tourCode).toMatch(/^BAL-\d{4}-002$/);
  });

  it("stores passport first/last name, issue and expiry on the customer", async () => {
    const { s } = await setup();
    const c = await createRow(s, "contacts", { name: "Ananya Sharma", passportNo: "K1234567", passportFirstName: "ANANYA", passportLastName: "SHARMA", passportIssue: "2022-03-01", passportExpiry: "2032-02-28" }, NOW);
    expect(c).toMatchObject({ passportFirstName: "ANANYA", passportLastName: "SHARMA", passportIssue: "2022-03-01", passportExpiry: "2032-02-28" });
  });
});

describe("EZ ops: lead handling history", () => {
  it("records who the lead is assigned to and every hand-over with staff names", async () => {
    const { s, owner, sales } = await setup();
    const { lead } = (await runAction(s, ctx("owner", owner.id), "captureLead", { name: "Hist", phone: "+91 90000 00009", source: "website", destination: "Bali", adults: 2 })) as { lead: { id: string } };
    await runAction(s, ctx("owner", owner.id), "assignLead", { leadId: lead.id, ownerId: owner.id }); // auto-routing gave it to the sales user
    const log = (await s.list("activities")).filter((a) => a.leadId === lead.id).map((a) => a.body);
    expect(log.some((b) => /assigned to/.test(b))).toBe(true);
    expect(log.some((b) => b.includes("from Sales Sam to Owner One by Owner One"))).toBe(true);
    await expect(runAction(s, ctx("sales", sales.id), "assignLead", { leadId: lead.id, ownerId: sales.id })).rejects.toThrow(/permission/);
  });
});

describe("EZ ops: payment links have no EMI", () => {
  it("never creates an EMI link, even when one is requested", async () => {
    const { s, owner } = await setup();
    const { q } = await bookedTrip(s, owner);
    const full = (await s.get("quotes", q.id))!;
    // a fresh quote to pay online
    const { lead } = (await runAction(s, ctx("owner", owner.id), "captureLead", { name: "Payer", phone: "+91 90000 00044", source: "website", destination: "Bali", travelDate: day(30), nights: 3, adults: 2 })) as { lead: { id: string } };
    const q2 = (await runAction(s, ctx("owner", owner.id), "createQuoteFromLead", { leadId: lead.id })) as { id: string; shareToken: string };
    await runAction(s, ctx("owner", owner.id), "sendQuote", { quoteId: q2.id, channel: "link" });
    const link = (await runPublicAction(s, pub(), "proposalPay", { token: q2.shareToken, selectedOptionalIds: [], mode: "full", emiMonths: 6 })) as { token: string; emiMonths: number };
    expect(link.emiMonths).toBe(0);
    const info = (await runPublicAction(s, pub(), "payLinkInfo", { token: link.token })) as { emi: unknown[] };
    expect(info.emi).toEqual([]);
    await expect(runPublicAction(s, pub(), "sandboxPay", { token: link.token, method: "emi" })).rejects.toThrow();
    expect(full.id).toBe(q.id);
  });
});

describe("EZ ops: supplier payables can be edited", () => {
  it("changes due date, reference and amount with a balanced ledger adjustment, and refuses to go below what was paid", async () => {
    const { s, owner } = await setup();
    await bookedTrip(s, owner);
    const bill = (await s.list("supplierBills"))[0]!;
    const edited = (await runAction(s, ctx("accounts", "acc"), "updateSupplierBill", { billId: bill.id, dueDate: day(10), reference: "INV-77", amount: bill.amount + 100_000 })) as { amount: number; dueDate: string; reference: string; status: string };
    expect(edited).toMatchObject({ amount: bill.amount + 100_000, dueDate: day(10), reference: "INV-77", status: "open" });
    expect(await balanced(s)).toBe(true);
    await runAction(s, ctx("accounts", "acc"), "paySupplierBill", { billId: bill.id, amount: 200_000 });
    await expect(runAction(s, ctx("accounts", "acc"), "updateSupplierBill", { billId: bill.id, amount: 100_000 })).rejects.toThrow(/already been paid/);
    const lower = (await runAction(s, ctx("accounts", "acc"), "updateSupplierBill", { billId: bill.id, amount: 200_000 })) as { status: string };
    expect(lower.status).toBe("paid");
    expect(await balanced(s)).toBe(true);
    await expect(runAction(s, ctx("sales", "x"), "updateSupplierBill", { billId: bill.id, dueDate: day(5) })).rejects.toThrow(/permission/);
  });
});

describe("EZ ops: payment tracking and booking register", () => {
  it("shows advance, balance, due date and reminders, and the register filters by staff, travel date and days", async () => {
    const { s, owner, sales } = await setup();
    const t = await bookedTrip(s, owner);
    const inv = (await s.get("invoices", t.invoice.id))!;
    await runAction(s, ctx("accounts", "acc"), "recordPayment", { invoiceId: inv.id, amount: Math.round(inv.total * 0.3), method: "upi" });
    const track = (await runReport(s, ctx("owner", owner.id), "paymentTracking", {})) as { rows: { advance: number; balance: number; total: number; status: string; tourCode: string; needsReminder: boolean }[]; reminders: unknown[]; totals: { balance: number } };
    const row = track.rows[0]!;
    expect(row.advance).toBe(Math.round(inv.total * 0.3));
    expect(row.balance).toBe(inv.total - row.advance);
    expect(row).toMatchObject({ status: "advance_received", needsReminder: true, tourCode: t.booking.tourCode });
    expect(track.reminders.length).toBe(1);

    const reg = (await runReport(s, ctx("owner", owner.id), "bookingRegister", { ownerId: sales.id, minDays: 7, maxDays: 8, from: day(30), to: day(50), q: t.booking.tourCode.toLowerCase() })) as { rows: { staffName: string; days: number; startDate: string }[]; totals: { count: number } };
    expect(reg.totals.count).toBe(1);
    expect(reg.rows[0]).toMatchObject({ staffName: "Sales Sam", days: 7, startDate: day(40) });
    const none = (await runReport(s, ctx("owner", owner.id), "bookingRegister", { minDays: 20 })) as { totals: { count: number } };
    expect(none.totals.count).toBe(0);
    const byDays = (await runReport(s, ctx("owner", owner.id), "pnl", { groupBy: "days" })) as { rows: { label: string }[] };
    expect(byDays.rows[0]!.label).toBe("7 days");
  });
});
