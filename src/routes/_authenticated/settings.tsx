import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, KeyRound, Mail, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPrefs } from "@/hooks/useUserPrefs";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ANIMA Tech Studio" }] }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { prefs, save } = useUserPrefs();
  const [prefBusy, setPrefBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const savePrefs = async (patch: Parameters<typeof save>[0]) => {
    setPrefBusy(true);
    const { error } = await save(patch);
    setPrefBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setNewPassword("");
    setConfirm("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-5 py-3 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <button onClick={signOut} className="glass inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account.</p>
        </div>

        <section className="glass p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" /> Account
          </h2>
          <div className="mt-3 text-sm">
            Signed in as <span className="font-medium">{email || "—"}</span>
          </div>
        </section>

        <section className="glass p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change password
          </h2>
          <form onSubmit={changePassword} className="mt-4 space-y-3 max-w-sm">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" autoComplete="new-password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
          </form>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Default password is <span className="font-mono">ATS@2026</span>. Change it any time.
          </p>
        </section>
      </main>
    </div>
  );
}
