# Firebase setup (project: askus-insurance)

Console: https://console.firebase.google.com/project/askus-insurance/overview

1. **Add a Web app** → Project settings → Your apps → `</>`. Copy the config values into `.env.local`
   (`VITE_FIREBASE_API_KEY`, `..._MESSAGING_SENDER_ID`, `..._APP_ID`).
2. **Authentication** → Get started → Sign-in method → enable **Phone** and **Google** (set a support email for Google).
   - Phone → "Phone numbers for testing": add e.g. `+91 98765 43210` with code `123456` to test without sending real SMS.
   - Real SMS beyond the free quota needs the Blaze plan; also set an SMS region policy allowing India.
   - Settings → Authorized domains: add your live domain (localhost is there by default).
   - Login rule: phone OTP is the primary login. Google sign-in is allowed, but the user must then verify a mobile number
     (the phone gets linked to the same account) before they count as signed in. Email login can be added later.
3. **Firestore Database** → Create database (production mode, region `asia-south1`).
4. **Storage:** not used. Documents go to Cloudinary (see below).
5. Deploy rules:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use askus-insurance
   firebase deploy --only firestore:rules,firestore:indexes
   ```
6. Run locally with uploads working: terminal 1 `npm run dev`, terminal 2 `npm run dev:api`, then open http://localhost:8788
   (the Pages Functions proxy in front of Vite). Plain http://localhost:5173 works for everything except uploads.
7. Deploy on **Cloudflare Pages**: build `npm run build`, output `dist`. Add the `VITE_*` vars (build) and these secrets (runtime):
   `FIREBASE_PROJECT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   Locally these live in `.dev.vars` (gitignored).

## Data model
- `users/{uid}` – name, email, mobile (created at sign-up)
- `users/{uid}/saved/{id}` – saved comparisons (next step)
- `documentRequests/{id}` – uid, name, mobile, type, files[], status (`new`), createdAt
- Files: Cloudinary, private (`authenticated`) assets at `insurance/{uid}/{requestId}/doc_{n}.{ext}`, signed by `functions/api/documents/sign.ts`.
  Only phone-verified users can get an upload signature. Staff view them in the Cloudinary Media Library.

Staff read `documentRequests` in the Firebase console (or via an admin page / Cloud Function later).

## Cloudflare Pages env (local files are gitignored, never commit them)
- `cloudflare-pages.env`: plain variables (VITE_* + Cloudinary name/key + FIREBASE_PROJECT_ID). Add each under
  Settings > Variables and Secrets (Production + Preview).
- `cloudflare-pages.secrets.json`: only `CLOUDINARY_API_SECRET`. Upload once the Pages project exists:
  `npx wrangler pages secret bulk cloudflare-pages.secrets.json --project-name <your-pages-project>`
- Rebuild after changing any VITE_* variable (they are baked in at build time).
