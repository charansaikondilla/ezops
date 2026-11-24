// Browser smoke test: every route, every role, key flows, zero console errors.
// Usage: node scripts/smoke.mjs [baseUrl] [screenshotDir]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:4173/";
const SHOTS = process.argv[3] ?? "/tmp/voyadesk-shots";
mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

const failures = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });

let current = "";
page.on("console", (m) => { if (m.type() === "error") failures.push(`[console] ${current}: ${m.text()}`); });
page.on("pageerror", (e) => failures.push(`[pageerror] ${current}: ${e.message}`));
page.on("requestfailed", (r) => { if (!r.url().startsWith("data:")) failures.push(`[request] ${current}: ${r.url()} ${r.failure()?.errorText}`); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function visit(hash, expectText) {
  current = hash;
  await page.goto(`${BASE}#${hash}`, { waitUntil: "networkidle0" });
  // wait until loading spinners are gone
  for (let i = 0; i < 40; i++) {
    const loading = await page.evaluate(() => document.body.innerText.includes("Loading…") || document.body.innerText.includes("Opening your proposal"));
    if (!loading) break;
    await sleep(100);
  }
  await sleep(150);
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes("This screen hit a problem") || text.includes("Something went wrong")) failures.push(`[crash] ${hash}: ${text.slice(0, 300)}`);
  if (text.trim().length < 40) failures.push(`[blank] ${hash}`);
  if (expectText && !text.toLowerCase().includes(expectText.toLowerCase())) failures.push(`[missing] ${hash}: expected "${expectText}"`);
  return text;
}

async function clickText(text, selector = "button, a") {
  const ok = await page.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().includes(t) && !e.disabled);
    if (el) { el.click(); return true; }
    return false;
  }, text, selector);
  if (!ok) failures.push(`[click] ${current}: no clickable "${text}"`);
  await sleep(500);
  return ok;
}

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function loginAs(roleLabel) {
  await page.evaluate(() => { try { localStorage.removeItem("ezops.demo.user"); } catch {} });
  await visit("/login", "Open the live demo");
  await clickText(roleLabel, "button");
  await sleep(700);
}

const data = () => page.evaluate(() => JSON.parse(localStorage.getItem("ezops.demo.v1") ?? "{}").rows ?? {});

// ── Public website ──
await visit("/", "Run your whole travel business");
await shot("00-home");
for (const [h, t] of [["/", "Run your whole travel business"], ["/features", "Features"], ["/solutions/b2c", "B2C travel agencies"], ["/solutions/b2b-dmc", "DMCs"], ["/solutions/portals", "Travel portals"], ["/solutions/visa", "Visa businesses"], ["/pricing", "Simple pricing"], ["/integrations", "Integrations"], ["/contact", "Talk to sales"], ["/signup", "Get started with EZ ops"]]) await visit(h, t);
await shot("01-home");

// ── Owner: every back-office page ──
await loginAs("Owner");
const ownerRoutes = [
  ["/app", "Good"], ["/app/onboarding", "Setup guide"], ["/app/notifications", "Daily notifications"], ["/app/team", "Team performance"], ["/app/inbox", "Inbox"], ["/app/tasks", "Tasks"], ["/app/leads", "Leads"], ["/app/quotes", "Quotes"],
  ["/app/contacts", "Customers"], ["/app/ai", "AI studio"], ["/app/bookings", "Bookings"], ["/app/operations", "Ops board"], ["/app/operations/groups", "Group departures"],
  ["/app/resources", "Drivers"], ["/app/finance", "Finance overview"], ["/app/finance/invoices", "Invoices"], ["/app/finance/payments", "Payments"],
  ["/app/finance/payables", "Supplier payables"], ["/app/finance/ledger", "Trial balance"], ["/app/finance/tax", "GST"], ["/app/b2b", "B2B agents"],
  ["/app/visa", "Visa desk"], ["/app/marketing", "Campaigns"], ["/app/marketing?tab=segments", "Segment"], ["/app/marketing?tab=drips", "Drip"],
  ["/app/marketing?tab=landing", "Landing"], ["/app/marketing?tab=coupons", "FESTIVE10"], ["/app/portals", "Website & portals"],
  ["/app/masters", "Packages"], ["/app/masters?tab=hotels", "Hotels"], ["/app/masters?tab=sightseeing", "Sightseeing"], ["/app/masters?tab=transfers", "Transfers"],
  ["/app/masters?tab=visa", "Visa masters"], ["/app/masters?tab=suppliers", "Suppliers"], ["/app/reports", "Profit & loss"],
  ["/app/settings", "Company"], ["/app/settings?tab=team", "Team"], ["/app/settings?tab=modules", "Modules"], ["/app/settings?tab=tax", "GST rules"],
  ["/app/settings?tab=routing", "Lead routing"], ["/app/settings?tab=integrations", "Payments & automation"], ["/app/settings?tab=data", "Demo data"],
];
for (const [h, t] of ownerRoutes) await visit(h, t);
await visit("/app", "Revenue vs collections");
await shot("02-owner-dashboard");
const ledgerText = await visit("/app/finance/ledger", "Balanced");
if (!ledgerText.includes("Balanced")) failures.push("[books] trial balance not balanced");

