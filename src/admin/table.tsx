import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MoreHorizontal, Search, SearchX, type LucideIcon } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, MenuItem, Popover, Skeleton, cn, inputCls } from '../ui'

export type Column<T> = {
  key: string; header: string; cell: (r: T) => ReactNode
  sort?: (a: T, b: T) => number; align?: 'right'; className?: string
  /** Hide this column below the given breakpoint (the mobile card layout always shows the essentials). */
  hideBelow?: 'lg' | 'xl'
}
export type RowAction<T> = { label: string; icon?: LucideIcon; onClick: (r: T) => void; danger?: boolean }

type Props<T> = {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string
  loading?: boolean; error?: string
  onRowClick?: (r: T) => void
  /** Layout used instead of the table on phones. */
  card: (r: T) => ReactNode
  actions?: (r: T) => RowAction<T>[]
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  filters?: ReactNode; toolbarRight?: ReactNode
  empty: { title: string; hint?: string; icon?: LucideIcon }
  noun?: string; pageSize?: number
  initialSort?: { key: string; dir: 'asc' | 'desc' }
}

const HIDE = { lg: 'max-lg:hidden', xl: 'max-xl:hidden' }

export function DataTable<T>({
  rows, columns, rowKey, loading, error, onRowClick, card, actions, search, filters, toolbarRight, empty, noun = 'results', pageSize = 10, initialSort,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key)
    if (!col?.sort || !sort) return rows
    const out = [...rows].sort(col.sort)
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, columns, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  useEffect(() => { setPage((p) => Math.min(p, pages - 1)) }, [pages])
  useEffect(() => { setPage(0) }, [search?.value])
  const from = page * pageSize
  const view = sorted.slice(from, from + pageSize)
  const toggle = (key: string) => { setPage(0); setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' })) }
  const searching = Boolean(search?.value.trim())

  return (
    <div>
      {(search || filters || toolbarRight) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="search" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} className={cn(inputCls, 'pl-9')} />
            </div>
          )}
          {filters}
          {toolbarRight && <div className="ml-auto flex items-center gap-2">{toolbarRight}</div>}
        </div>
      )}
      {error && !rows.length ? <ErrorState message={error} /> : (
        <Card>
          {/* desktop / tablet table */}
          <table className="w-full text-left text-sm max-md:hidden">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                {columns.map((c, i) => (
                  <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('whitespace-nowrap px-4 py-2.5 font-medium', i === 0 && 'rounded-tl-xl', !actions && i === columns.length - 1 && 'rounded-tr-xl', c.align === 'right' && 'text-right', c.hideBelow && HIDE[c.hideBelow])}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggle(c.key)} className={cn('-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-zinc-100 hover:text-zinc-900', sort?.key === c.key && 'text-zinc-900')}>
                        {c.header}{sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    ) : c.header}
                  </th>
                ))}
                {actions && <th scope="col" className="w-12 rounded-tr-xl px-2 py-2.5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0">
                  {columns.map((c) => <td key={c.key} className={cn('px-4 py-3.5', c.hideBelow && HIDE[c.hideBelow])}><Skeleton className="h-4 w-3/4" /></td>)}
                  {actions && <td />}
                </tr>
              ))}
              {!loading && view.map((r) => (
                <tr key={rowKey(r)} tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(r)} onKeyDown={(e) => { if (onRowClick && e.key === 'Enter') onRowClick(r) }}
                  className={cn('border-b border-zinc-100 last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-zinc-50 focus-visible:bg-zinc-50')}>
                  {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.align === 'right' && 'text-right', c.hideBelow && HIDE[c.hideBelow], c.className)}>{c.cell(r)}</td>)}
                  {actions && <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}><RowMenu items={actions(r)} row={r} /></td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* phone card list */}
          <ul className="divide-y divide-zinc-100 md:hidden">
            {loading && Array.from({ length: 4 }, (_, i) => <li key={i} className="space-y-2 p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></li>)}
            {!loading && view.map((r) => (
              <li key={rowKey(r)} className="relative">
                <button type="button" disabled={!onRowClick} onClick={() => onRowClick?.(r)} className="block w-full px-4 py-3.5 pr-14 text-left active:bg-zinc-50">{card(r)}</button>
                {actions && <div className="absolute right-1.5 top-2"><RowMenu items={actions(r)} row={r} /></div>}
              </li>
            ))}
          </ul>

          {!loading && sorted.length === 0 && (
            searching
              ? <EmptyState icon={SearchX} title="No matches" hint={`Nothing matches "${search?.value.trim()}". Try a different search or clear the filters.`} action={<Button size="sm" onClick={() => search?.onChange('')}>Clear search</Button>} />
              : <EmptyState icon={empty.icon} title={empty.title} hint={empty.hint} />
          )}

          {!loading && sorted.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500">
              <span className="tabular">{from + 1}–{Math.min(from + pageSize, sorted.length)} of {sorted.length} {noun}</span>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 max-sm:hidden">Page {page + 1} of {pages}</span>
                <Button size="sm" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><span className="max-sm:sr-only">Prev</span></Button>
                <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><span className="max-sm:sr-only">Next</span><ChevronRight size={15} /></Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function RowMenu<T>({ items, row }: { items: RowAction<T>[]; row: T }) {
  if (!items.length) return null
  return (
    <Popover label="Row actions" button={<MoreHorizontal size={18} />} buttonClass="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 max-md:size-11" panelClass="w-52 p-1" phone="bottom">
      {(close) => items.map((a) => <MenuItem key={a.label} icon={a.icon} danger={a.danger} onClick={() => { close(); a.onClick(row) }}>{a.label}</MenuItem>)}
    </Popover>
  )
}
