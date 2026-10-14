"use client";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Download, Lightbulb, Plus, ScanLine, Trash2, Wallet, PieChart as Pie } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORY_LABEL, cn, fmtDate, money, num } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import type { Balances, Dashboard, Expense } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { DailyChart, DonutChart } from "@/components/charts";
import { ExpenseModal } from "@/components/modals";
import { Avatar, Button, Card, CategoryChip, EmptyState, ErrorBox, Modal, PageTitle, Skeleton, StatCard, StatusBadge, downloadCsv, useToast } from "@/components/ui";

const PAGE = 5;
export default function Expenses() {
  const { tripId, trip, canEdit } = useTrip(); const { user } = useAuth(); const toast = useToast();
  const cur = trip.currency;
  const dash = useApi<Dashboard>(`/trips/${tripId}/dashboard`);
  const bal = useApi<Balances>(`/trips/${tripId}/balances`);
  const [cat, setCat] = useState<string>("All");
  const exp = useApi<Expense[]>(`/trips/${tripId}/expenses`);
  const [page, setPage] = useState(0); const [modal, setModal] = useState<null | "scan" | "manual">(null); const [del, setDel] = useState<Expense | null>(null);
  const refresh = () => { dash.reload(); bal.reload(); exp.reload(); };
  const rows = useMemo(() => (exp.data ?? []).filter((e) => cat === "All" || e.category === cat), [exp.data, cat]);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const k = dash.data?.kpis;

  async function settle(t: Balances["transactions"][number]) {
    try { await api(`/trips/${tripId}/settle`, { method: "POST", json: { from_user: t.from_user, to_user: t.to_user, amount: t.amount } }); toast(`${t.from_name} settled ${money(t.amount, cur)}`); refresh(); }
    catch (e) { toast((e as Error).message, "error"); }
  }
  const exportCsv = () => downloadCsv(`${trip.name}-expenses.csv`, [["Date", "Merchant", "Category", "Paid by", "Amount", "Currency", "Split between", "Status"],
    ...rows.filter((e) => !e.is_settlement).map((e) => [e.spent_on, e.merchant, e.category, e.payer.name, e.amount, e.currency, e.split_count, e.status])]);

  return (
    <>
      <PageTitle title="Trip expenses & split ledger" sub="Group ledger with automatic netting and AI receipt reading"
        right={canEdit && <div className="flex gap-2"><Button variant="secondary" onClick={() => setModal("manual")}><Plus size={16} />Add expense</Button><Button onClick={() => setModal("scan")}><ScanLine size={16} />Scan receipt</Button></div>} />
      {dash.error && <ErrorBox message={dash.error} retry={refresh} />}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {dash.loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />) : <>
          <StatCard label="Total trip spent" value={money(k?.total_spent, cur)} icon={<Wallet size={18} />} hint={`${k?.expense_count} transactions`}>{dash.data?.budget && <div className="mt-3 h-1.5 rounded-full bg-stone"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, k?.budget_used_percent ?? 0)}%` }} /></div>}</StatCard>
          <StatCard label="Per person" value={money(k?.per_person, cur)} icon={<Pie size={18} />} hint={`Your share ${money(k?.my_share, cur)} · ${k?.members} travelers`} />
          <StatCard label="You owe" value={money(k?.you_owe, cur)} tone={num(k?.you_owe) > 0 ? "danger" : "success"} badge={num(k?.you_owe) > 0 ? "Pending" : "Clear"} hint={num(k?.you_owe) > 0 ? "Settle up below" : "No pending balances"} />
          <StatCard label="You are owed" value={`${num(k?.owed_to_you) > 0 ? "+" : ""}${money(k?.owed_to_you, cur)}`} tone="accent" hint={num(k?.owed_to_you) > 0 ? "Waiting on others" : "Nothing outstanding"} />
        </>}
      </div>

      <Card className="mb-6 p-5">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-input bg-stone text-primary"><ArrowLeftRight size={18} /></span>
          <div><h2 className="text-label-lg text-base">Settle up</h2><p className="text-body-sm text-muted">{bal.data?.transactions.length ? `Simplified: ${bal.data.transactions.length} payment${bal.data.transactions.length > 1 ? "s" : ""} clear everyone` : "Everyone is settled"}</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {bal.data?.transactions.map((t) => (
            <div key={t.from_user + t.to_user} className="flex items-center gap-3 rounded-input border border-line bg-canvas p-3">
              <Avatar name={t.from_name} size={30} /><span className="flex-1 text-body-md"><b>{t.from_user === user?.id ? "You" : t.from_name}</b> {t.from_user === user?.id ? "owe" : "owes"} <b>{t.to_user === user?.id ? "you" : t.to_name}</b></span>
              <span className="tnum font-semibold">{money(t.amount, cur)}</span>
              {canEdit && <Button size="sm" className="bg-success text-white hover:opacity-90" onClick={() => settle(t)}>Settle up</Button>}
            </div>))}
        </div>
        {bal.data && bal.data.net.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">{bal.data.net.map((n) => <span key={n.user_id} className={cn("tnum rounded-pill px-3 py-1 text-label-md", num(n.amount) > 0 ? "bg-success/10 text-success" : num(n.amount) < 0 ? "bg-danger/10 text-danger" : "bg-stone text-muted")}>{n.name}: {num(n.amount) > 0 ? "+" : ""}{money(n.amount, cur)}</span>)}</div>}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5"><h2 className="mb-1 text-headline-sm">Daily spending</h2><p className="mb-3 text-body-sm text-muted">Spend per day</p>
          {dash.loading ? <Skeleton className="h-52" /> : dash.data?.daily.length ? <DailyChart data={dash.data.daily} currency={cur} /> : <EmptyState icon={<Wallet />} title="No spending yet" text="Add or scan an expense to see your spending trend." />}
          <div className="mt-4 rounded-card bg-canvas p-4"><h3 className="mb-2 flex items-center gap-2 text-label-lg"><Lightbulb size={16} className="text-warning" />Smart recommendations</h3>
            {dash.data?.recommendations.suggested_daily_budget != null && <p className="mb-2 text-body-md">Suggested budget for the remaining {dash.data.recommendations.days_left} days: <b className="tnum">{money(dash.data.recommendations.suggested_daily_budget, cur)}/day</b></p>}
            <ul className="list-disc space-y-1 pl-5 text-body-md text-muted">{dash.data?.recommendations.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
        </Card>
        <Card className="p-5"><div className="mb-4 flex justify-between"><h2 className="text-headline-sm">Category breakdown</h2><span className="tnum text-body-sm text-muted">Total {money(k?.total_spent, cur, 0)}</span></div>
          {dash.loading ? <Skeleton className="h-64" /> : dash.data?.categories.length ? <DonutChart data={dash.data.categories} currency={cur} total={k!.total_spent} /> : <p className="py-10 text-center text-body-md text-muted">No categories yet.</p>}
          {dash.data?.budget && <div className="mt-4 flex justify-between border-t border-line pt-3 text-body-sm"><span className="text-muted">Budget target: {money(dash.data.budget, cur, 0)}</span>
            <span className={cn("tnum font-semibold", num(dash.data.budget) - num(k?.total_spent) >= 0 ? "text-success" : "text-danger")}>{money(Math.abs(num(dash.data.budget) - num(k?.total_spent)), cur, 0)} {num(dash.data.budget) - num(k?.total_spent) >= 0 ? "under limit" : "over budget"}</span></div>}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><h2 className="text-headline-sm">Recent receipts & transactions</h2>
          <div className="flex flex-wrap gap-2">{["All", ...Object.keys(CATEGORY_LABEL)].map((c) => <button key={c} onClick={() => { setCat(c); setPage(0); }} className={cn("rounded-pill border px-3 py-1 text-label-md", cat === c ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>{c === "All" ? "All expenses" : CATEGORY_LABEL[c]}</button>)}
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}><Download size={14} />Export CSV</Button></div></div>
        {exp.loading ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : !rows.length ? <div className="p-6"><EmptyState icon={<Wallet />} title="No transactions" text="Scan a receipt or add an expense to start the ledger." action={canEdit && <Button onClick={() => setModal("scan")}>Scan receipt</Button>} /></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-body-md">
            <thead className="bg-canvas text-label-md text-muted"><tr><th className="p-4">Date</th><th>Merchant</th><th>Category</th><th>Paid by</th><th>Split</th><th className="text-right">Amount</th><th className="pl-6">Status</th><th /></tr></thead>
            <tbody>{shown.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="tnum p-4 whitespace-nowrap">{fmtDate(e.spent_on)}{e.has_receipt && <div className="text-body-sm text-muted">OCR scanned</div>}</td>
                <td><div className="font-semibold">{e.merchant}</div>{e.description && <div className="text-body-sm text-muted">{e.description}</div>}</td>
                <td>{e.is_settlement ? <CategoryChip category="Other" label="Settlement" /> : <CategoryChip category={e.category} label={CATEGORY_LABEL[e.category]} />}</td>
                <td className="whitespace-nowrap">{e.payer.name}</td><td className="tnum text-muted">{e.split_count} ways</td>
                <td className="tnum text-right font-semibold">{money(e.amount, e.currency)}<div className="text-body-sm font-normal text-muted">{money(e.per_person, e.currency)} ea</div></td>
                <td className="pl-6"><StatusBadge status={e.status} pending={e.pending_count} /></td>
                <td className="pr-4">{canEdit && <button aria-label="Delete expense" onClick={() => setDel(e)} className="text-muted hover:text-danger"><Trash2 size={15} /></button>}</td></tr>))}</tbody></table></div>)}
        {rows.length > 0 && <div className="flex items-center justify-between border-t border-line bg-canvas px-5 py-3 text-body-sm text-muted"><span>Showing {shown.length} of {rows.length}</span>
          <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
      </Card>

      <ExpenseModal open={modal !== null} onClose={() => setModal(null)} startWithScan={modal === "scan"} onSaved={refresh} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this expense?" subtitle="Balances will be recalculated." footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
        <Button variant="danger" onClick={async () => { try { await api(`/trips/${tripId}/expenses/${del!.id}`, { method: "DELETE" }); toast("Expense deleted"); setDel(null); refresh(); } catch (e) { toast((e as Error).message, "error"); } }}>Delete</Button></>}>
        <p className="text-body-md">{del?.merchant} · {money(del?.amount, del?.currency)}</p></Modal>
    </>
  );
}
