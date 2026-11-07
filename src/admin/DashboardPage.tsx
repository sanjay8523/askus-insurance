import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, BadgeCheck, ClipboardList, Clock3, FileCheck2, History, Inbox, Minus, Users, type LucideIcon } from 'lucide-react'
import { BarList, DailyBars, Donut, Sparkline } from './charts'
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge, cn } from '../ui'
import {
  ago, dateOf, nameOf, perDay, refOf, secs, statusOf, titleOf, trendOf, type Data, type Rec, type Trend,
} from './data'

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

function TrendPill({ t, windowDays }: { t: Trend; windowDays: number }) {
  if (t.pct === null) return <span className="text-xs text-zinc-400">{t.current} in last {windowDays}d</span>
  const up = t.pct > 0, flat = t.pct === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular', flat ? 'bg-zinc-100 text-zinc-600' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
        <Icon size={12} />{Math.abs(t.pct)}%</span>
      <span className="text-zinc-400">vs prev {windowDays}d</span>
    </span>
  )
}

function Kpi({ icon: Icon, label, value, footer, spark, loading, onClick }: {
  icon: LucideIcon; label: string; value: ReactNode; footer: ReactNode; spark?: number[]; loading: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="group rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:border-zinc-300">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-zinc-500"><Icon size={15} className="text-zinc-400 group-hover:text-indigo-600" />{label}</span>
        {spark && !loading && <Sparkline data={spark} className="text-indigo-600" />}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular">{value}</p>}
      <div className="mt-3 min-h-5">{loading ? <Skeleton className="h-4 w-24" /> : footer}</div>
    </button>
  )
}

