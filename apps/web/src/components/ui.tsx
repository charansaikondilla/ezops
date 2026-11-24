import {
  Component, forwardRef, useEffect, useId, useMemo, useState, type ButtonHTMLAttributes, type ErrorInfo, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Inbox, Loader2, Search, X, XCircle } from "lucide-react";
import { dismiss, toast, type Toast } from "../lib/toast";
import { titleCase } from "../lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ─────────── Buttons ─────────── */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink-800 border border-line hover:bg-slate-50 shadow-sm",
  ghost: "text-ink-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; busy?: boolean; icon?: ReactNode }>(
  ({ variant = "primary", size = "md", busy, icon, className, children, disabled, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm",
        BTN[variant], className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function ButtonLink({ to, variant = "primary", size = "md", className, children, icon }: { to: string; variant?: BtnVariant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <Link to={to} className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap", size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm", BTN[variant], className)}>
      {icon}
      {children}
    </Link>
  );
}

/* ─────────── Layout bits ─────────── */
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx("rounded-xl border border-line bg-white shadow-xs", padded && "p-4 sm:p-5", className)}>{children}</div>;
}

export function CardTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <Link to={back.to} className="mb-1 inline-block text-sm text-brand-700 hover:underline">← {back.label}</Link>}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "warn" | "bad"; icon?: ReactNode }) {
  const toneCls = { default: "text-ink-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" }[tone];
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-500">
        <span>{label}</span>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <div className={cx("mt-2 text-2xl font-semibold tabular-nums", toneCls)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

/* ─────────── Badges ─────────── */
type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "cyan";
const TONE: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-cyan-50 text-cyan-800 ring-cyan-200",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

/** One colour vocabulary for every status in the product (leads, quotes, bookings, invoices, visa…). */
const STATUS_TONE: Record<string, Tone> = {
  new: "blue", contacted: "cyan", quoted: "violet", negotiation: "amber", won: "green", lost: "gray",
  draft: "gray", sent: "blue", viewed: "violet", accepted: "green", rejected: "red", expired: "gray",
  confirmed: "green", in_progress: "blue", completed: "gray", cancelled: "red",
  pending: "amber", requested: "cyan",
  issued: "blue", partially_paid: "amber", paid: "green", open: "amber",
  enquiry: "gray", docs_pending: "amber", docs_received: "cyan", submitted: "blue", in_process: "violet", approved: "green", delivered: "gray",
  hot: "red", warm: "amber", cold: "blue", scheduled: "cyan", closed: "gray", departed: "gray",
  active: "green", inactive: "gray", blocked: "red",
  held: "amber", failed: "red", queued: "amber", skipped: "gray", read: "green", ticketed: "green", booked: "cyan",
  answered: "green", missed: "red", no_answer: "amber", busy: "amber", voicemail: "gray", in_review: "violet",
  reversed: "gray", accrued: "amber", created: "blue", converted: "green", released: "gray", started: "blue", assigned: "gray", issue: "red",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{label ?? titleCase(status)}</Badge>;
}

/* ─────────── Form controls ─────────── */
const inputCls = "block w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-ink-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...rest }, ref) => (
  <input ref={ref} className={cx(inputCls, "h-10", invalid && "border-rose-400 focus:border-rose-500 focus:ring-rose-100", className)} {...rest} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...rest }, ref) => (
  <textarea ref={ref} className={cx(inputCls, "py-2 min-h-[84px]", invalid && "border-rose-400", className)} {...rest} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...rest }, ref) => (
  <select ref={ref} className={cx(inputCls, "h-10 pr-8", invalid && "border-rose-400", className)} {...rest}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({ label, error, hint, children, className, required }: { label: ReactNode; error?: string | undefined; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}{required && <span className="text-rose-600"> *</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-700 disabled:opacity-50">
      <span className={cx("relative inline-block h-5 w-9 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-slate-300")}>
        <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

/** Money input that shows rupees and stores paise. */
export function MoneyInput({ value, onChange, invalid, placeholder, currency = "INR", ...rest }: { value: number | null | undefined; onChange: (minor: number | null) => void; invalid?: boolean; placeholder?: string; currency?: string; disabled?: boolean; id?: string; "aria-label"?: string }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value / 100));
  useEffect(() => {
    const cur = text === "" ? null : Math.round(Number(text) * 100);
    if (cur !== (value ?? null)) setText(value === null || value === undefined ? "" : String(value / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-400">{currency === "INR" ? "₹" : currency}</span>
      <Input
        {...rest}
        inputMode="decimal"
        invalid={invalid}
        placeholder={placeholder ?? "0"}
        className={currency === "INR" ? "pl-7" : "pl-12"}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          if (t === "") onChange(null);
          else if (!Number.isNaN(Number(t))) onChange(Math.round(Number((Number(t) * 100).toFixed(4))));
        }}
      />
    </div>
  );
}

/* ─────────── Modal ─────────── */
export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={cx("flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", w)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id={id} className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger, busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} busy={busy} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-sm text-ink-700">{message}</div>
    </Modal>
  );
}

