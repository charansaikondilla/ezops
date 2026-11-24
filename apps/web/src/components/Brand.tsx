import { Link } from "react-router-dom";
import { cx } from "./ui";

/** Product name lives here — rename the product in one place. */
export const PRODUCT_NAME = "EZ ops";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1d5fd1" />
      <text x="16" y="21.5" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="14.5" fontWeight="800" fill="white" letterSpacing="-0.5">EZ</text>
    </svg>
  );
}

export function Brand({ dark, to = "/" }: { dark?: boolean; to?: string }) {
  return (
    <Link to={to} className={cx("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight", dark ? "text-white" : "text-ink-900")}>
      <Logo />
      {PRODUCT_NAME}
    </Link>
  );
}
