import { useId } from 'react'

/** Money-themed banner on top of the Buy Online / Buy Offline cards: original illustration (coins, rupee notes, sparkles) with one big number. */

const GOLD_SIDE = '#C98A14'
const GOLD_RIM = '#FFF3C4'
const FONT = 'Inter, system-ui, sans-serif'

function Sparkle({ x, y, s, o = 0.9 }: { x: number; y: number; s: number; o?: number }) {
  const q = s / 4
  return <path transform={`translate(${x} ${y})`} opacity={o} fill="#fff"
    d={`M0 ${-s} C0 ${-q} ${q} 0 ${s} 0 C${q} 0 0 ${q} 0 ${s} C0 ${q} ${-q} 0 ${-s} 0 C${-q} 0 0 ${-q} 0 ${-s}Z`} />
}

function CoinStack({ x, y, n, id }: { x: number; y: number; n: number; id: string }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const cy = y - i * 6.5
        return (
          <g key={i}>
            <ellipse cx={x} cy={cy + 6} rx={24} ry={7.5} fill={GOLD_SIDE} />
            <rect x={x - 24} y={cy} width={48} height={6} fill={GOLD_SIDE} />
            <ellipse cx={x} cy={cy} rx={24} ry={7.5} fill={`url(#${id}-gold)`} stroke={GOLD_RIM} strokeWidth={0.8} />
            <ellipse cx={x} cy={cy} rx={16} ry={4.6} fill="none" stroke="#E0A02A" strokeWidth={0.8} opacity={0.7} />
          </g>
        )
      })}
    </g>
  )
}

function StandingCoin({ x, y, r, rot, id }: { x: number; y: number; r: number; rot: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <circle r={r} fill={`url(#${id}-gold)`} stroke={GOLD_RIM} strokeWidth={1.4} />
      <circle r={r - 5} fill="none" stroke="#D99A22" strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} fontWeight={800} fill="#B9770E" fontFamily={FONT}>₹</text>
    </g>
  )
}

function Note({ x, y, rot, id }: { x: number; y: number; rot: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-38} y={-22} width={76} height={44} rx={5} fill={`url(#${id}-note)`} stroke="#fff" strokeOpacity={0.75} strokeWidth={1} />
      <rect x={-33} y={-17} width={66} height={34} rx={3} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.8} strokeDasharray="2 2" />
      <circle r={11} fill="#fff" fillOpacity={0.28} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill="#fff" fontFamily={FONT}>₹</text>
      <text x={-28} y={-9} fontSize={7} fontWeight={700} fill="#fff" fillOpacity={0.85} fontFamily={FONT}>₹</text>
      <text x={21} y={14} fontSize={7} fontWeight={700} fill="#fff" fillOpacity={0.85} fontFamily={FONT}>₹</text>
    </g>
  )
}

export default function MoneyBanner({ variant, label, stat, caption }: { variant: 'online' | 'offline'; label: string; stat: string; caption: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const online = variant === 'online'
  return (
    <span className="relative block h-28 overflow-hidden"
      style={{ background: online ? 'linear-gradient(135deg,#4338ca 0%,#4f46e5 55%,#7c3aed 100%)' : 'linear-gradient(135deg,#047857 0%,#059669 55%,#10b981 100%)' }}>
      <span className="relative z-10 flex h-full max-w-[50%] flex-col justify-center pl-5">
        <span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-white/75">{label}</span>
        <span className="mt-1 block text-[34px] font-extrabold leading-none tracking-tight text-white">{stat}</span>
        <span className="mt-1.5 block text-[12px] leading-snug text-white/85">{caption}</span>
      </span>
      <svg viewBox="0 0 170 100" className="absolute bottom-0 right-0 h-full w-auto" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE9A0" /><stop offset="1" stopColor="#F2AE2E" /></linearGradient>
          <linearGradient id={`${id}-note`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={online ? '#a5b4fc' : '#86efac'} /><stop offset="1" stopColor={online ? '#6366f1' : '#16a34a'} /></linearGradient>
        </defs>
        {online ? (
          <>
            <circle cx={118} cy={62} r={46} fill="#fff" opacity={0.08} />
            <CoinStack x={96} y={84} n={5} id={id} />
            <CoinStack x={148} y={88} n={2} id={id} />
            <StandingCoin x={130} y={46} r={24} rot={12} id={id} />
            <g>
              <circle cx={84} cy={26} r={14} fill="#fff" />
              <text x={84} y={27} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={800} fill="#4338ca" fontFamily={FONT}>%</text>
            </g>
            <Sparkle x={60} y={16} s={5} /><Sparkle x={158} y={26} s={4} o={0.8} /><Sparkle x={52} y={62} s={3.5} o={0.7} />
          </>
        ) : (
          <>
            <circle cx={120} cy={60} r={46} fill="#fff" opacity={0.1} />
            <Note x={104} y={50} rot={-14} id={id} />
            <Note x={128} y={58} rot={9} id={id} />
            <CoinStack x={146} y={90} n={3} id={id} />
            <StandingCoin x={78} y={72} r={18} rot={-10} id={id} />
            <Sparkle x={70} y={22} s={5} /><Sparkle x={156} y={22} s={4} o={0.8} /><Sparkle x={48} y={50} s={3.5} o={0.7} />
          </>
        )}
      </svg>
    </span>
  )
}
