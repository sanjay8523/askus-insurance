import { useEffect, useRef, useState } from 'react'
import Ic from './Ic'
import type { Product } from '../lib/products'

const BASE_H = 580
/** Health / Term: hide the partner's top logo bar and bottom bar for the whole journey. */
const PARTNER_BAR = 56
/** Extra frame height pushed below the visible area so the partner's long disclaimer footer can't be scrolled into view. */
const PARTNER_FOOTER = 640
const partnerHeader = (step: number) => (step === 1 || step === 3 ? 50 : step <= 2 ? 60 : 0)

/** Partner journey in an iframe, scaled to fit exactly like the original preview. */
export default function JourneyModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  const lastLen = useRef(history.length)
  const lastAdvance = useRef(0)
  const [step, setStep] = useState(0)
  const motor = product.id === 'car' || product.id === 'bike'

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])

  useEffect(() => {
    const f = frame.current!, v = view.current!
    const fit = () => {
      const { width, height } = f.getBoundingClientRect()
      if (!width || !height) return
      const s = Math.min(1, width / 1188, height / BASE_H)
      v.style.width = `${width / s}px`
      v.style.height = `${height / s}px`
      v.style.transform = `scale(${s})`
    }
    const ro = new ResizeObserver(fit)
    ro.observe(f)
    fit()
    return () => ro.disconnect()
  }, [])

  // Advance the "step" (which decides how much of the partner header/footer to mask) whenever the
  // partner app navigates: either a full iframe load or an in-frame route change (history length grows).
  const advance = () => {
    lastLen.current = history.length
    if (Date.now() - lastAdvance.current < 1500) return
    lastAdvance.current = Date.now()
    setStep((x) => x + 1)
  }
  useEffect(() => {
    if (!motor) return
    const t = setInterval(() => { if (loaded.current && history.length !== lastLen.current) advance() }, 100)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor])

  const footerBand = motor && (step === 1 || step > 3)
  const late = motor && step > 3
  const cls = ['journey-modal', (!motor || footerBand) && 'journey-footer-band', late && 'journey-late'].filter(Boolean).join(' ')

  return (
    <dialog ref={dlg} id="modal" className={cls} aria-labelledby="modal-title" onCancel={(e) => { e.preventDefault(); onClose() }}>
      <div className="modal-header">
        <div>
          <span className="eyebrow" id="modal-eyebrow">PARTNER JOURNEY</span>
          <h2 id="modal-title">{product.name}</h2>
        </div>
        <button className="icon-button" id="close-modal" aria-label="Close dialog" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div id="modal-content">
        <div className="journey-topbar">
          <button type="button" className="primary-button journey-back" aria-label="Back" onClick={onClose} autoFocus><Ic n="arrow-left" /> Back</button>
          <a className="brand journey-home" href="#" aria-label="Askus Insurance home" onClick={(e) => { e.preventDefault(); onClose() }}><span><b>Askus</b> Insurance</span></a>
        </div>
        <div className="journey-frame" ref={frame}>
          <div
            ref={view}
            className={['journey-viewport', motor && 'journey-full'].filter(Boolean).join(' ')}
            style={{ ['--partner-header' as string]: `${motor ? partnerHeader(step) : PARTNER_BAR}px`, ...(motor ? {} : { ['--partner-footer' as string]: `${PARTNER_FOOTER}px` }), ...(product.id === 'bike' ? { ['--first-visible' as string]: '240px' } : {}) }}
          >
            {product.journeyUrl ? (
              <iframe
                src={product.journeyUrl}
                title={`${product.name} journey`}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                allow="clipboard-write"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => { if (loaded.current) advance(); loaded.current = true; lastLen.current = history.length }}
              />
            ) : (
              <p className="modal-note">Online journey is unavailable right now.</p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}
