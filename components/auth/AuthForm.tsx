"use client";

import { ArrowRight, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AuthFormProps {
  mode: "login" | "register";
  nextPath?: string;
}

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const destination = nextPath && nextPath.startsWith("/") ? nextPath : "/";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await apiFetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(
          isRegister ? { email, password, displayName } : { email, password },
        ),
      });

      router.replace(destination);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {isRegister ? (
        <Field
          icon={<User className="h-4 w-4" strokeWidth={2} />}
          label="Name"
          type="text"
          value={displayName}
          onChange={setDisplayName}
          placeholder="What should we call you?"
          autoComplete="name"
          maxLength={40}
          required
        />
      ) : null}

      <Field
        icon={<Mail className="h-4 w-4" strokeWidth={2} />}
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
        required
      />

      <Field
        icon={<Lock className="h-4 w-4" strokeWidth={2} />}
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder={isRegister ? "At least 8 characters" : "Your password"}
        autoComplete={isRegister ? "new-password" : "current-password"}
        minLength={isRegister ? 8 : undefined}
        required
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-[#7f2d20]/15 bg-[#7f2d20]/[0.06] px-3.5 py-2.5 text-[12.5px] font-medium text-[#7f2d20]"
        >
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={busy} className="!mt-4">
        {busy ? "One moment…" : isRegister ? "Create my vault" : "Sign in"}
        {!busy ? <ArrowRight className="h-4 w-4" strokeWidth={2.4} /> : null}
      </Button>

      <p className="pt-1 text-center text-[12.5px] text-ink-muted">
        {isRegister ? "Already lifting with IronBeat?" : "New here?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-semibold text-amber-deep underline decoration-amber/40 underline-offset-2"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  minLength,
  maxLength,
  required,
}: {
  icon: ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "email" | "text";
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label-xs mb-1.5 block">{label}</span>
      <span
        className={cn(
          "flex h-[52px] items-center gap-2.5 rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5",
          "transition-colors focus-within:border-amber/60 focus-within:bg-white",
        )}
      >
        <span className="text-ink-muted">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/60"
        />
      </span>
    </label>
  );
}
