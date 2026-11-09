import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { signOut } from 'firebase/auth'
import AuthModal from './components/AuthModal'
import DocUpload from './components/DocUpload'
import Ic from './components/Ic'
import JourneyModal from './components/JourneyModal'
import ModeChoice from './components/ModeChoice'
import OfflineModal from './components/OfflineModal'
import type { OfflineType } from './lib/offline'
import Modal from './components/Modal'
import { ClaimsBand, ProductTiles } from './components/home/HomeHero'
import { useAuth } from './context/AuthContext'
import { auth, firebaseConfigured } from './lib/firebase'
import { inr, PRODUCTS, type Product } from './lib/products'

const TOP_LEVEL = new Set(['car', 'bike', 'auto', 'commercial'])
/** Products that offer an Online / Offline choice. */
const HAS_OFFLINE = new Set(['car', 'bike'])
const GROUPS = ['Motor Insurance', 'Health Insurance', 'Term Insurance']
const REVIEWS = [
  { name: 'Look beyond the premium', quote: 'Compare exclusions, waiting periods, deductibles and renewal conditions alongside the price.', question: 'What should I check in my insurance cover?' },
  { name: 'Prepare before a claim', quote: 'Keep your policy details and supporting documents accessible. Check the notification deadlines with your insurer.', question: 'How do claims work?' },
]

const MegaMenu = () => (
  <>
    {GROUPS.map((g) => (
      <div key={g}>
        <h3>{g}</h3>
        {PRODUCTS.filter((p) => p.group === g).map((p) => <button key={p.id} data-product={p.id}>{p.name}</button>)}
      </div>
    ))}
  </>
)
const RenewMenu = () => <>{PRODUCTS.map((p) => <button key={p.id} data-service="renew" data-kind={p.name}>{p.name}</button>)}</>
const PartnerButtons = () => <>{PRODUCTS.map((p) => <button key={p.id} data-product={p.id}><Ic n={p.iconName} /><span>{p.name}</span></button>)}</>
function ReviewCards({ index }: { index: number }) {
  return (
    <>
      {REVIEWS.map((_, t) => REVIEWS[(t + index) % REVIEWS.length]).map((r) => (
        <article className="review-card" key={r.name}>
          <h3>{r.name}</h3><p>{r.quote}</p>
          <button className="text-link" data-question={r.question}>Learn more <Ic n="arrow-right" /></button>
        </article>
      ))}
    </>
  )
}

const closeMenus = () =>
  document.querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => {
    b.setAttribute('aria-expanded', 'false')
    document.getElementById(b.dataset.menu!)!.hidden = true
  })
const openMenu = (b: HTMLElement) => {
  closeMenus()
  b.setAttribute('aria-expanded', 'true')
  document.getElementById(b.dataset.menu!)!.hidden = false
}

