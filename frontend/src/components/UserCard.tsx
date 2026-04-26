// UserCard.tsx
// Dropdown user card — drop into your project and import in Index.tsx

import { useEffect, useRef, useState } from "react";
import {
  User,
  LogOut,
  Shield,
  Mail,
  Clock,
  ChevronRight,
  Activity,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserInfo {
  id?: number;
  username?: string;
  email?: string;
  full_name?: string;
  role?: string;
  is_active?: boolean;
  created_at?: string;
  last_login?: string;
}

interface UserCardProps {
  user: UserInfo | null;
  onLogout: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(user: UserInfo | null): string {
  if (!user) return "?";
  const name = user.full_name || user.username || user.email || "";
  return name
    .split(/[\s._@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getRoleColor(role?: string): string {
  switch (role?.toLowerCase()) {
    case "admin":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "pathologist":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "radiologist":
      return "text-sky-400 bg-sky-400/10 border-sky-400/20";
    default:
      return "text-primary bg-primary/10 border-primary/20";
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserCard({ user, onLogout }: UserCardProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const initials = getInitials(user);
  const displayName = user?.full_name || user?.username || "Unknown User";
  const roleColor = getRoleColor(user?.role);

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
        className={`
          relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
          border transition-all duration-200
          ${open
            ? "bg-primary/10 border-primary/30 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border"
          }
        `}
      >
        {/* Avatar circle */}
        <span
          className={`
            w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold
            ${open ? "bg-primary text-white" : "bg-muted text-muted-foreground"}
          `}
        >
          {user ? initials : <User className="w-3 h-3" />}
        </span>
        {/* Online dot */}
        {user?.is_active && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-card" />
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className={`
            absolute right-0 top-full mt-2 w-72
            bg-card border border-border rounded-2xl shadow-xl
            backdrop-blur-md overflow-hidden z-50
            animate-in fade-in-0 zoom-in-95 slide-in-from-top-2
            duration-150
          `}
        >
          {/* Header gradient strip */}
          <div
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, hsl(187 85% 40%), hsl(160 70% 40%))",
            }}
          />

          {/* ── Profile block ── */}
          <div className="px-4 pt-4 pb-3 flex items-start gap-3">
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-glow"
              style={{
                background:
                  "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))",
              }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate leading-tight">
                {displayName}
              </p>
              {user?.email && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {user.email}
                </p>
              )}

              {/* Role badge */}
              {user?.role && (
                <span
                  className={`
                    inline-flex items-center gap-1 mt-1.5 px-2 py-0.5
                    text-[10px] font-semibold rounded-full border
                    ${roleColor}
                  `}
                >
                  <Shield className="w-2.5 h-2.5" />
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Status row ── */}
          {user?.is_active !== undefined && (
            <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  user.is_active ? "bg-emerald-400" : "bg-muted-foreground"
                }`}
              />
              <span className="text-[11px] text-muted-foreground">
                Account status:{" "}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  user.is_active ? "text-emerald-400" : "text-muted-foreground"
                }`}
              >
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          )}

          {/* ── Meta rows ── */}
          <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden divide-y divide-border">
            {user?.email && (
              <MetaRow
                icon={<Mail className="w-3 h-3" />}
                label="Email"
                value={user.email}
              />
            )}
            {user?.created_at && (
              <MetaRow
                icon={<Clock className="w-3 h-3" />}
                label="Member since"
                value={formatDate(user.created_at)}
              />
            )}
            {user?.last_login && (
              <MetaRow
                icon={<Activity className="w-3 h-3" />}
                label="Last login"
                value={formatDate(user.last_login)}
              />
            )}
          </div>

          {/* ── Actions ── */}
          <div className="px-4 pb-4 flex flex-col gap-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="
                w-full flex items-center justify-between gap-2 px-3 py-2.5
                rounded-xl text-xs font-semibold
                text-destructive bg-destructive/5 hover:bg-destructive/10
                border border-destructive/20 hover:border-destructive/30
                transition-all duration-150 group
              "
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </span>
              <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-card hover:bg-muted/30 transition-colors">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-[11px] text-muted-foreground flex-shrink-0 w-20">
        {label}
      </span>
      <span className="text-[11px] text-foreground font-medium truncate">
        {value}
      </span>
    </div>
  );
}