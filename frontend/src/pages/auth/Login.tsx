import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Microscope, Mail, Lock, Eye, EyeOff, Loader2, ChevronDown, ShieldCheck, FlaskConical, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { loginUser } from "@/services/authapi";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "@/app/store";
import type { RootState } from "@/app/store";
import { updateAuthState } from "@/features/auth/authSlice";
import { setProfile } from "@/features/user/profileSlice";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "admin" | "researcher" | "pathologist";

interface RoleOption {
    value: Role;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    accent: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_OPTIONS: RoleOption[] = [
    {
        value: "pathologist",
        label: "Pathologist",
        description: "Clinical analysis & diagnosis",
        icon: <Stethoscope className="h-4 w-4" />,
        color: "bg-primary/10 border-primary/30 text-primary",
        accent: "hsl(187 85% 40%)",
    },
    {
        value: "researcher",
        label: "Researcher",
        description: "Data exploration & insights",
        icon: <FlaskConical className="h-4 w-4" />,
        color: "bg-success/10 border-success/30 text-success",
        accent: "hsl(160 70% 40%)",
    },
    {
        value: "admin",
        label: "Administrator",
        description: "Platform management",
        icon: <ShieldCheck className="h-4 w-4" />,
        color: "bg-warning/10 border-warning/30 text-warning",
        accent: "hsl(45 90% 50%)",
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

interface RoleDropdownProps {
    selectedRole: Role | null;
    onChange: (role: Role) => void;
}

const RoleDropdown = ({ selectedRole, onChange }: RoleDropdownProps) => {
    const [open, setOpen] = useState(false);
    const selected = ROLE_OPTIONS.find((r) => r.value === selectedRole);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 ${selectedRole
                    ? "bg-card border-primary/40 text-foreground"
                    : "bg-muted/40 border-border text-muted-foreground"
                    } hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20`}
            >
                {selected ? (
                    <span className="flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-lg border ${selected.color}`}>
                            {selected.icon}
                        </span>
                        <span className="font-medium">{selected.label}</span>
                    </span>
                ) : (
                    <span>Select your role…</span>
                )}
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-card shadow-medium overflow-hidden animate-slide-up">
                    {ROLE_OPTIONS.map((role) => (
                        <button
                            key={role.value}
                            type="button"
                            onClick={() => {
                                onChange(role.value);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/60 ${selectedRole === role.value ? "bg-primary/5" : ""
                                }`}
                        >
                            <span className={`flex items-center justify-center w-8 h-8 rounded-lg border ${role.color}`}>
                                {role.icon}
                            </span>
                            <span className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground leading-tight">{role.label}</span>
                                <span className="text-[11px] text-muted-foreground">{role.description}</span>
                            </span>
                            {selectedRole === role.value && (
                                <span className="ml-auto text-primary text-xs font-bold">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

interface InputFieldProps {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    icon: React.ReactNode;
    rightElement?: React.ReactNode;
    error?: string;
}

const InputField = ({
    id, label, type, value, onChange, placeholder, icon, rightElement, error,
}: InputFieldProps) => (
    <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
        </label>
        <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-muted/40 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 ${error ? "border-destructive/50" : "border-border"
                    }`}
            />
            {rightElement && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</span>
            )}
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const LoginPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const dispatch = useDispatch<AppDispatch>();
    const { isAuthenticated, user } = useSelector(
        (state: RootState) => state.auth.isAuthenticated
    );

    const authState = useSelector((state: RootState) => state.auth);

    console.log("authStatusState:", authState);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!email) e.email = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
        if (!password) e.password = "Password is required";
        if (!selectedRole) e.role = "Please select your role";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        try {
            const data = await loginUser({
                email,
                password,
                role: selectedRole!,
            });

            dispatch(updateAuthState({
                user: data.user,
                access_token: data.access_token,
                refresh_token: data.refresh_token
            }));

            dispatch(setProfile(data.user));
            toast.success("Login successful");
            navigate(data.user.role === "admin" ? "/admin" : "/");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && user) {
            navigate(user.role === "admin" ? "/admin" : "/");
        }
    }, [isAuthenticated, user, navigate]);
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md shadow-soft sticky top-0 z-30">
                <div className="px-5 py-3 flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow"
                        style={{ background: "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                    >
                        <Microscope className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-foreground leading-none">PathAI Pro</h1>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Digital Pathology Analysis Platform</p>
                    </div>
                </div>
            </header>

            {/* Body */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm animate-slide-up">
                    {/* Card */}
                    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-medium overflow-hidden">
                        {/* Top accent bar */}
                        <div
                            className="h-1 w-full"
                            style={{ background: "linear-gradient(90deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                        />

                        <div className="px-7 py-8 flex flex-col gap-6">
                            {/* Heading */}
                            <div className="flex flex-col gap-1">
                                <h2 className="text-xl font-bold text-foreground">Sign in</h2>
                                <p className="text-xs text-muted-foreground">
                                    Access your PathAI Pro workspace
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                {/* Role selector */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Role
                                    </label>
                                    <RoleDropdown selectedRole={selectedRole} onChange={setSelectedRole} />
                                    {errors.role && (
                                        <p className="text-[11px] text-destructive">{errors.role}</p>
                                    )}
                                </div>

                                <InputField
                                    id="email"
                                    label="Email address"
                                    type="email"
                                    value={email}
                                    onChange={setEmail}
                                    placeholder="you@hospital.org"
                                    icon={<Mail className="h-4 w-4" />}
                                    error={errors.email}
                                />

                                <InputField
                                    id="password"
                                    label="Password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={setPassword}
                                    placeholder="••••••••"
                                    icon={<Lock className="h-4 w-4" />}
                                    error={errors.password}
                                    rightElement={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((s) => !s)}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    }
                                />


                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-glow"
                                    style={{ background: "linear-gradient(135deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        "Sign in"
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[11px] text-muted-foreground">New here?</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {/* Sign up link */}
                            <button
                                type="button"
                                onClick={() => navigate("/register")}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground bg-muted/40 hover:bg-muted/70 transition-all duration-200 active:scale-[0.98]"
                            >
                                Create an account
                            </button>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-center text-[10px] text-muted-foreground mt-5">
                        Protected by enterprise-grade encryption · HIPAA compliant
                    </p>
                </div>
            </main>
        </div>
    );
};

export default LoginPage;