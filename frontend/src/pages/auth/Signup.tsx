import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Microscope, Mail, Lock, Eye, EyeOff, Loader2,
    User, ShieldCheck, FlaskConical, Stethoscope, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { signupUser } from "@/services/authapi";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "admin" | "researcher" | "pathologist";

interface RoleCard {
    value: Role;
    label: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    ring: string;
    selectedBg: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_CARDS: RoleCard[] = [
    {
        value: "pathologist",
        label: "Pathologist",
        description: "Clinical diagnosis & WSI analysis",
        icon: <Stethoscope className="h-5 w-5" />,
        gradient: "linear-gradient(135deg, hsl(187 85% 40%), hsl(187 75% 55%))",
        ring: "ring-primary/50",
        selectedBg: "bg-primary/10 border-primary/40",
    },
    {
        value: "researcher",
        label: "Researcher",
        description: "Data exploration & model insights",
        icon: <FlaskConical className="h-5 w-5" />,
        gradient: "linear-gradient(135deg, hsl(160 70% 40%), hsl(160 60% 55%))",
        ring: "ring-success/50",
        selectedBg: "bg-success/10 border-success/40",
    },
    {
        value: "admin",
        label: "Administrator",
        description: "Platform & user management",
        icon: <ShieldCheck className="h-5 w-5" />,
        gradient: "linear-gradient(135deg, hsl(45 90% 50%), hsl(35 85% 55%))",
        ring: "ring-warning/50",
        selectedBg: "bg-warning/10 border-warning/40",
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

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
    hint?: string;
}

const InputField = ({
    id, label, type, value, onChange, placeholder, icon, rightElement, error, hint,
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
        {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
);

// ── Password Strength ─────────────────────────────────────────────────────────
const getPasswordStrength = (pw: string): { label: string; score: number; color: string } => {
    if (!pw) return { label: "", score: 0, color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", score, color: "bg-destructive" };
    if (score === 2) return { label: "Fair", score, color: "bg-warning" };
    if (score === 3) return { label: "Good", score, color: "bg-primary" };
    return { label: "Strong", score, color: "bg-success" };
};

// ── Role Selector ─────────────────────────────────────────────────────────────
interface RoleSelectorProps {
    selectedRole: Role | null;
    onChange: (r: Role) => void;
    error?: string;
}

const RoleSelector = ({ selectedRole, onChange, error }: RoleSelectorProps) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Role
        </label>
        <div className="grid grid-cols-3 gap-2">
            {ROLE_CARDS.map((role) => {
                const isSelected = selectedRole === role.value;
                return (
                    <button
                        key={role.value}
                        type="button"
                        onClick={() => onChange(role.value)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-200 ${isSelected
                                ? `${role.selectedBg} ring-2 ${role.ring}`
                                : "bg-muted/30 border-border hover:bg-muted/60 hover:border-border/80"
                            }`}
                    >
                        {/* Icon bubble */}
                        <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-soft"
                            style={{ background: isSelected ? role.gradient : "hsl(var(--muted))" }}
                        >
                            <span className={isSelected ? "text-white" : "text-muted-foreground"}>
                                {role.icon}
                            </span>
                        </span>
                        <span className={`text-[11px] font-bold leading-tight ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                            {role.label}
                        </span>
                        {/* Checkmark */}
                        {isSelected && (
                            <span className="absolute top-1.5 right-1.5 text-primary">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
        {/* Role description */}
        {selectedRole && (
            <p className="text-[11px] text-muted-foreground pl-0.5">
                {ROLE_CARDS.find((r) => r.value === selectedRole)?.description}
            </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const SignupPage = () => {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const strength = getPasswordStrength(password);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!name.trim()) e.name = "Full name is required";
        if (!email) e.email = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
        if (!password) e.password = "Password is required";
        else if (password.length < 8) e.password = "Minimum 8 characters";
        if (!confirmPassword) e.confirmPassword = "Please confirm your password";
        else if (password !== confirmPassword) e.confirmPassword = "Passwords don't match";
        if (!selectedRole) e.role = "Please select your role";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        try {
            const data = await signupUser({
                email,
                password,
                full_name: name,
                role: selectedRole!,
            });

            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);

            toast.success("Account created successfully");
            navigate("/");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

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
            <main className="flex-1 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-sm animate-slide-up">
                    {/* Card */}
                    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-medium overflow-hidden">
                        {/* Accent bar */}
                        <div
                            className="h-1 w-full"
                            style={{ background: "linear-gradient(90deg, hsl(187 85% 40%), hsl(160 70% 40%))" }}
                        />

                        <div className="px-7 py-8 flex flex-col gap-6">
                            {/* Heading */}
                            <div className="flex flex-col gap-1">
                                <h2 className="text-xl font-bold text-foreground">Create account</h2>
                                <p className="text-xs text-muted-foreground">
                                    Join PathAI Pro — built for clinical excellence
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                {/* Role selector */}
                                <RoleSelector
                                    selectedRole={selectedRole}
                                    onChange={setSelectedRole}
                                    error={errors.role}
                                />

                                {/* Name */}
                                <InputField
                                    id="name"
                                    label="Full name"
                                    type="text"
                                    value={name}
                                    onChange={setName}
                                    placeholder="Dr. Jane Smith"
                                    icon={<User className="h-4 w-4" />}
                                    error={errors.name}
                                />

                                {/* Email */}
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

                                {/* Password */}
                                <div className="flex flex-col gap-1.5">
                                    <InputField
                                        id="password"
                                        label="Password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={setPassword}
                                        placeholder="Min. 8 characters"
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
                                    {/* Strength bar */}
                                    {password && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex-1 flex gap-1">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-border"
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-medium w-10 text-right">
                                                {strength.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <InputField
                                    id="confirmPassword"
                                    label="Confirm password"
                                    type={showConfirm ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    placeholder="Re-enter password"
                                    icon={<Lock className="h-4 w-4" />}
                                    error={errors.confirmPassword}
                                    rightElement={
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm((s) => !s)}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                                            Creating account…
                                        </>
                                    ) : (
                                        "Create account"
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[11px] text-muted-foreground">Have an account?</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {/* Sign in link */}
                            <button
                                type="button"
                                onClick={() => navigate("/login")}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground bg-muted/40 hover:bg-muted/70 transition-all duration-200 active:scale-[0.98]"
                            >
                                Sign in instead
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

export default SignupPage;