// Detail pages
let rows = await data();
const lead = rows.leads.find((l) => l.stage === "quoted") ?? rows.leads[0];
const booking = rows.bookings.find((b) => b.status !== "cancelled");
const invoice = rows.invoices[0];
const visa = rows.visaCases[0];
const agent = rows.agents[0];
const draftQuote = rows.quotes.find((q) => q.status !== "accepted" && !q.agentId) ?? rows.quotes[0];
const lockedQuote = rows.quotes.find((q) => q.status === "accepted");
await visit(`/app/leads/${lead.id}`, "Why this score");
await visit(`/app/quotes/${draftQuote.id}`, "Before you send");
await shot("03-quote-builder");
const lockedText = await visit(`/app/quotes/${lockedQuote.id}`, "This quote is locked");
if (lockedText.includes("Before you send")) failures.push("[ui] locked quote still shows the pre-send check");
await visit(`/app/bookings/${booking.id}`, "Services & vouchers");
await shot("04-booking-file");
await visit(`/app/finance/invoices/${invoice.id}`, "Invoice lines");
await visit(`/app/visa/${visa.id}`, "Move case forward");
await visit(`/app/b2b/${agent.id}`, "Account statement");
const svc = rows.services.find((s) => s.voucherNo);
await visit(`/print/invoice/${invoice.id}`, "Tax invoice");
await visit(`/print/voucher/${svc.id}`, "Service voucher");
await visit(`/print/quote/${draftQuote.id}`, "Travel proposal");

// Flow 1: AI quote from a WhatsApp message
await visit("/app/ai", "Quote from a message");
await page.type("textarea", "5N Dubai, 4 pax, 27 Jan, budget 2.4L");
await clickText("Create lead + draft quote");
await sleep(800);
let t = await page.evaluate(() => document.body.innerText);
if (!t.includes("Review quote")) failures.push(`[flow] AI quote did not produce a result: ${t.slice(0, 200)}`);
await shot("05-ai-studio");