/* ─────────── Tabs ─────────── */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cx("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors", value === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800")}>
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-ink-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ─────────── Data table (cards on phones) ─────────── */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide on the phone card layout */
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({ rows, columns, onRowClick, search, empty, initialSort, pageSize = 25, toolbar }: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void; search?: (row: T) => string; empty?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" }; pageSize?: number; toolbar?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    let r = rows;
    if (q && search) {
      const needle = q.toLowerCase();
      r = r.filter((x) => search(x).toLowerCase().includes(needle));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const f = col.sort;
        r = [...r].sort((a, b) => {
          const va = f(a);
          const vb = f(b);
          const c = va < vb ? -1 : va > vb ? 1 : 0;
          return sort.dir === "asc" ? c : -c;
        });
      }
    }
    return r;
  }, [rows, q, search, sort, columns]);
  useEffect(() => setPage(0), [q]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      {(search || toolbar) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {search ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <Input aria-label="Search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          ) : <span />}
          {toolbar && <div className="flex flex-wrap gap-2">{toolbar}</div>}
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty>{q ? `Nothing matches "${q}".` : empty ?? "Nothing here yet."}</Empty>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={cx("px-4 py-2.5", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                      {c.sort ? (
                        <button className="inline-flex items-center gap-1 uppercase hover:text-ink-800" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === "asc" ? "desc" : "asc" }))}>
                          {c.header}
                          {sort?.key === c.key && (sort.dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
                        </button>
                      ) : c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.map((r) => (
                  <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx(onRowClick && "cursor-pointer hover:bg-slate-50")}>
                    {columns.map((c) => (
                      <td key={c.key} className={cx("px-4 py-3 align-middle text-ink-800", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {view.map((r) => (
              <div key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx("rounded-xl border border-line bg-white p-3.5 shadow-xs", onRowClick && "active:bg-slate-50")}>
                {columns.filter((c) => !c.hideOnMobile).map((c, i) => (
                  <div key={c.key} className={cx("flex items-start justify-between gap-3 text-sm", i > 0 && "mt-1.5")}>
                    {i > 0 && <span className="shrink-0 text-xs text-ink-500">{c.header}</span>}
                    <span className={cx(i === 0 ? "font-medium text-ink-900" : "text-right text-ink-800")}>{c.render(r)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-ink-500">
              <span>{filtered.length} records</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="self-center">Page {page + 1} of {pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────── States ─────────── */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <Inbox className="mb-2 size-8 text-ink-300" />
      <div className="text-sm text-ink-500">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500" role="status">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <div className="flex items-start gap-2"><XCircle className="mt-0.5 size-4 shrink-0" /> <span>{message}</span></div>
      {onRetry && <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "good" | "bad"; title?: ReactNode; children: ReactNode }) {
  const map = {
    info: ["border-blue-200 bg-blue-50 text-blue-900", <Info key="i" className="mt-0.5 size-4 shrink-0" />],
    warn: ["border-amber-200 bg-amber-50 text-amber-900", <AlertTriangle key="w" className="mt-0.5 size-4 shrink-0" />],
    good: ["border-emerald-200 bg-emerald-50 text-emerald-900", <CheckCircle2 key="g" className="mt-0.5 size-4 shrink-0" />],
    bad: ["border-rose-200 bg-rose-50 text-rose-900", <XCircle key="b" className="mt-0.5 size-4 shrink-0" />],
  } as const;
  const [cls, icon] = map[tone];
  return (
    <div className={cx("flex gap-2 rounded-xl border p-3 text-sm", cls)}>
      {icon}
      <div>{title && <div className="font-medium">{title}</div>}{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 8 }: { name: string; size?: 6 | 8 | 10 }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const dim = { 6: "size-6 text-[10px]", 8: "size-8 text-xs", 10: "size-10 text-sm" }[size];
  return <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", dim)} style={{ background: `hsl(${hue} 55% 45%)` }} aria-hidden>{ini}</span>;
}

/* ─────────── Toasts ─────────── */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => toast.subscribe(setItems), []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:items-end" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cx("pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg",
          t.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : t.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-blue-200 bg-blue-50 text-blue-900")}>
          {t.kind === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : t.kind === "error" ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}

/* ─────────── Error boundary: one broken widget never blanks the app ─────────── */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="p-6"><ErrorNote message={`This screen hit a problem: ${this.state.error.message}. Your data is safe.`} onRetry={() => this.setState({ error: null })} /></div>
      );
    }
    return this.props.children;
  }
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 sm:block sm:border-0 sm:py-0">
          <dt className="text-ink-500">{k}</dt>
          <dd className="text-right font-medium text-ink-900 sm:text-left">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
