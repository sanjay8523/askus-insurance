/**
 * Finds the value for each label in a document by where the text sits on the page, not just by reading order.
 * Real RCs and policies put a value in one of three places:
 *
 *   Owner Name: SURESH KUMAR             in the same box as its label
 *   Owner Name        SURESH KUMAR       to the right of its label (tables, two-column PDFs)
 *   Regn. Number      Date of Regn.      under its label (smart-card RCs, mParivahan screens)
 *   KA19MH4521        14-06-2019
 *
 * Cells come from the OCR boxes (photos, scans) or the PDF text layer, in page units with the origin at the top left.
 * Pure functions, no browser APIs.
 */

export type Cell = { text: string; x: number; y: number; w: number; h: number }

/** A label: `re` must start with ^ and match only the label words. `strict` labels need ":" or nothing after them
 *  (so "Model: SWIFT" is a label but the address line "MODEL TOWN" is not). */
export type LabelDef<F extends string> = { field: F; re: RegExp; strict?: boolean }

type Tagged<F extends string> = Cell & { field?: F; label?: string; rest?: Cell }

const mid = (c: Cell) => c.y + c.h / 2
const right = (c: Cell) => c.x + c.w
const bottom = (c: Cell) => c.y + c.h
const PIN = /\b[1-9]\d{5}\b/

/**
 * Same line: middles closer than 0.4 of the smaller box. OCR boxes are often drawn up to twice as tall as the text,
 * so a looser rule would merge an address's two lines into one.
 */
const ROW = 0.4
const sameRow = (a: Cell, b: Cell) => Math.abs(mid(a) - mid(b)) < Math.min(a.h, b.h) * ROW
/** `o` sits on a line below `c` (not on the same line), within `lines` box heights. */
const isUnder = (o: Cell, c: Cell, lines: number) => mid(o) - mid(c) >= Math.min(o.h, c.h) * ROW && mid(o) - mid(c) < c.h * lines
/** Horizontal overlap of two boxes. */
const overlap = (a: Cell, b: Cell) => Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x))

/** Groups cells into rows (top to bottom), each row left to right. */
export function rowsOf<C extends Cell>(cells: C[]): C[][] {
  const rows: { y: number; h: number; cells: C[] }[] = []
  for (const c of [...cells].sort((a, b) => mid(a) - mid(b))) {
    const row = rows.find((r) => Math.abs(r.y - mid(c)) < Math.min(r.h, c.h) * ROW)
    if (row) { row.cells.push(c); row.y += (mid(c) - row.y) / row.cells.length } else rows.push({ y: mid(c), h: c.h, cells: [c] })
  }
  return rows.sort((a, b) => a.y - b.y).map((r) => r.cells.sort((a, b) => a.x - b.x))
}

/** Plain text, one line per row (for the parts of a document that are read as running text). */
export const textOf = (cells: Cell[]) => rowsOf(cells).map((r) => r.map((c) => c.text).join(' ')).join('\n')

