import { useState, type FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { uploadDocument } from '../lib/cloudinary'
import { useAuth } from '../context/AuthContext'
import { normMobile, validMobile, validName } from '../lib/validate'
import { PRODUCTS } from '../lib/products'
import Ic from './Ic'

const MAX = 10 * 1024 * 1024
const OK = ['image/jpeg', 'image/png', 'application/pdf']

export default function DocUpload({ onNeedSignIn }: { onNeedSignIn: () => void }) {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  function add(list: FileList | File[]) {
    const next = Array.from(list)
    const bad = next.find((f) => !OK.includes(f.type) || f.size > MAX)
    if (bad) return setMsg({ ok: false, text: `${bad.name}: only JPG, PNG or PDF up to 10MB.` })
    setMsg(null)
    setFiles((p) => [...p, ...next].slice(0, 10))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (!user) return onNeedSignIn()
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>
    const bad = validName(f.name) ?? validMobile(f.mobile)
    if (bad) return setMsg({ ok: false, text: bad })
    if (!f.type) return setMsg({ ok: false, text: 'Please choose an insurance type.' })
    if (!files.length) return setMsg({ ok: false, text: 'Please choose at least one document to upload.' })

    setBusy(true)
    setMsg(null)
    try {
      const requestId = crypto.randomUUID()
      const uploaded = []
      for (const [i, file] of files.entries()) uploaded.push(await uploadDocument(requestId, i, file))
      await addDoc(collection(db, 'documentRequests'), {
        uid: user.uid, name: f.name.trim(), mobile: normMobile(f.mobile), type: f.type,
        files: uploaded, status: 'new', createdAt: serverTimestamp(),
      })
      form.reset()
      setFiles([])
      setMsg({ ok: true, text: 'Received! Our team will process your documents within 24 hours.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error && err.message ? err.message : 'Upload failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="container doc-upload-section" id="doc-upload" aria-labelledby="doc-upload-title">
      <div className="section-intro">
        <span className="eyebrow">OFFLINE DOCUMENT ASSISTANCE</span>
        <h2 id="doc-upload-title">Upload your documents,<br />we'll handle the rest</h2>
        <p>Share your policy documents here. Our team manually reviews every submission and processes it within <b>24 hours</b> — then reaches out to you directly.</p>
      </div>
      <form className="doc-upload-form" onSubmit={submit} noValidate>
        <div className="form-row">
          <label>Full name<input type="text" name="name" placeholder="Your name" /></label>
          <label>Mobile number<input type="tel" name="mobile" inputMode="numeric" placeholder="10-digit mobile number" /></label>
        </div>
        <label>Insurance type
          <select name="type" defaultValue="">
            <option value="" disabled>Select insurance type</option>
            {PRODUCTS.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </label>
        <label
          className={`upload-dropzone${drag ? ' dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
        >
          <Ic n="files" />
          <span><b>Click to choose files</b> or drag &amp; drop</span>
          <small>RC, Aadhaar, previous policy copy, photos — JPG, PNG or PDF, up to 10MB each</small>
          <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
        </label>
        {files.length > 0 && (
          <ul className="file-chip-list">
            {files.map((f, i) => (
              <li key={i}>
                <span>{f.name.length > 26 ? f.name.slice(0, 23) + '…' : f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
        )}
        {msg && <p role="status" style={{ margin: 0, color: msg.ok ? 'var(--green)' : '#d93025' }}>{msg.text}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Uploading…' : user ? 'Submit for manual processing' : 'Sign in to submit'} <Ic n="arrow-right" />
        </button>
        <p className="upload-note"><Ic n="shield-check" /><span>Your files are stored privately and securely and are visible only to you and our review team. We'll process them within 24 hours.</span></p>
      </form>
    </section>
  )
}
