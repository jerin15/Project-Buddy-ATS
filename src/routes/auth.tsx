import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimaLogo } from "@/components/AnimaLogo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — ANIMA Tech Studio" },
      { name: "description", content: "Sign in to the ANIMA Tech Studio project tracker." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seedOk, setSeedOk] = useState(false);

  useEffect(() => {
    // Ensure the 3 team users exist. Idempotent, safe to call repeatedly.
    fetch("/api/public/bootstrap-users", { method: "POST" })
      .then(() => setSeedOk(true))
      .catch(() => setSeedOk(true));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass-strong p-8 rounded-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <AnimaLogo className="h-24 w-24 object-contain" />
            <h1 className="mt-3 text-xl font-semibold tracking-tight">ANIMA Tech Studio</h1>
            <p className="text-xs text-muted-foreground mt-1">Project Tracker · sign in to continue</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@animatech.solutions"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Default: ATS@2026"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {err}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy || !seedOk}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
            First login uses the default password <span className="font-mono font-medium text-foreground">ATS@2026</span>.
            <br />You can change it any time from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
