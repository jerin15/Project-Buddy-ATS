import { useEffect, useState } from "react";
import { Receipt, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Aed } from "@/components/Dirham";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

type Expense = {
  id: string;
  project_id: string;
  user_email: string | null;
  amount: number;
  invoice_number: string | null;
  vendor: string | null;
  description: string | null;
  expense_date: string;
  created_at: string;
};

export function Expenses({ projectId }: { projectId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("expenses" as never)
        .select("*")
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false })
        .limit(50);
      if (!mounted) return;
      if (error) toast.error(error.message);
      else setItems((data ?? []) as unknown as Expense[]);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`exp-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as Expense, ...prev].slice(0, 50);
            if (payload.eventType === "UPDATE")
              return prev.map((e) => (e.id === (payload.new as Expense).id ? (payload.new as Expense) : e));
            if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== (payload.old as Expense).id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [projectId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses" as never).insert({
      project_id: projectId,
      user_id: u.user?.id ?? null,
      user_email: u.user?.email ?? null,
      amount: amt,
      invoice_number: invoice.trim() || null,
      vendor: vendor.trim() || null,
      description: description.trim() || null,
      expense_date: date || today,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount(""); setInvoice(""); setVendor(""); setDescription(""); setDate(today);
    toast.success("Expense added");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("expenses" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <section className="glass p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Receipt className="h-4 w-4" /> Expenses
      </h2>

      <form onSubmit={add} className="grid sm:grid-cols-6 gap-2 items-end">
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Amount (AED) *</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Invoice #</Label>
          <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-1024" />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Vendor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-6 flex justify-end">
          <Button type="submit" disabled={busy} size="sm">
            <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add expense"}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No expenses recorded yet.</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-2 py-1.5">Date</th>
                <th className="text-left font-medium px-2 py-1.5">Invoice #</th>
                <th className="text-left font-medium px-2 py-1.5">Vendor / Description</th>
                <th className="text-right font-medium px-2 py-1.5">Amount</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {items.map((x) => (
                <tr key={x.id}>
                  <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(x.expense_date)}</td>
                  <td className="px-2 py-2 tabular-nums">{x.invoice_number ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2">
                    <div className="truncate max-w-[26ch]">{x.vendor ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[36ch]">{x.description ?? ""}</div>
                  </td>
                  <td className="px-2 py-2 text-right font-medium"><Aed value={Number(x.amount)} /></td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => remove(x.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
