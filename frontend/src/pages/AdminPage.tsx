import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Microscope, Users, FlaskConical, FileText, ShieldCheck,
  AlertTriangle, TrendingUp, Clock, CheckCircle2, XCircle,
  Search, LogOut, RefreshCw, Trash2, CheckCheck,
  ChevronDown, ChevronUp, Activity, Eye, UserCheck,
  BarChart3, ArrowUpRight, Filter, X
} from "lucide-react";
import { toast } from "sonner";

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

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = "http://localhost:8000";

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("access_token") || "";
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

// ── Sub-components ────────────────────────────────────────────────────────────

const RiskBadge = ({ prob }: { prob?: number }) => {
  if (prob === undefined || prob === null)
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400">N/A</span>;
  const isHigh = prob >= 0.7;
  const isMed = prob >= 0.4;
  const cls = isHigh
    ? "bg-red-950 text-red-400 border-red-800"
    : isMed
    ? "bg-amber-950 text-amber-400 border-amber-800"
    : "bg-emerald-950 text-emerald-400 border-emerald-800";
  const label = isHigh ? "HIGH" : isMed ? "MED" : "LOW";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {label} {(prob * 100).toFixed(0)}%
    </span>
  );
};

const RoleBadge = ({ role }: { role?: string }) => {
  const map: Record<string, string> = {
    admin: "bg-violet-950 text-violet-300 border-violet-700",
    pathologist: "bg-cyan-950 text-cyan-300 border-cyan-700",
    researcher: "bg-emerald-950 text-emerald-300 border-emerald-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${map[role || ""] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
      {role || "—"}
    </span>
  );
};

