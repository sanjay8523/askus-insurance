import { useEffect, useRef } from 'react'
import Ic from './Ic'
import type { Product } from '../lib/products'

/**
 * Partner quote journey shown full-screen in an iframe.
 * Nothing is hidden, cropped or scaled: the partner page runs exactly as it does on its own site,
 * so every step (quotes, details, payment, redirects) works without interference.
 */
export default function JourneyModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])

  return (
    <dialog
      ref={dlg}
      id="modal"
      className="journey-modal"
      aria-labelledby="modal-title"
      onCancel={(e) => { e.preventDefault(); onClose() }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{product.name}</h2>
      </div>
      <div id="modal-content">
        <div className="journey-topbar">
          <button type="button" className="primary-button journey-back" aria-label="Back" onClick={onClose} autoFocus>
            <Ic n="arrow-left" /> Back
          </button>
          <a className="brand journey-home" href="#" aria-label="Askus Insurance home" onClick={(e) => { e.preventDefault(); onClose() }}>
            <span><b>Askus</b> Insurance</span>
          </a>
        </div>
        <div className="journey-frame">
          {product.journeyUrl ? (
            <iframe
              src={product.journeyUrl}
              title={`${product.name} journey`}
              // No `sandbox` attribute on purpose: the partner app (Policybazaar) is trusted and its later
              // steps (redirects, OTP, payment, workers) can break under sandbox restrictions.
              allow="clipboard-write; payment; geolocation; camera; microphone; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ position: 'absolute', inset: 0, top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <p className="modal-note">Online journey is unavailable right now.</p>
          )}
        </div>
      </div>
    </dialog>
  )
}