// Flow 2: new lead by form → build quote
await visit("/app/leads?new=1", "New lead");
await page.evaluate(() => {
  const set = (label, value) => {
    const lab = [...document.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(label));
    const input = lab?.querySelector("input, select, textarea");
    if (!input) return;
    const proto = input.tagName === "SELECT" ? HTMLSelectElement.prototype : input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  set("Name", "Smoke Test Customer");
  set("Phone", "+91 99999 12345");
  set("Destination", "Goa");
  const d = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  set("Travel date", d);
  set("Nights", "3");
});
await clickText("Create lead", "button");
await sleep(900);
t = await page.evaluate(() => document.body.innerText);
if (!t.includes("Smoke Test Customer")) failures.push("[flow] lead creation did not open the lead");
await clickText("Build quote", "button");
await sleep(900);
t = await page.evaluate(() => document.body.innerText);
if (!t.includes("Before you send")) failures.push("[flow] build quote did not open the builder");
await clickText("Send", "button");
await sleep(900);
t = await page.evaluate(() => document.body.innerText);
if (!t.includes("Proposal is ready to share")) failures.push("[flow] send quote did not show the share link");

// Flow 3: customer proposal → book & pay
rows = await data();
const sent = rows.quotes.find((q) => q.contactName === "Smoke Test Customer" && q.status === "sent");
if (!sent) failures.push("[flow] sent quote not found");
else {
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await visit(`/p/demo/${sent.shareToken}`, "Your itinerary");
  await shot("06-proposal-mobile");
  await clickText("Book now", "button");
  await sleep(1000);
  await visit(page.url().split("#")[1] ?? "/", "Amount to pay");
  await clickText("(test)", "button");
  await sleep(1000);
  t = await page.evaluate(() => document.body.innerText);
  if (!t.includes("Payment received")) failures.push("[flow] proposal payment did not confirm the booking");
  await shot("07-proposal-booked");
  await page.setViewport({ width: 1366, height: 900 });
}
rows = await data();
const led = rows.ledger;
const dr = led.reduce((a, e) => a + e.debit, 0);
const cr = led.reduce((a, e) => a + e.credit, 0);
if (dr !== cr) failures.push(`[books] after flows debits ${dr} != credits ${cr}`);

// Public storefront, package, visa tracker, landing page
await visit("/store/demo", "Holiday packages");
const pkg = rows.packages.find((p) => p.published);
await visit(`/store/demo/package/${pkg.id}`, "Book online");
await visit("/visa-status/demo", "Track your visa");
const lp = rows.landingPages.find((l) => l.published);
await visit(`/lp/demo/${lp.slug}`, "Get the offer");

// ── Other roles land on their own screens ──
for (const [label, home, expect] of [["Sales", "/app/leads", "Leads"], ["Operations", "/app/operations", "Ops board"], ["Accounts", "/app/finance", "Finance overview"], ["Visa desk", "/app/visa", "Visa desk"], ["Marketing", "/app/marketing", "Campaigns"]]) {
  await loginAs(label);
  await sleep(400);
  const url = page.url();
  if (!url.includes(`#${home}`)) failures.push(`[role] ${label} landed on ${url}`);
  await visit("/app", expect === "Leads" ? "Hot leads" : "Good");
}
await loginAs("Sales");
await visit("/app/settings", "");
if (page.url().includes("/app/settings")) failures.push("[role] sales reached settings");


// ── Feature pack: every new back-office page ──
await loginAs("Owner");
for (const [h, t] of [
  ["/app/calls", "Calls"], ["/app/engines", "Flights, hotels"], ["/app/engines?tab=hotels", "Hotels"], ["/app/engines?tab=series", "Series fares"], ["/app/engines?tab=insurance", "Quote this plan"],
  ["/app/inventory", "Rooms left"], ["/app/inventory?tab=series", "Series fares"], ["/app/inventory?tab=plans", "Insurance plans"], ["/app/inventory?tab=vehicles", "Vehicle rates"], ["/app/inventory?tab=import", "Import a supplier rate sheet"],
  ["/app/insurance", "Claims"], ["/app/messages", "Messages"], ["/app/approvals", "Approvals"], ["/app/finance/links", "Payment links"],
  ["/app/ai", "Quote from a message"], ["/app/ai?tab=import", "Turn an email or PDF"], ["/app/ai?tab=itinerary", "Supplier itinerary"], ["/app/ai?tab=insights", "forecast"],
]) await visit(h, t);
await visit("/app", "Needs attention");
await shot("20-attention");
await visit("/app/calls", "Call-back rate");
await shot("21-calls");
await visit("/app/ai?tab=insights", "Leads most likely to book");
await shot("22-insights");

// Staff flight search → results
await visit("/app/engines", "Flights");
await clickText("Search", "button");
await sleep(400);
if (!(await page.evaluate(() => /sell \(incl\. tax\)/i.test(document.body.innerText)))) failures.push("[engines] flight search returned no results table");
await shot("23-engines");

// Approve the pending booking change
await visit("/app/approvals", "Approvals");
const hadPending = await page.evaluate(() => [...document.querySelectorAll("main button")].some((b) => b.textContent?.trim() === "Approve"));
if (!hadPending) failures.push("[approvals] no pending change to approve in demo data");
else {
  await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.textContent?.trim() === "Approve")?.click());
  await sleep(800);
  await sleep(600);
  const after = await data();
  if (!(after.amendments ?? []).some((a) => a.status === "approved")) failures.push("[approvals] change was not approved");
}
const ledgerAfter = await visit("/app/finance/ledger", "Balanced");
if (!ledgerAfter.includes("Balanced")) { await shot("debug-ledger"); failures.push(`[books] not balanced after approving a change: ${ledgerAfter.slice(0, 600).replace(/\n/g, " | ")}`); }

// Quote with Option A/B shows the options control
rows = await data();
const optQuote = (rows.quotes ?? []).find((q) => (q.options ?? []).length === 2);
if (!optQuote) failures.push("[options] no quote with options in demo data");
else await visit(`/app/quotes/${optQuote.id}`, "2 options");