/** Cleans OCR / PDF text: straight apostrophes, no Hindi or other non-Latin script (labels are often printed in both). */
export const tidy = (s: string) => s.replace(/[’‘`´]/g, "'").replace(/[^\x20-\x7E₹]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s/|:;,–-]+/, '').trim()

/** Joins pieces of one phrase ("Regn." + "Number") that are only a space apart. Columns stay separate. */
export function mergeClose(cells: Cell[]): Cell[] {
  const out: Cell[] = []
  for (const row of rowsOf(cells)) {
    let cur: Cell | undefined
    for (const c of row) {
      if (cur && c.x - right(cur) < Math.min(cur.h, c.h) * 0.6) {
        const x = Math.min(cur.x, c.x), y = Math.min(cur.y, c.y)
        cur = { text: `${cur.text} ${c.text}`, x, y, w: Math.max(right(cur), right(c)) - x, h: Math.max(bottom(cur), bottom(c)) - y }
      } else {
        if (cur) out.push(cur)
        cur = { ...c }
      }
    }
    if (cur) out.push(cur)
  }
  return out
}

/** Part of a cell's text, with its position estimated from the character offsets. */
function part(c: Cell, from: number, to = c.text.length): Cell | undefined {
  const text = c.text.slice(from, to)
  const lead = text.length - text.trimStart().length
  const t = text.trim()
  if (!t) return undefined
  const per = c.w / Math.max(1, c.text.length)
  return { ...c, text: t, x: c.x + per * (from + lead), w: per * t.length }
}

/**
 * The label a text starts with. `inside` is for a label found in the middle of a box: then it must be at least two
 * words or end with ":" (one common word could be part of a value), unless it follows a "/" (`afterSlash`), which is how
 * bilingual labels are printed: "पंजीयन तिथि / Date of Regn.".
 */
function labelAt<F extends string>(text: string, defs: LabelDef<F>[], inside = false, afterSlash = false): { field: F; end: number } | undefined {
  for (const d of defs) {
    if (inside && d.strict) continue
    const m = text.match(d.re)
    if (!m || m.index !== 0 || !m[0].trim()) continue
    const after = text.slice(m[0].length)
    if (/^[A-Za-z0-9]/.test(after)) continue // stopped in the middle of a word
    if (d.strict && !/^\s*(?:[:|–-]|$)/.test(after)) continue
    if (inside && !afterSlash && m[0].trim().split(/\s+/).length < 2 && !/^\s*:/.test(after)) continue
    return { field: d.field, end: m[0].length }
  }
  return undefined
}

/**
 * OCR reads the Hindi half of a bilingual label as a few stray letters: "j af4/Date of Regn.", "qui afaf7 Date of Regn.".
 * A short piece like that right before a label in the same box belongs to the label.
 */
const strayBeforeLabel = (t: string) => /^[^0-9]{0,12}\/\s*$/.test(t) || (t.length <= 16 && !/\d{3}/.test(t))

/** Splits boxes that hold more than one label ("Regn. Number Date of Regn.") into one box per label. */
function splitLabels<F extends string>(cells: Cell[], defs: LabelDef<F>[]): Cell[] {
  const out: Cell[] = []
  for (const c of cells) {
    let cur: Cell | undefined = c
    while (cur) {
      let at = -1
      const lead = labelAt(cur.text, defs)?.end ?? 0 // never split inside the label the box starts with ("Son/Wife/Daughter of")
      for (const m of cur.text.matchAll(/(\/\s*|\s+)(?=\S)/g)) {
        const p = m.index! + m[0].length
        if (p <= lead) continue
        if (labelAt(cur.text.slice(p), defs, true, m[1].startsWith('/'))) { at = p; break }
      }
      if (at < 0) { out.push(cur); break }
      const head = part(cur, 0, at)
      const tail = part(cur, at)
      if (head && !labelAt(head.text, defs) && strayBeforeLabel(head.text)) {
        // the stray letters are the label's Hindi half: the label still starts where they start (values line up with it)
        cur = tail && { ...tail, x: head.x, w: right(tail) - head.x }
      } else {
        if (head) out.push(head)
        cur = tail
      }
    }
  }
  return out
}

/** Keeps only the words of `c` that sit between x0 and x1 (a value row read as one box across several columns). */
function slice(c: Cell, x0: number, x1: number): Cell | undefined {
  if (c.x >= x0 && right(c) <= x1) return c
  const per = c.w / Math.max(1, c.text.length)
  const words = [...c.text.matchAll(/\S+/g)].filter((m) => {
    const cx = c.x + per * (m.index! + m[0].length / 2)
    return cx >= x0 && cx < x1
  })
  if (!words.length) return undefined
  const last = words[words.length - 1]
  return part(c, words[0].index!, last.index! + last[0].length)
}

export type Layout<F extends string> = {
  /** All the text, one line per row. */
  text: string
  /** Possible values for a field, best first: in the label's own box, to its right, then under it.
   *  With `lines` > 1 a value continues onto the lines below it (addresses). */
  values: (field: F, lines?: number) => string[]
  /** The label words found for a field (e.g. "S/O" or "S/W/D of"). */
  labels: (field: F) => string[]
}

export function readLayout<F extends string>(raw: Cell[], defs: LabelDef<F>[]): Layout<F> {
  const clean = raw.map((c) => ({ ...c, text: tidy(c.text) })).filter((c) => c.text && c.w > 0 && c.h > 0)
  const cells: Tagged<F>[] = splitLabels(mergeClose(clean), defs).map((c) => {
    const hit = labelAt(c.text, defs)
    if (!hit) return c
    const restStart = hit.end + (c.text.slice(hit.end).match(/^[\s:.|–-]*/)?.[0].length ?? 0)
    return { ...c, field: hit.field, label: c.text.slice(0, hit.end).trim(), rest: part(c, restStart) }
  })
  const isLabel = (c: Tagged<F>) => c.field !== undefined

  const rightOf = (L: Tagged<F>) => {
    const r = cells.filter((o) => o !== L && sameRow(o, L) && o.x >= right(L) - L.h * 0.5).sort((a, b) => a.x - b.x)[0]
    return r && !isLabel(r) ? r : undefined
  }

  /** The value under a label, within the label's column (up to the next label on the label's row). */
  const below = (L: Tagged<F>) => {
    // the label's column runs from the label before it to the label after it on the same row
    const mates = cells.filter((o) => o !== L && isLabel(o) && sameRow(o, L))
    const next = mates.filter((o) => o.x > right(L) - L.h * 0.5).sort((a, b) => a.x - b.x)[0]
    const prev = mates.filter((o) => right(o) < L.x + L.h * 0.5).sort((a, b) => right(b) - right(a))[0]
    const x0 = prev ? right(prev) + L.h * 0.3 : -Infinity, x1 = next ? next.x - L.h * 0.3 : Infinity
    // a value under the label overlaps the label's own width
    const candidates = cells.filter((o) => o !== L && isUnder(o, L, 3.5) && o.x < right(L) + L.h && right(o) > L.x - L.h)
    if (!candidates.length) return undefined
    const top = candidates.reduce((a, b) => (mid(a) <= mid(b) ? a : b))
    const first = candidates.filter((o) => sameRow(o, top)).sort((a, b) => overlap(b, L) - overlap(a, L))[0]
    return first && !isLabel(first) ? slice(first, x0, x1) : undefined
  }

  /** A value plus the lines that continue it underneath (same column, close together, not a label). */
  const continued = (start: Cell, max: number) => {
    const out = [start.text]
    let last = start
    while (out.length < max && !PIN.test(last.text)) {
      const next = cells
        .filter((o) => o !== last && isUnder(o, last, 2) && o.x < right(start) + start.h && right(o) > start.x - start.h)
        .sort((a, b) => mid(a) - mid(b) || Math.abs(a.x - start.x) - Math.abs(b.x - start.x))[0]
      if (!next || isLabel(next)) break
      out.push(next.text)
      last = next
    }
    return out.join(', ')
  }

  return {
    text: textOf(cells),
    values(field, lines = 1) {
      const out: string[] = []
      for (const L of cells.filter((c) => c.field === field)) {
        for (const start of [L.rest, rightOf(L), below(L)]) if (start) out.push(lines > 1 ? continued(start, lines) : start.text)
      }
      return out
    },
    labels: (field) => cells.filter((c) => c.field === field).map((c) => c.label ?? ''),
  }
}
