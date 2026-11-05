import { useEffect, useRef, type ReactNode } from 'react'
import Ic from './Ic'

/** Native <dialog> styled by the original #modal CSS. */
export default function Modal({
  title, eyebrow = 'INSURANCE, SIMPLIFIED', onClose, children, className = '', header = true,
}: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; className?: string; header?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current!
    if (!d.open) d.showModal()
    return () => d.close()
  }, [])

  return (
    <dialog
      id="modal"
      ref={ref}
      className={className}
      aria-labelledby="modal-title"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-header">
        <div>
          <span className="eyebrow" id="modal-eyebrow">{eyebrow}</span>
          <h2 id="modal-title">{title}</h2>
        </div>
        <button className="icon-button" id="close-modal" aria-label="Close dialog" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div id="modal-content">{children}</div>
    </dialog>
  )
}