// ── Customer side: website engines, language, chat ──
await visit("/book/demo/flights", "Flights");
await clickText("Search", "button");
await sleep(500);
if (!(await page.evaluate(() => document.body.innerText.includes("Book now")))) failures.push("[site] flight results missing");
await shot("24-site-flights");
await visit("/book/demo/hotels", "Hotels");
await clickText("Search", "button");
await sleep(500);
await shot("25-site-hotels");
await visit("/book/demo/series", "seats left");
await visit("/book/demo/insurance", "Asia Smart");
await visit("/store/demo", "Holiday packages");
await page.select('select', 'hi');
await sleep(300);
if (!(await page.evaluate(() => document.body.innerText.includes("हॉलिडे")))) failures.push("[i18n] Hindi labels missing");
await page.select('select', 'en');
await clickText("Chat with us", "button");
await page.type('input[aria-label="Your name"]', "Smoke Test");
await page.type('input[aria-label="Mobile number"]', "+91 99999 12345");
await clickText("Start chat", "button");
await page.type('input[aria-label="Type your message…"]', "Goa 3N for 2 adults on 20 Dec");
await page.keyboard.press("Enter");
await sleep(900);
if (!(await page.evaluate(() => /travel expert|Thanks|share destination/i.test(document.body.innerText)))) failures.push("[chat] bot did not reply");
await shot("26-chat");

// Proposal → online payment (sandbox) → booking
rows = await data();
const openQuote = (rows.quotes ?? []).find((q) => ["sent", "viewed"].includes(q.status) && (q.options ?? []).length === 0 && q.validUntil && q.startDate);
if (!openQuote) failures.push("[pay] no open proposal in demo data");
else {
  await visit(`/p/demo/${openQuote.shareToken}`, "Pay online");
  await shot("27-proposal");
  await clickText("Book now", "button");
  await sleep(800);
  await visit(page.url().split("#")[1] ?? "/", "Amount to pay");
  await shot("28-pay");
  await clickText("(test)", "button");
  await sleep(800);
  if (!(await page.evaluate(() => document.body.innerText.includes("Payment received")))) failures.push("[pay] sandbox payment did not complete");
}

// Customer portal sign-in with a one-time code
await visit("/my/demo", "My trips");
await page.type('input[autocomplete="username"]', "neha.k@example.com");
await clickText("Send me a code", "button");
await sleep(600);
const code = await page.evaluate(() => /your code is (\d{6})/i.exec(document.body.innerText)?.[1] ?? "");
if (!code) failures.push("[portal] no demo code shown");
else {
  await page.type('input[autocomplete="one-time-code"]', code);
  await clickText("Sign in", "button");
  await sleep(800);
  if (!(await page.evaluate(() => document.body.innerText.includes("Hi Neha")))) failures.push("[portal] sign-in failed");
  await shot("29-portal");
}

// Visa document upload link and payment link page render
rows = await data();
const vc = (rows.visaCases ?? []).find((v) => v.status === "docs_pending");
if (vc) await visit(`/visa-upload/demo/${vc.uploadToken}`, "visa documents");
const link = (rows.paymentLinks ?? []).find((l) => l.status === "created");
if (link) await visit(`/pay/demo/${link.token}`, "Amount to pay");

// B2B agent portal
await loginAs("B2B agent");
for (const [h, x] of [["/agent", "Welcome"], ["/agent/packages", "Packages"], ["/agent/quotes", "My quotes"], ["/agent/bookings", "My bookings"], ["/agent/visa", "Visa applications"], ["/agent/statement", "Statement"]]) await visit(h, x);
await shot("08-agent-portal");
const agentQuotesText = await visit("/agent/quotes", "My quotes");
if (agentQuotesText.includes("Net cost")) failures.push("[privacy] agent sees net cost");

// Driver field app
await loginAs("Driver / guide");
await visit("/field", "Your jobs");
await page.setViewport({ width: 390, height: 844, isMobile: true });
await visit("/field", "Your jobs");
await shot("09-field-app");

// Mobile back office
await loginAs("Owner");
await visit("/app", "Good");
await shot("10-dashboard-mobile");
await visit("/app/leads", "Leads");
await shot("11-leads-mobile");

await browser.close();
const unique = [...new Set(failures)];
if (unique.length) {
  console.log(`FAILURES (${unique.length}):\n` + unique.join("\n"));
  process.exit(1);
}
console.log(`SMOKE OK — all routes and flows passed with zero console errors. Screenshots in ${SHOTS}`);