const StatCard = ({
  icon: Icon, label, value, sub, accent, trend,
}: {
  icon: any; label: string; value: string | number; sub?: string; accent: string; trend?: string;
}) => (
  <div className={`relative overflow-hidden rounded-2xl border border-white/5 bg-[#0f1117] p-5 flex flex-col gap-3 group hover:border-white/10 transition-all duration-300`}>
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
      style={{ background: `radial-gradient(ellipse at top left, ${accent}18 0%, transparent 60%)` }} />
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center`}
        style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      {trend && (
        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
          <ArrowUpRight className="w-3 h-3" />{trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-3xl font-black text-white tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Main Admin Page ───────────────────────────────────────────────────────────

type Tab = "overview" | "patients" | "analyses" | "reports" | "users";

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
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [finalizedFilter, setFinalizedFilter] = useState<string>("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState<number | null>(null);

  const load = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      if (tab === "overview") {
        const data = await adminFetch("/admin/dashboard");
        setStats(data);
      } else if (tab === "patients") {
        const qs = search ? `&search=${encodeURIComponent(search)}` : "";
        const data = await adminFetch(`/admin/patients?limit=100${qs}`);
        setPatients(data);
      } else if (tab === "analyses") {
        const qs = riskFilter ? `&risk_filter=${riskFilter}` : "";
        const data = await adminFetch(`/admin/analyses?limit=100${qs}`);
        setAnalyses(data);
      } else if (tab === "reports") {
        const qs = finalizedFilter !== "" ? `&finalized=${finalizedFilter}` : "";
        const data = await adminFetch(`/admin/reports?limit=100${qs}`);
        setReports(data);
      } else if (tab === "users") {
        const data = await adminFetch("/admin/users");
        setUsers(data);
      }
    } catch (err: any) {
      if (err.message.includes("401") || err.message.includes("403")) {
        toast.error("Admin access required. Please log in as admin.");
        navigate("/login");
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, riskFilter, finalizedFilter]);

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(activeTab);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this patient and all associated data?")) return;
    setDeleting(id);
    try {
      await adminFetch(`/admin/patients/${id}`, { method: "DELETE" });
      toast.success("Patient deleted.");
      setPatients(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleFinalize = async (id: number) => {
    setFinalizing(id);
    try {
      await adminFetch(`/admin/reports/${id}/finalize`, { method: "PATCH" });
      toast.success("Report finalized.");
      setReports(prev => prev.map(r => r.id === id ? { ...r, is_finalized: true } : r));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFinalizing(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "patients", label: "Patients", icon: Users },
    { id: "analyses", label: "Analyses", icon: FlaskConical },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "users", label: "Users", icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-[#080a0f] text-white font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#080a0f]/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-base tracking-tight">PathAI Pro</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-violet-400 border border-violet-800 bg-violet-950 px-1.5 py-0.5 rounded-full">Admin</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === t.id
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => load(activeTab)} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-400 hover:bg-red-950/40 transition-all border border-transparent hover:border-red-900">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Control Center</h1>
              <p className="text-sm text-gray-500 mt-1">Platform-wide metrics and activity snapshot</p>
            </div>

            {stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Patients" value={stats.total_patients} accent="#06b6d4" />
                  <StatCard icon={FlaskConical} label="Total Analyses" value={stats.total_analyses}
                    sub={`${stats.analyses_today} today`} accent="#8b5cf6" trend={`${stats.analyses_this_week} this week`} />
                  <StatCard icon={FileText} label="Total Reports" value={stats.total_reports}
                    sub={`${stats.pending_reports} pending`} accent="#f59e0b" />
                  <StatCard icon={UserCheck} label="Registered Users" value={stats.total_users} accent="#10b981" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard icon={AlertTriangle} label="High Risk Cases" value={stats.high_risk_cases}
                    sub="Lesion prob ≥ 70%" accent="#ef4444" />
                  <StatCard icon={Activity} label="Avg Lesion Probability" value={`${(stats.avg_lesion_probability * 100).toFixed(1)}%`}
                    accent="#f97316" />
                  <StatCard icon={CheckCircle2} label="Finalized Reports" value={stats.finalized_reports}
                    sub={`${stats.pending_reports} still pending`} accent="#22c55e" />
                </div>

                {/* Risk distribution bar */}
                <div className="rounded-2xl border border-white/5 bg-[#0f1117] p-6">
                  <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-widest">Platform Activity</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Analyses Today", val: stats.analyses_today, max: Math.max(stats.analyses_this_week, 1), color: "#8b5cf6" },
                      { label: "Analyses This Week", val: stats.analyses_this_week, max: Math.max(stats.total_analyses, 1), color: "#06b6d4" },
                      { label: "High Risk Cases", val: stats.high_risk_cases, max: Math.max(stats.total_analyses, 1), color: "#ef4444" },
                      { label: "Finalized Reports", val: stats.finalized_reports, max: Math.max(stats.total_reports, 1), color: "#22c55e" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 w-40 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((row.val / row.max) * 100, 100)}%`, background: row.color }} />
                        </div>
                        <span className="text-xs font-bold text-white w-8 text-right">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-600">
                {loading ? "Loading statistics…" : "No data"}
              </div>
            )}
          </div>
        )}

        {/* ── Patients Tab ── */}
        {activeTab === "patients" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight">All Patients</h1>
                <p className="text-sm text-gray-500 mt-1">{patients.length} records</p>
              </div>
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or case ID…"
                    className="bg-[#0f1117] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-600 w-64" />
                </div>
                <button type="submit" className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-600 text-sm font-semibold transition-all">
                  Search
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0f1117] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Case ID", "Name", "Age / Gender", "Analyses", "Reports", "Latest Risk", "Registered", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <>
                      <tr key={p.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-400">{p.case_id}</td>
                        <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                        <td className="px-4 py-3 text-gray-400">{p.age}y / {p.gender}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-violet-300 font-bold">
                            <FlaskConical className="w-3.5 h-3.5" />{p.analysis_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-amber-300 font-bold">
                            <FileText className="w-3.5 h-3.5" />{p.report_count}
                          </span>
                        </td>
                        <td className="px-4 py-3"><RiskBadge prob={p.latest_lesion_probability} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                              {expandedRow === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/40 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === p.id && (
                        <tr key={`exp-${p.id}`} className="bg-[#0a0d14]">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-gray-600 uppercase tracking-widest mb-1">Contact</p>
                                <p className="text-gray-300">{p.contact_info || "—"}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 uppercase tracking-widest mb-1">Medical History</p>
                                <p className="text-gray-300">{p.medical_history || "—"}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {patients.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600">No patients found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Analyses Tab ── */}
        {activeTab === "analyses" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight">All Analyses</h1>
                <p className="text-sm text-gray-500 mt-1">{analyses.length} records</p>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                {["", "high", "medium", "low"].map(f => (
                  <button key={f} onClick={() => { setRiskFilter(f); setTimeout(() => load("analyses"), 0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${riskFilter === f
                      ? f === "high" ? "bg-red-950 text-red-300 border-red-800"
                        : f === "medium" ? "bg-amber-950 text-amber-300 border-amber-800"
                        : f === "low" ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : "bg-white/10 text-white border-white/20"
                      : "text-gray-500 border-white/5 hover:border-white/10 hover:text-gray-300"}`}>
                    {f || "All"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0f1117] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["ID", "Case ID", "Patient", "Lesion Prob", "Confidence", "Level", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(a => (
                    <>
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">#{a.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-400">{a.case_id}</td>
                        <td className="px-4 py-3 font-semibold text-white">{a.patient_name || `#${a.patient_id}`}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${a.lesion_probability * 100}%`,
                                  background: a.lesion_probability >= 0.7 ? "#ef4444" : a.lesion_probability >= 0.4 ? "#f59e0b" : "#22c55e"
                                }} />
                            </div>
                            <span className="text-xs font-bold text-white">{(a.lesion_probability * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{(a.overall_confidence * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3"><RiskBadge prob={a.lesion_probability} /></td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button onClick={e => { e.stopPropagation(); setExpandedRow(expandedRow === a.id ? null : a.id); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {expandedRow === a.id && (
                        <tr key={`aexp-${a.id}`} className="bg-[#0a0d14]">
                          <td colSpan={8} className="px-6 py-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">AI Explanation</p>
                            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{a.ai_explanation || "No explanation generated."}</p>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {analyses.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600">No analyses found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight">All Reports</h1>
                <p className="text-sm text-gray-500 mt-1">{reports.length} records</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { val: "", label: "All" },
                  { val: "true", label: "Finalized" },
                  { val: "false", label: "Pending" },
                ].map(f => (
                  <button key={f.val} onClick={() => { setFinalizedFilter(f.val); setTimeout(() => load("reports"), 0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${finalizedFilter === f.val
                      ? "bg-white/10 text-white border-white/20"
                      : "text-gray-500 border-white/5 hover:border-white/10 hover:text-gray-300"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0f1117] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["ID", "Case ID", "Patient", "Analysis", "Status", "Generated", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">#{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-cyan-400">{r.case_id}</td>
                      <td className="px-4 py-3 font-semibold text-white">{r.patient_name || `#${r.patient_id}`}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">Analysis #{r.analysis_id}</td>
                      <td className="px-4 py-3">
                        {r.is_finalized ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle2 className="w-3 h-3" />FINAL
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-full w-fit">
                            <Clock className="w-3 h-3" />PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{new Date(r.generated_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {!r.is_finalized && (
                          <button onClick={() => handleFinalize(r.id)} disabled={finalizing === r.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-400 border border-emerald-800 hover:bg-emerald-950/60 transition-all">
                            <CheckCheck className="w-3 h-3" />
                            {finalizing === r.id ? "…" : "Finalize"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && !loading && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-600">No reports found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Registered Users</h1>
              <p className="text-sm text-gray-500 mt-1">{users.length} accounts</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map(u => (
                <div key={u.id} className="rounded-2xl border border-white/5 bg-[#0f1117] p-5 flex flex-col gap-3 hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-white font-black text-sm">
                      {(u.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{u.full_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email || "—"}</p>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </span>
                    <span className="text-[10px] font-mono text-gray-700 truncate max-w-[100px]">{u.id.split("-")[0]}…</span>
                  </div>
                </div>
              ))}
              {users.length === 0 && !loading && (
                <div className="col-span-3 py-12 text-center text-gray-600">No users found</div>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3 bg-[#0f1117] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl">
              <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
              <span className="text-sm text-gray-400 font-medium">Loading…</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;