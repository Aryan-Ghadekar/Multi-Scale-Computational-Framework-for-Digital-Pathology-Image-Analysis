import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Microscope, Users, FlaskConical, FileText,
  AlertTriangle, CheckCircle2, Search, LogOut, RefreshCw,
  Trash2, CheckCheck, ChevronDown, ChevronUp, Activity,
  Eye, UserCheck, BarChart3, ArrowUpRight, Filter,
  ShieldCheck, Stethoscope, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { persistor, RootState, type AppDispatch } from "@/app/store";
import { clearProfile } from "@/features/user/profileSlice";
import { logout } from "@/features/auth/authSlice";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_patients: number;
  total_analyses: number;
  total_reports: number;
  total_users: number;
  high_risk_cases: number;
  analyses_today: number;
  analyses_this_week: number;
  avg_lesion_probability: number;
  finalized_reports: number;
  pending_reports: number;
}

interface PatientSummary {
  id: number;
  case_id: string;
  name: string;
  age: number;
  gender: string;
  contact_info?: string;
  medical_history?: string;
  analysis_count: number;
  report_count: number;
  latest_lesion_probability?: number;
  latest_confidence_level?: string;
  created_at: string;
  updated_at?: string;
}

interface AnalysisSummary {
  id: number;
  case_id: string;
  patient_id: number;
  patient_name?: string;
  lesion_probability: number;
  overall_confidence: number;
  confidence_level: string;
  ai_explanation?: string;
  image_path?: string;
  created_at: string;
}

interface ReportSummary {
  id: number;
  case_id: string;
  patient_id: number;
  patient_name?: string;
  analysis_id: number;
  report_path: string;
  generated_at: string;
  is_finalized: boolean;
}

interface UserSummary {
  id: string;
  full_name?: string;
  role?: string;
  email?: string;
  created_at?: string;
}

// ── API ───────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:8000";

async function adminFetch(path: string,  token: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

const RiskBadge = ({ prob }: { prob?: number }) => {
  if (prob === undefined || prob === null)
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
        N/A
      </span>
    );
  const isHigh = prob >= 0.7;
  const isMed = prob >= 0.4;
  const cls = isHigh
    ? "bg-red-50 text-red-600 border-red-200"
    : isMed
      ? "bg-amber-50 text-amber-600 border-amber-200"
      : "bg-success/10 text-success border-success/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {isHigh ? "HIGH" : isMed ? "MED" : "LOW"} {(prob * 100).toFixed(0)}%
    </span>
  );
};

// ── Role Badge ────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }: { role?: string }) => {
  const map: Record<string, string> = {
    admin: "bg-warning/10 text-warning border-warning/30",
    pathologist: "bg-primary/10 text-primary border-primary/30",
    researcher: "bg-success/10 text-success border-success/30",
  };
  const icons: Record<string, React.ReactNode> = {
    admin: <ShieldCheck className="w-2.5 h-2.5" />,
    pathologist: <Stethoscope className="w-2.5 h-2.5" />,
    researcher: <FlaskConical className="w-2.5 h-2.5" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${map[role || ""] || "bg-muted text-muted-foreground border-border"}`}>
      {icons[role || ""]}
      {role || "—"}
    </span>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, label, value, sub, gradient, trend,
}: {
  icon: any; label: string; value: string | number;
  sub?: string; gradient: string; trend?: string;
}) => (
  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-soft hover:shadow-medium transition-all duration-300">
    <div className="flex items-start justify-between">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-glow" style={{ background: gradient }}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-success">
          <ArrowUpRight className="w-3 h-3" />{trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Shared table header cell ──────────────────────────────────────────────────

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
    {children}
  </th>
);

// ── Shared filter pill ────────────────────────────────────────────────────────

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${active
      ? "bg-primary/10 border-primary/30 text-primary"
      : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground bg-muted/30"
      }`}
  >
    {children}
  </button>
);

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = "overview" | "patients" | "analyses" | "reports";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "patients", label: "Patients", icon: Users },
  { id: "analyses", label: "Analyses", icon: FlaskConical },
  { id: "reports", label: "Reports", icon: FileText }
];