export default function App() {
  const { user, pendingGoogleUser } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [journey, setJourney] = useState<Product | null>(null)
  const [choice, setChoice] = useState<Product | null>(null)
  const [offline, setOffline] = useState<OfflineType | null>(null)
  const [wantsOffline, setWantsOffline] = useState<OfflineType | null>(null)
  // Dev-only shortcut for previewing the offline flow: http://localhost:5173/?offline=bike (stripped from production builds)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const q = new URLSearchParams(location.search).get('offline')
    if (q === 'car' || q === 'bike') setOffline(q)
  }, [])
  const [note, setNote] = useState<{ title: string; text: string } | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  // Google users without a verified mobile number must add one
  useEffect(() => { if (pendingGoogleUser) setAuthOpen(true) }, [pendingGoogleUser])

  // Everything interactive needs a signed-in, mobile-verified user. If they are not, we ask them to sign in first
  // and then carry on with whatever they clicked (for example the Online / Offline choice for car insurance).
  const afterLogin = useRef<(() => void) | null>(null)
  const requireLogin = (action: () => void) => {
    if (user) return action()
    afterLogin.current = action
    setAuthOpen(true)
  }
  useEffect(() => {
    if (user && afterLogin.current) { const run = afterLogin.current; afterLogin.current = null; run() }
  }, [user])
  const closeAuth = useCallback((reason?: 'done' | 'cancel') => {
    setAuthOpen(false)
    if (reason === 'cancel') afterLogin.current = null
  }, [])

  // Offline needs a signed-in (mobile-verified) user: continue straight into the form after sign-in
  useEffect(() => {
    if (user && wantsOffline) { setOffline(wantsOffline); setWantsOffline(null) }
  }, [user, wantsOffline])

  const openOnline = (p: Product) => {
    if (TOP_LEVEL.has(p.id) && p.journeyUrl) window.location.href = p.journeyUrl
    else setJourney(p)
  }
  const startOffline = (p: Product) => {
    setChoice(null)
    if (user) setOffline(p.id as OfflineType)
    else { setWantsOffline(p.id as OfflineType); setAuthOpen(true) }
  }

  // Desktop hover menus (same behaviour as the original page)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (min-width: 851px)')
    let timer: number
    const items = [...document.querySelectorAll<HTMLElement>('.nav-item')]
    const cleanups = items.map((item) => {
      const btn = item.querySelector<HTMLElement>('[data-menu]')
      if (!btn) return () => {}
      const enter = () => { if (mq.matches) { clearTimeout(timer); openMenu(btn) } }
      const leave = () => { if (mq.matches) { clearTimeout(timer); timer = window.setTimeout(closeMenus, 150) } }
      item.addEventListener('mouseenter', enter)
      item.addEventListener('mouseleave', leave)
      return () => { item.removeEventListener('mouseenter', enter); item.removeEventListener('mouseleave', leave) }
    })
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeMenus()
    document.addEventListener('keydown', esc)
    return () => { cleanups.forEach((c) => c()); document.removeEventListener('keydown', esc) }
  }, [])

  const soon = (title: string, text = 'This feature is being moved over to the new Askus Insurance app and will be available shortly.') => setNote({ title, text })

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement
    const menuBtn = t.closest<HTMLElement>('[data-menu]')
    if (menuBtn) {
      if (menuBtn.getAttribute('aria-expanded') === 'true') closeMenus()
      else openMenu(menuBtn)
      return
    }
    if (t.closest('#mobile-toggle')) {
      const nav = document.getElementById('navigation')!
      const open = nav.classList.toggle('open')
      const tg = document.getElementById('mobile-toggle')!
      tg.setAttribute('aria-expanded', String(open))
      tg.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
      return
    }
    const prod = t.closest<HTMLElement>('[data-product]')
    if (prod) {
      closeMenus()
      const p = PRODUCTS.find((x) => x.id === prod.dataset.product)
      if (!p) return
      // Car and bike: choose Online (partner journey) or Offline (our own form, processed by the team).
      // Same as the original preview: motor journeys open the partner page as the full page (it only works
      // reliably at the top level); health and term run inside the iframe dialog.
      requireLogin(() => { if (HAS_OFFLINE.has(p.id)) setChoice(p); else openOnline(p) })
      return
    }
    const review = t.closest<HTMLElement>('[data-review]')
    if (review) return setReviewIndex((i) => (i + Number(review.dataset.review) + REVIEWS.length) % REVIEWS.length)
    const action = t.closest<HTMLElement>('[data-action]')
    if (action) {
      closeMenus()
      const a = action.dataset.action
      if (a === 'signin') { if (user) window.location.href = '/account'; else setAuthOpen(true); return }
      if (a === 'dashboard') return requireLogin(() => soon('Saved comparisons'))
      if (a === 'chat') return requireLogin(() => soon('Insurance help'))
      if (a === 'callback') return requireLogin(() => soon('Request a callback', 'Please call our helpline on 7358447586 for now.'))
      if (a === 'privacy') return soon('Privacy notice', 'Your account details and any documents you upload are stored securely in your private Askus Insurance account and are visible only to you and our review team.')
    }
    const svc = t.closest<HTMLElement>('[data-service]')
    if (svc) {
      closeMenus()
      const s = svc.dataset.service
      return requireLogin(() => soon(s === 'claim' ? 'Claims assistance' : s === 'track' ? 'Track a claim' : 'Renew your policy'))
    }
    if (t.closest('[data-question]')) return requireLogin(() => soon('Insurance help'))
    if (t.closest('[data-calculator]')) return requireLogin(() => soon('Calculators'))
  }

  return (
    <div onClick={onClick}>
      {!firebaseConfigured && (
        <div className="preview-bar" style={{ background: '#fff4d6', color: '#7a5600' }}>
          Firebase isn't configured yet: add your web app keys to <code>.env.local</code> and restart the dev server.
        </div>
      )}
      <a className="skip-link" href="#main">Skip to main content</a>
          <header className="header">
            <div className="container header-inner">
              <a className="brand" href="#"
                ><span><b>Askus</b> Insurance</span><small>WE ARE HAPPY TO HELP YOU</small></a
              >
              <button
                className="icon-button mobile-toggle"
                id="mobile-toggle"
                aria-label="Open navigation"
                aria-expanded={false}
                aria-controls="navigation"
              >
                <Ic n="menu" />
              </button>
              <nav id="navigation" aria-label="Main navigation">
                <div className="nav-item">
                  <button className="nav-button" data-menu="insurance-menu" aria-expanded={false}>
                    Insurance Products <Ic n="chevron-down" />
                  </button>
                  <div className="dropdown mega-menu" id="insurance-menu" hidden><MegaMenu /></div>
                </div>
                <div className="nav-item">
                  <button className="nav-button" data-menu="renew-menu" aria-expanded={false}>
                    Renew Your Policy <Ic n="chevron-down" />
                  </button>
                  <div className="dropdown" id="renew-menu" hidden><RenewMenu /></div>
                </div>
                <div className="nav-item">
                  <button className="nav-button" data-menu="claim-menu" aria-expanded={false}>
                    Claim <Ic n="chevron-down" />
                  </button>
                  <div className="dropdown" id="claim-menu" hidden>
                    <button data-service="claim">File a new claim</button
                    ><button data-service="track">Track an existing claim</button
                    ><button data-question="How do I find a network hospital?">
                      Find a network hospital <Ic n="arrow-right" />
                    </button>
                  </div>
                </div>
                <div className="nav-item">
                  <button className="nav-button" data-menu="support-menu" aria-expanded={false}>
                    Support <Ic n="chevron-down" />
                  </button>
                  <div className="dropdown" id="support-menu" hidden>
                    <button data-action="dashboard">Saved comparisons</button
                    ><button data-action="callback">Request a callback</button
                    ><button data-action="chat">Help with insurance</button
                    ><a href="#faq">Frequently asked questions</a>
                  </div>
                </div>
              </nav>
              <div className="header-actions">
                <div className="nav-item">
                  <button
                    className="expert-button"
                    data-menu="expert-menu"
                    aria-expanded={false}
                    aria-label="Talk to Expert"
                  >
                    <Ic n="phone" /><span>Talk to Expert</span>
                  </button>
                  <div className="dropdown expert-dropdown" id="expert-menu" hidden>
                    <a className="expert-line" href="tel:+917358447586">
                      <Ic n="headset" />
                      <span
                        ><small>Helpline for insurance enquiries</small><strong>7358447586</strong></span
                      >
                    </a>
                  </div>
                </div>
                <button className="outline-button" data-action="signin" id="account-button">{user ? <span><span className="account-my">My </span>Account<span className="account-name"> ({user.displayName?.split(' ')[0] ?? 'you'})</span></span> : 'Sign In'}</button>
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <ProductTiles />
            <ClaimsBand />
            <section className="container cashback-section" id="cashback-offer" aria-labelledby="cashback-title">
              <div className="cashback-callout">
                <Ic n="tags" />
                <div>
                  <span className="eyebrow">ONLINE QUOTE CASHBACK</span>
                  <h2 id="cashback-title">Get rewarded for going online</h2>
                  <p>
                    Complete an online quote through Askus Insurance and receive assured cashback —
                    <b>₹100 on Bike Insurance</b> and <b>₹300 on Car Insurance</b>. Cashback is credited
                    once your policy is confirmed.
                  </p>
                </div>
              </div>
            </section>
            <section className="quick-services" aria-label="Policy services">
              <div className="container service-grid">
                <button data-service="renew">
                  <span className="service-icon mint"><Ic n="refresh-cw" /></span
                  ><span><b>Renew your policy</b><small>Keep your protection going</small></span
                  ><Ic n="chevron-right" /></button
                ><button data-service="claim">
                  <span className="service-icon peach"><Ic n="hand-heart" /></span
                  ><span><b>Need claim assistance?</b><small>Help when it matters most</small></span
                  ><Ic n="chevron-right" /></button
                ><button data-action="dashboard">
                  <span className="service-icon blue"><Ic n="files" /></span
                  ><span><b>Your saved comparisons</b><small>Pick up where you left off</small></span
                  ><Ic n="chevron-right" />
                </button>
              </div>
            </section>
            <DocUpload onNeedSignIn={() => setAuthOpen(true)} />
            <section className="container trust-section" id="about">
              <div className="section-intro">
                <span className="eyebrow">INSURANCE, SIMPLIFIED</span>
                <h2>Find your cover <br />with Askus Insurance</h2>
                <p>A little clarity today. <br />A more secure tomorrow.</p>
                <a className="text-link" href="#faq">Get to know your cover <Ic n="arrow-right" /></a>
              </div>
              <div className="trust-grid">
                <article>
                  <Ic n="users-round" />
                  <h3>For your family</h3>
                  <p>Explore protection for yourself and the people who depend on you.</p>
                </article>
                <article>
                  <Ic n="building-2" />
                  <h3>Clear comparisons</h3>
                  <p>Review sample plans side by side before taking the next step.</p>
                </article>
                <article>
                  <Ic n="badge-indian-rupee" />
                  <h3>Choice & value</h3>
                  <p>Understand the cover, benefits and price before you decide.</p>
                </article>
                <article>
                  <Ic n="heart-handshake" />
                  <h3>Claims support</h3>
                  <p>Know the next steps when you need to make a claim.</p>
                </article>
              </div>
              <small className="source-note"
                >Sample plans are illustrative. Actual cover and premiums depend on the insurer's
                terms.</small
              >
            </section>
            <section className="ai-section">
              <div className="container ai-inner">
                <div>
                  <span className="eyebrow">MEET YOUR INSURANCE GUIDE</span>
                  <h2>A little less complicated.<br />A lot more confident.</h2>
                  <p>
                    Get clear answers to common insurance questions.<br />Understand your cover before you
                    choose it.
                  </p>
                  <button className="primary-button" data-action="chat">
                    Ask an insurance question <Ic n="arrow-up-right" /></button
                  ><small>Curated answers. Not personalised financial advice.</small>
                </div>
                <div className="question-list">
                  <div className="guide-label">
                    <Ic n="messages-square" /> What would you like to know?
                  </div>
                  <button data-question="How much health insurance do I need?">
                    How much health insurance do I need? <Ic n="arrow-up-right" /></button
                  ><button data-question="What is a waiting period?">
                    What is a waiting period? <Ic n="arrow-up-right" /></button
                  ><button data-question="Term insurance or life insurance?">
                    Term insurance or life insurance? <Ic n="arrow-up-right" />
                  </button>
                </div>
              </div>
            </section>
            <section className="container advantage-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">MORE THAN A POLICY</span>
                  <h2>The Askus Insurance approach</h2>
                </div>
                <p>Understand your options, compare sample cover<br />and prepare for your next step.</p>
              </div>
              <div className="advantage-grid">
                <div>
                  <Ic n="tags" />
                  <h3>Compare prices</h3>
                  <p>Look beyond the premium</p>
                </div>
                <div>
                  <Ic n="message-circle-heart" />
                  <h3>Informed choices</h3>
                  <p>Understand your options</p>
                </div>
                <div>
                  <Ic n="shield-check" />
                  <h3>Reliable information</h3>
                  <p>Read the policy wording</p>
                </div>
                <div>
                  <Ic n="heart-handshake" />
                  <h3>Claims assistance</h3>
                  <p>Know what comes next</p>
                </div>
                <div>
                  <Ic n="headset" />
                  <h3>Here to help</h3>
                  <p>Find the right support</p>
                </div>
              </div>
            </section>
            <section className="app-section">
              <div className="container app-inner">
                <div>
                  <span className="eyebrow">YOUR INSURANCE. ALWAYS WITH YOU.</span>
                  <h2>Your shortlist, ready when you are</h2>
                  <p>Keep your insurance options together with Askus Insurance.</p>
                  <ul className="check-list">
                    <li><Ic n="check" />Compare illustrative insurance options</li>
                    <li><Ic n="check" />Save sample plans in this browser</li>
                    <li><Ic n="check" />Review cover and sample premiums</li>
                    <li><Ic n="check" />Download your selected comparison</li>
                  </ul>
                  <button className="primary-button" data-action="dashboard">
                    <Ic n="bookmark" /> Open saved comparisons
                  </button>
                  <small>Stored on this device only. No policy purchase is created.</small>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&amp;fit=crop&amp;w=800&amp;q=80"
                  alt="Reviewing financial documents at a desk"
                  loading="lazy" />
              </div>
            </section>
            <section className="container reviews-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">BEFORE YOU DECIDE</span>
                  <h2>Insurance essentials</h2>
                </div>
                <div className="review-controls">
                  <button className="icon-button" data-review="-1" aria-label="Previous insurance tips">
                    <Ic n="arrow-left" /></button
                  ><button className="icon-button" data-review="1" aria-label="Next insurance tips">
                    <Ic n="arrow-right" />
                  </button>
                </div>
              </div>
              <div className="review-grid" id="review-grid" aria-live="polite"><ReviewCards index={reviewIndex} /></div>
              <small className="source-note"
                >General educational information, not personalised financial advice.</small
              >
            </section>
            <section className="partners-section" id="partners">
              <div className="container">
                <div className="center">
                  <span className="eyebrow">A WORLD OF CHOICE</span>
                  <h2>Explore your protection</h2>
                  <p>Find a starting point for every stage of life</p>
                </div>
                <div className="partner-grid" id="partner-grid"><PartnerButtons /></div>
                <p className="source-note center">
                  Product availability and terms must be confirmed with an authorised insurer.
                </p>
              </div>
            </section>
            <section className="container faq-section" id="faq">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LET'S CLEAR THINGS UP</span>
                  <h2>Frequently asked questions</h2>
                </div>
              </div>
              <div className="faq-layout">
                <div>
                  <p>Insurance doesn't have to be confusing.</p>
                  <button className="text-link" data-action="chat">
                    Ask another question <Ic n="arrow-right" />
                  </button>
                </div>
                <div className="faq-list">
                  <details>
                    <summary>Why should I compare insurance plans?<Ic n="plus" /></summary>
                    <p>
                      Premiums, exclusions, waiting periods and benefits differ between insurers. Compare
                      the policy wording and coverage alongside the price to understand what fits your
                      needs.
                    </p>
                  </details>
                  <details>
                    <summary>Can I buy a policy on this website?<Ic n="plus" /></summary>
                    <p>
                      This is an independent interface preview. Plans and prices shown in comparisons are
                      illustrative, and no policy can be purchased here. Visit an authorised insurer or
                      broker for a binding quote.
                    </p>
                  </details>
                  <details>
                    <summary>
                      What should I check before buying health insurance?<Ic n="plus" />
                    </summary>
                    <p>
                      Review the sum insured, hospital network, room-rent limits, co-payments, waiting
                      periods, exclusions and renewal terms. Disclose your medical history accurately.
                    </p>
                  </details>
                  <details>
                    <summary>
                      What documents are usually needed for a claim?<Ic n="plus" />
                    </summary>
                    <p>
                      Requirements depend on your insurer and policy. You may need your policy number,
                      identification, claim form, invoices and relevant medical or incident records.
                      Contact your insurer for its current checklist.
                    </p>
                  </details>
                  <details>
                    <summary>Are calculator returns guaranteed?<Ic n="plus" /></summary>
                    <p>
                      No. Calculations are estimates based on the inputs you choose. Investment returns
                      may fluctuate. Estimates exclude tax, fees and inflation and are not financial
                      advice.
                    </p>
                  </details>
                </div>
              </div>
            </section>
            <section className="help-section" id="contact">
              <div className="container help-inner">
                <img
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&amp;fit=crop&amp;w=400&amp;q=80"
                  alt="A conversation about healthcare"
                  loading="lazy" />
                <div>
                  <span className="eyebrow">HERE WHEN YOU NEED US</span>
                  <h2>Have a question?<br />Let's talk.</h2>
                  <p>Find answers about your insurance, renewals and claims.</p>
                  <div className="help-actions">
                    <button className="primary-button" data-action="callback">
                      <Ic n="phone" /> Request a callback</button
                    ><button className="outline-button" data-action="chat">
                      <Ic n="messages-square" /> Get help
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>
          <footer>
            <div className="container">
              <div className="footer-top">
                <a className="brand footer-brand" href="#"
                  ><span><b>Askus</b> Insurance</span><small>WE ARE HAPPY TO HELP YOU</small></a
                ><span>Askus Insurance preview</span
                ><a className="text-link" href="#main">Back to top <Ic n="arrow-up" /></a>
              </div>
              <div className="footer-links">
                <div>
                  <h3>Motor Insurance</h3>
                  <button data-product="car">Car Insurance</button
                  ><button data-product="bike">Bike Insurance</button
                  ><button data-product="auto">Auto Insurance</button
                  ><button data-product="commercial">Commercial Vehicle Insurance</button>
                </div>
                <div>
                  <h3>Health & Life</h3>
                  <button data-product="health">Health Insurance</button
                  ><button data-product="term">Term Insurance</button>
                </div>
                <div>
                  <h3>Calculators</h3>
                  <button data-calculator="sip">SIP Calculator</button
                  ><button data-calculator="compound">Compound Interest Calculator</button
                  ><button data-calculator="emi">EMI Calculator</button
                  ><button data-calculator="bmi">BMI Calculator</button>
                </div>
                <div>
                  <h3>Resources</h3>
                  <a href="#faq">FAQs</a><a href="#partners">Insurance Categories</a
                  ><button data-service="claim">Claims Assistance</button
                  ><button data-service="renew">Renew Your Policy</button
                  ><button data-action="dashboard">Saved Comparisons</button>
                </div>
                <div>
                  <h3>Askus Insurance</h3>
                  <a href="#about">About Askus Insurance</a><a href="#contact">Contact & Help</a
                  ><a href="https://irdai.gov.in/" target="_blank" rel="noopener noreferrer">IRDAI</a
                  ><a href="https://bimabharosa.irdai.gov.in/" target="_blank" rel="noopener noreferrer"
                    >Bima Bharosa</a
                  ><button data-action="privacy">Preview Privacy Notice</button>
                </div>
              </div>
              <div className="footer-payment">
                <div>
                  <b>Askus Insurance</b>
                  <p className="source-note">Explore with clarity. Choose with confidence.</p>
                </div>
                <span><Ic n="lock-keyhole" /> No payments are collected in this preview</span>
              </div>
              <div className="legal">
                <p>
                  <b>About this preview:</b> Askus Insurance is an insurance comparison frontend preview.
                  It does not issue policies or act as an authorised insurance broker. Any insurer or
                  product names belong to their respective owners and do not imply a partnership.
                </p>
                <p>
                  All sample premiums and benefits are illustrative, not offers or financial advice. No
                  authentication, OTP, lead submission, claim processing, policy issuance or payment
                  processing is connected. Photography is illustrative and does not represent customers or
                  endorsements.
                </p>
                <p className="fraud-note">
                  <b>BEWARE OF FRAUDULENT OFFERS.</b> Never share OTPs, passwords or payment details with
                  unknown callers. Verify an insurer or intermediary through official channels.
                </p>
                <div className="footer-bottom">
                  <span>2026 · Askus Insurance</span
                  ><a href="#contact">Contact & Help <Ic n="arrow-right" /></a>
                </div>
              </div>
            </div>
          </footer>
          <button className="chat-launcher" data-action="chat" aria-label="Need help? Open insurance help">
            <Ic n="messages-square" /><span>Need help?</span>
          </button>
          
      {authOpen && <AuthModal onClose={closeAuth} />}
      {choice && <ModeChoice product={choice} onClose={() => setChoice(null)} onOnline={() => { const c = choice; setChoice(null); openOnline(c) }} onOffline={() => startOffline(choice)} />}
      {offline && <OfflineModal type={offline} onClose={() => setOffline(null)} />}
      {journey && <JourneyModal product={journey} onClose={() => setJourney(null)} />}
      {note && (
        <Modal title={note.title} onClose={() => setNote(null)}>
          <div className="status-box"><Ic n="check" /><p>{note.text}</p></div>
        </Modal>
      )}
    </div>
  )
}