export default function DashboardPage({ d, email, go, onOpen }: { d: Data; email: string; go: (p: string) => void; onOpen: (r: Rec) => void }) {
  const [range, setRange] = useState<7 | 14 | 30>(14)
  const all = useMemo(() => [...d.offline, ...d.uploads].sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [d.offline, d.uploads])
  const stamps = (list: Rec[]) => list.map((r) => dateOf(r.createdAt))
  const reqTrend = trendOf(stamps(all), 7)
  const custTrend = trendOf(d.customers.map((c) => dateOf(c.createdAt)), 7)
  const count = (list: Rec[], ...s: string[]) => list.filter((r) => s.includes(statusOf(r))).length
  const pending = count(all, 'new')
  const progress = count(d.offline, 'contacted', 'quoted')
  const issued = count(d.offline, 'issued')
  const closed = count(d.offline, 'closed')
  const doneRate = d.offline.length ? Math.round(((issued + closed) / d.offline.length) * 100) : null
  const spark = perDay([{ stamps: stamps(all) }], 14).map((x) => x.counts[0])
  const days = useMemo(() => perDay([{ stamps: stamps(d.offline) }, { stamps: stamps(d.uploads) }], range), [d.offline, d.uploads, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const rangeTotal = days.reduce((a, x) => a + x.counts[0] + x.counts[1], 0)

  const slices = [
    { label: 'new', color: '#3b82f6' }, { label: 'contacted', color: '#f59e0b' }, { label: 'quoted', color: '#8b5cf6' }, { label: 'issued', color: '#10b981' }, { label: 'closed', color: '#a1a1aa' },
  ].map((s) => ({ ...s, value: count(all, s.label) }))

  // requests the customer was promised a call for within 24 hours
  const overdue = all.filter((r) => statusOf(r) === 'new' && Date.now() - (dateOf(r.createdAt)?.getTime() ?? Date.now()) > 86400000)
  const waiting = all.filter((r) => statusOf(r) === 'new').sort((a, b) => secs(a.createdAt) - secs(b.createdAt))
  const insurers = useMemo(() => {
    const m = new Map<string, number>()
    d.offline.forEach((r) => r.plan?.insurers?.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1)))
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))
  }, [d.offline])
  const car = d.offline.filter((r) => r.vehicleType === 'car').length
  const bike = d.offline.filter((r) => r.vehicleType === 'bike').length

  const activity = useMemo(() => {
    const items = [
      ...d.audit.slice(0, 8).map((a) => ({ key: 'a' + a.id, at: secs(a.at), text: <><b className="font-medium text-zinc-900">{a.by.split('@')[0]}</b> moved <span className="font-mono text-xs">{a.target.split('/').pop()}</span> from {a.from} to {a.to}</>, when: ago(a.at), icon: History })),
      ...all.slice(0, 8).map((r) => ({ key: 'r' + r.kind + r.id, at: secs(r.createdAt), text: <><b className="font-medium text-zinc-900">{nameOf(r)}</b> submitted {titleOf(r).toLowerCase()}</>, when: ago(r.createdAt), icon: Inbox })),
    ]
    return items.sort((a, b) => b.at - a.at).slice(0, 7)
  }, [d.audit, all])

  const L = d.loading
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">{greeting()}</h1>
          <p className="mt-1 truncate text-sm text-zinc-500">{email} · Administrator</p>
        </div>
        <Button variant="primary" icon={ClipboardList} onClick={() => go('/admin/requests?status=new')}>Review new requests{pending > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs tabular">{pending}</span>}</Button>
      </div>

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={ClipboardList} label="Applications" value={all.length} loading={L} spark={spark} onClick={() => go('/admin/requests')} footer={<TrendPill t={reqTrend} windowDays={7} />} />
        <Kpi icon={Clock3} label="Pending" value={pending} loading={L} onClick={() => go('/admin/requests?status=new')}
          footer={<span className={cn('text-xs', overdue.length ? 'font-medium text-rose-600' : 'text-zinc-400')}>{overdue.length ? `${overdue.length} waiting over 24h` : 'Nothing overdue'}</span>} />
        <Kpi icon={History} label="In progress" value={progress} loading={L} onClick={() => go('/admin/requests?status=contacted')} footer={<span className="text-xs text-zinc-400">Contacted or quoted</span>} />
        <Kpi icon={BadgeCheck} label="Completed" value={issued + closed} loading={L} onClick={() => go('/admin/requests?status=issued')} footer={<span className="text-xs text-zinc-400">{doneRate === null ? 'No requests yet' : `${doneRate}% of offline requests`}</span>} />
        <Kpi icon={Users} label="Customers" value={d.customers.length} loading={L} onClick={() => go('/admin/customers')} footer={<TrendPill t={custTrend} windowDays={7} />} />
        <Kpi icon={FileCheck2} label="Documents" value={all.reduce((n, r) => n + ((r.kind === 'offline' ? r.documents : r.files)?.length ?? 0), 0)} loading={L} onClick={() => go('/admin/documents')} footer={<span className="text-xs text-zinc-400">{d.uploads.length} standalone uploads</span>} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Requests received" hint={`${rangeTotal} in the last ${range} days`}
            action={
              <div role="group" aria-label="Chart range" className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                {([7, 14, 30] as const).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={cn('rounded-md px-2.5 py-1 transition-colors max-md:py-2', range === r ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}>{r}d</button>)}
              </div>} />
          <div className="px-5 pb-4 pt-3">{L ? <Skeleton className="h-52 w-full" /> : <DailyBars days={days} names={['Offline insurance', 'Document uploads']} />}</div>
        </Card>
        <Card>
          <CardHeader title="Pipeline" hint="All requests by status" />
          <div className="px-5 pb-5 pt-4">{L ? <Skeleton className="h-36 w-full" /> : <Donut slices={slices} centerLabel="requests" />}</div>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Needs attention" hint="Oldest requests still waiting for a first response"
            action={waiting.length > 0 ? <Button size="sm" variant="ghost" onClick={() => go('/admin/requests?status=new')}>View all</Button> : undefined} />
          <ul className="mt-2 divide-y divide-zinc-100 pb-1">
            {L && Array.from({ length: 3 }, (_, i) => <li key={i} className="px-5 py-3"><Skeleton className="h-4 w-2/3" /></li>)}
            {!L && waiting.slice(0, 5).map((r) => {
              const late = Date.now() - (dateOf(r.createdAt)?.getTime() ?? Date.now()) > 86400000
              return (
                <li key={r.kind + r.id}>
                  <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{nameOf(r)}</span>
                      <span className="block truncate text-xs text-zinc-500">{titleOf(r)} · {r.vehicle?.regNumber ? `${r.vehicle.regNumber} · ` : ''}{refOf(r)}</span></span>
                    {late ? <Badge tone="red">Over 24h</Badge> : <StatusBadge status="new" />}
                    <span className="w-16 shrink-0 text-right text-xs text-zinc-400 max-sm:hidden">{ago(r.createdAt)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {!L && waiting.length === 0 && <EmptyState icon={BadgeCheck} title="You're all caught up" hint="Every request has had a first response." />}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="space-y-1 p-3">
            {([
              ['Review new requests', ClipboardList, '/admin/requests?status=new'], ['Open document review', FileCheck2, '/admin/documents'],
              ['Browse customers', Users, '/admin/customers'], ['See audit log', History, '/admin/audit-logs'],
            ] as const).map(([label, Icon, to]) => (
              <button key={label} type="button" onClick={() => go(to)} className="flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 max-md:h-12">
                <Icon size={16} className="text-zinc-400" />{label}<ArrowUpRight size={14} className="ml-auto text-zinc-300" /></button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" hint="New submissions and admin changes" />
          <ul className="px-5 pb-4 pt-3">
            {L && Array.from({ length: 4 }, (_, i) => <li key={i} className="py-2"><Skeleton className="h-4 w-3/4" /></li>)}
            {!L && activity.map((a, i) => (
              <li key={a.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < activity.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-zinc-100" />}
                <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500"><a.icon size={13} /></span>
                <p className="min-w-0 flex-1 pt-1 text-sm text-zinc-600">{a.text}</p><span className="shrink-0 pt-1 text-xs text-zinc-400">{a.when}</span>
              </li>
            ))}
            {!L && activity.length === 0 && <li><EmptyState title="No activity yet" hint="Submissions and status changes will show up here." /></li>}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Most requested insurers" />
            <div className="px-5 pb-5 pt-4">{L ? <Skeleton className="h-24 w-full" /> : <BarList items={insurers} empty="No insurer preferences yet." />}</div>
          </Card>
          <Card>
            <CardHeader title="Vehicle mix" hint="Offline requests" />
            <div className="px-5 pb-5 pt-4">{L ? <Skeleton className="h-10 w-full" /> : <BarList items={[{ label: 'Car', value: car }, { label: 'Bike', value: bike }]} empty="No offline requests yet." />}</div>
          </Card>
        </div>
      </div>
      <p className="text-center text-xs text-zinc-400">Live data: the latest 300 requests, 500 customers and 200 audit entries.</p>
    </div>
  )
}
