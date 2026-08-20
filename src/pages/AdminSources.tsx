import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Database } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface SourceYieldRow {
  source: string | null;
  total_rows: number | null;
  active_rows: number | null;
  merged_rows: number | null;
  with_organizer_email: number | null;
  with_organizer_name: number | null;
  with_deadline: number | null;
  with_event_date: number | null;
  with_fee: number | null;
  with_vertical: number | null;
  with_topics: number | null;
  avg_score: number | null;
  max_score: number | null;
  opportunities_in_pipeline: number | null;
  accepted_or_completed: number | null;
  first_seen: string | null;
  last_seen: string | null;
}

interface DailyRow {
  source: string | null;
  day: string | null;
  rows_added: number | null;
  active_rows_added: number | null;
}

type Health = "productive" | "mixed" | "dead weight";

function healthOf(r: SourceYieldRow): Health {
  const active = r.active_rows ?? 0;
  if (active === 0) return "dead weight";
  const topicRate = (r.with_topics ?? 0) / active;
  const contactRate = (r.with_organizer_email ?? 0) / active;
  const score = r.avg_score ?? 0;
  const signals = [topicRate >= 0.5, contactRate > 0, score >= 40, (r.opportunities_in_pipeline ?? 0) > 0].filter(Boolean).length;
  if (signals >= 2) return "productive";
  if (signals === 1) return "mixed";
  return "dead weight";
}

const healthVariant: Record<Health, "default" | "secondary" | "destructive"> = {
  productive: "default",
  mixed: "secondary",
  "dead weight": "destructive",
};

const pct = (n: number | null, d: number | null) => {
  const den = d ?? 0;
  if (!den) return "0%";
  return `${Math.round(((n ?? 0) / den) * 100)}%`;
};

export default function AdminSources() {
  const navigate = useNavigate();
  const { isAdmin, loading: checking } = useAdminCheck(true);
  const [rows, setRows] = useState<SourceYieldRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [yieldRes, dailyRes] = await Promise.all([
      supabase.from("v_source_yield").select("*"),
      supabase.from("v_source_yield_daily").select("*").order("day", { ascending: true }),
    ]);
    if (yieldRes.error || dailyRes.error) {
      toast.error("Failed to load source yield data");
    } else {
      setRows(((yieldRes.data ?? []) as SourceYieldRow[]).sort((a, b) => (b.active_rows ?? 0) - (a.active_rows ?? 0)));
      setDaily((dailyRes.data ?? []) as DailyRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const totals = useMemo(() => {
    const active = rows.reduce((s, r) => s + (r.active_rows ?? 0), 0);
    return {
      sources: rows.length,
      active,
      withEmail: rows.reduce((s, r) => s + (r.with_organizer_email ?? 0), 0),
      withTopics: rows.reduce((s, r) => s + (r.with_topics ?? 0), 0),
      inPipeline: rows.reduce((s, r) => s + (r.opportunities_in_pipeline ?? 0), 0),
    };
  }, [rows]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    for (const d of daily) {
      if (!d.day || !d.source) continue;
      if (parseISO(d.day).getTime() < cutoff) continue;
      const key = d.day;
      const entry = byDay.get(key) ?? { day: format(parseISO(key), "MMM d") };
      entry[d.source] = (Number(entry[d.source]) || 0) + (d.rows_added ?? 0);
      byDay.set(key, entry);
    }
    return Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [daily]);

  const palette = ["--primary", "--accent", "--destructive", "--ring", "--muted-foreground"];
  const chartSources = useMemo(() => rows.slice(0, 5).map((r) => r.source ?? "unknown"), [rows]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Admin
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Source Yield</h1>
              <Badge variant="secondary">Admin Only</Badge>
            </div>
            <p className="text-muted-foreground mt-1">Which lead sources actually produce useful leads</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Sources", value: totals.sources },
            { label: "Active opportunities", value: totals.active },
            { label: "With organizer email", value: totals.withEmail },
            { label: "Touched in pipeline", value: totals.inPipeline },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Per-source breakdown</CardTitle>
            <CardDescription>Coverage rates are share of active rows for that source</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Merged</TableHead>
                  <TableHead className="text-right">Email</TableHead>
                  <TableHead className="text-right">Topics</TableHead>
                  <TableHead className="text-right">Deadline</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const h = healthOf(r);
                  return (
                    <TableRow key={r.source ?? "unknown"}>
                      <TableCell className="font-medium">{r.source ?? "unknown"}</TableCell>
                      <TableCell><Badge variant={healthVariant[h]}>{h}</Badge></TableCell>
                      <TableCell className="text-right">{(r.active_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{(r.total_rows ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.merged_rows ?? 0}</TableCell>
                      <TableCell className="text-right">{pct(r.with_organizer_email, r.active_rows)}</TableCell>
                      <TableCell className="text-right">{pct(r.with_topics, r.active_rows)}</TableCell>
                      <TableCell className="text-right">{pct(r.with_deadline, r.active_rows)}</TableCell>
                      <TableCell className="text-right">{pct(r.with_fee, r.active_rows)}</TableCell>
                      <TableCell className="text-right">{r.avg_score ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.opportunities_in_pipeline ?? 0}</TableCell>
                      <TableCell className="text-right">{r.accepted_or_completed ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.last_seen ? format(parseISO(r.last_seen), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume, last 30 days</CardTitle>
            <CardDescription>Rows added per day for the five largest sources</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">No rows added in the last 30 days</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  {chartSources.map((s, i) => (
                    <Line key={s} type="monotone" dataKey={s} stroke={`hsl(var(${palette[i % palette.length]}))`} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