// ── Main ──────────────────────────────────────────────────────────────────────

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [finalizedFilter, setFinalizedFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState<number | null>(null);
  const dispatch = useDispatch<AppDispatch>();

  const auth = useSelector((state: RootState) => state.auth);

  const load = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      if (tab === "overview") {
        setStats(await adminFetch("/admin/dashboard", auth.access_token));
      } else if (tab === "patients") {
        const qs = search ? `&search=${encodeURIComponent(search)}` : "";
        setPatients(await adminFetch(`/admin/patients?limit=100${qs}`, auth.access_token));
      } else if (tab === "analyses") {
        const qs = riskFilter ? `&risk_filter=${riskFilter}` : "";
        setAnalyses(await adminFetch(`/admin/analyses?limit=100${qs}` , auth.access_token));
      } else if (tab === "reports") {
        const qs = finalizedFilter !== "" ? `&finalized=${finalizedFilter}` : "";
        setReports(await adminFetch(`/admin/reports?limit=100${qs}` , auth.access_token));
      }
    } catch (err: any) {
      if (err.message.includes("401") || err.message.includes("403")) {
        toast.error("Admin access required.");
        navigate("/login");
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, riskFilter, finalizedFilter]);

  useEffect(() => { load(activeTab); }, [activeTab]);

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this patient and all associated data?")) return;
    setDeleting(id);
    try {
      await adminFetch(`/admin/patients/${id}`, { method: "DELETE" });
      toast.success("Patient deleted.");
      setPatients(prev => prev.filter(p => p.id !== id));
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(null); }
  };

  const handleFinalize = async (id: number) => {
    setFinalizing(id);
    try {
      await adminFetch(`/admin/reports/${id}/finalize`, { method: "PATCH" });
      toast.success("Report finalized.");
      setReports(prev => prev.map(r => r.id === id ? { ...r, is_finalized: true } : r));
    } catch (err: any) { toast.error(err.message); }
    finally { setFinalizing(null); }
  };

  const handleLogout = async () => {
    // 1. Stop persistence (VERY IMPORTANT)
    persistor.pause();

    // 2. Clear Redux state
    dispatch(clearProfile());
    dispatch(logout());

    // 3. Purge persisted storage
    await persistor.purge();

    // 4. Clear tokens
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // 5. Hard reload (guaranteed clean state)
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header — identical structure to Login/Index ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md shadow-soft sticky top-0 z-30">
        <div className="px-5 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow"
              style={{ background: "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
            >
              <Microscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 leading-none">
                <h1 className="text-base font-bold text-foreground">PathAI Pro</h1>
                <span className="text-[10px] font-bold uppercase tracking-widest text-warning border border-warning/30 bg-warning/10 px-1.5 py-0.5 rounded-full">
                  Admin
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Platform Control Center</p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setExpandedRow(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === t.id
                  ? "bg-primary/10 border border-primary/30 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                  }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(activeTab)}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-border"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Page body ── */}
      <main className="flex-1 px-6 py-8 max-w-screen-2xl mx-auto w-full">

        {/* ════ OVERVIEW ════ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-foreground">Control Center</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Platform-wide metrics and activity snapshot</p>
            </div>

            {stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Patients" value={stats.total_patients}
                    gradient="linear-gradient(135deg, hsl(187 85% 40%), hsl(200 80% 45%))" />
                  <StatCard icon={FlaskConical} label="Total Analyses" value={stats.total_analyses}
                    sub={`${stats.analyses_today} today`} trend={`${stats.analyses_this_week} this week`}
                    gradient="linear-gradient(135deg, hsl(160 70% 40%), hsl(145 65% 42%))" />
                  <StatCard icon={FileText} label="Total Reports" value={stats.total_reports}
                    sub={`${stats.pending_reports} pending`}
                    gradient="linear-gradient(135deg, hsl(40 90% 52%), hsl(30 88% 50%))" />
                  <StatCard icon={UserCheck} label="Registered Users" value={stats.total_users}
                    gradient="linear-gradient(135deg, hsl(270 70% 55%), hsl(250 65% 52%))" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard icon={AlertTriangle} label="High Risk Cases" value={stats.high_risk_cases}
                    sub="Lesion probability ≥ 70%"
                    gradient="linear-gradient(135deg, hsl(0 75% 55%), hsl(15 80% 50%))" />
                  <StatCard icon={Activity} label="Avg Lesion Probability" value={`${(stats.avg_lesion_probability * 100).toFixed(1)}%`}
                    gradient="linear-gradient(135deg, hsl(25 85% 52%), hsl(35 82% 50%))" />
                  <StatCard icon={CheckCircle2} label="Finalized Reports" value={stats.finalized_reports}
                    sub={`${stats.pending_reports} still pending`}
                    gradient="linear-gradient(135deg, hsl(160 70% 40%), hsl(145 65% 42%))" />
                </div>

                {/* Activity bars */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
                  <h3 className="text-xs font-bold text-foreground mb-5 uppercase tracking-widest">Platform Activity</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Analyses Today", val: stats.analyses_today, max: Math.max(stats.analyses_this_week, 1), color: "hsl(187 85% 40%)" },
                      { label: "Analyses This Week", val: stats.analyses_this_week, max: Math.max(stats.total_analyses, 1), color: "hsl(160 70% 40%)" },
                      { label: "High Risk Cases", val: stats.high_risk_cases, max: Math.max(stats.total_analyses, 1), color: "hsl(0 72% 51%)" },
                      { label: "Finalized Reports", val: stats.finalized_reports, max: Math.max(stats.total_reports, 1), color: "hsl(160 70% 40%)" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-44 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((row.val / row.max) * 100, 100)}%`, background: row.color }}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground w-8 text-right">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                {loading ? "Loading statistics…" : "No data available"}
              </div>
            )}
          </div>
        )}

        {/* ════ PATIENTS ════ */}
        {activeTab === "patients" && (
          <div className="space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">All Patients</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{patients.length} records</p>
              </div>
              <form onSubmit={e => { e.preventDefault(); load("patients"); }} className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or case ID…"
                    className="bg-muted/40 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 w-64 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] shadow-glow transition-all"
                  style={{ background: "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                >
                  Search
                </button>
              </form>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Case ID", "Name", "Age / Gender", "Analyses", "Reports", "Latest Risk", "Registered", ""].map(h => <Th key={h}>{h}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <>
                      <tr key={p.id}
                        className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{p.case_id}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.age}y / {p.gender}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-primary font-bold text-xs">
                            <FlaskConical className="w-3.5 h-3.5" />{p.analysis_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-warning font-bold text-xs">
                            <FileText className="w-3.5 h-3.5" />{p.report_count}
                          </span>
                        </td>
                        <td className="px-4 py-3"><RiskBadge prob={p.latest_lesion_probability} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-all"
                            >
                              {expandedRow === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === p.id && (
                        <tr key={`exp-${p.id}`} className="bg-muted/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-6 text-xs">
                              <div>
                                <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold mb-1">Contact Info</p>
                                <p className="text-foreground">{p.contact_info || "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold mb-1">Medical History</p>
                                <p className="text-foreground">{p.medical_history || "—"}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {patients.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">No patients found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ ANALYSES ════ */}
        {activeTab === "analyses" && (
          <div className="space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">All Analyses</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{analyses.length} records</p>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                {[
                  { val: "", label: "All" },
                  { val: "high", label: "High" },
                  { val: "medium", label: "Medium" },
                  { val: "low", label: "Low" },
                ].map(f => (
                  <FilterPill key={f.val} active={riskFilter === f.val}
                    onClick={() => { setRiskFilter(f.val); setTimeout(() => load("analyses"), 0); }}>
                    {f.label}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["ID", "Case ID", "Patient", "Lesion Prob", "Confidence", "Risk", "Date", ""].map(h => <Th key={h}>{h}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(a => (
                    <>
                      <tr key={a.id}
                        className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}
                      >
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">#{a.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{a.case_id}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{a.patient_name || `#${a.patient_id}`}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${a.lesion_probability * 100}%`,
                                background: a.lesion_probability >= 0.7 ? "hsl(0 72% 51%)" : a.lesion_probability >= 0.4 ? "hsl(40 90% 52%)" : "hsl(160 70% 40%)",
                              }} />
                            </div>
                            <span className="text-xs font-bold text-foreground">{(a.lesion_probability * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{(a.overall_confidence * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3"><RiskBadge prob={a.lesion_probability} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedRow(expandedRow === a.id ? null : a.id); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {expandedRow === a.id && (
                        <tr key={`aexp-${a.id}`} className="bg-muted/20">
                          <td colSpan={8} className="px-6 py-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Explanation</p>
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{a.ai_explanation || "No explanation generated."}</p>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {analyses.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">No analyses found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ REPORTS ════ */}
        {activeTab === "reports" && (
          <div className="space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">All Reports</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{reports.length} records</p>
              </div>
              <div className="flex items-center gap-2">
                {[{ val: "", label: "All" }, { val: "true", label: "Finalized" }, { val: "false", label: "Pending" }].map(f => (
                  <FilterPill key={f.val} active={finalizedFilter === f.val}
                    onClick={() => { setFinalizedFilter(f.val); setTimeout(() => load("reports"), 0); }}>
                    {f.label}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["ID", "Case ID", "Patient", "Analysis", "Status", "Generated", ""].map(h => <Th key={h}>{h}</Th>)}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">#{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{r.case_id}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{r.patient_name || `#${r.patient_id}`}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">Analysis #{r.analysis_id}</td>
                      <td className="px-4 py-3">
                        {r.is_finalized ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />FINALIZED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.generated_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {!r.is_finalized && (
                          <button
                            onClick={() => handleFinalize(r.id)} disabled={finalizing === r.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold text-success border border-success/30 hover:bg-success/10 transition-all disabled:opacity-50"
                          >
                            <CheckCheck className="w-3 h-3" />
                            {finalizing === r.id ? "…" : "Finalize"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && !loading && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No reports found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ USERS ════ */}
        {activeTab === "users" && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-foreground">Registered Users</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{users.length} accounts</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map(u => (
                <div key={u.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-soft hover:shadow-medium hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start justify-between">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-glow"
                      style={{ background: "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                    >
                      {(u.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{u.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email || "—"}</p>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[100px]">
                      {u.id.split("-")[0]}…
                    </span>
                  </div>
                </div>
              ))}
              {users.length === 0 && !loading && (
                <div className="col-span-3 py-16 text-center text-muted-foreground">No users found</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Loading pill (matches Index page status-pill style) ── */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 pointer-events-none">
          <div className="status-pill border bg-card border-primary/30 text-primary shadow-medium px-4 py-2.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs font-semibold">Loading…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;