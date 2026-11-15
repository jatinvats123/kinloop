# Deploying Kinloop

Production runs on **Vercel (Hobby)** with **Firestore in a free Firebase Spark project**. A GitHub
Actions schedule calls the cron endpoint every five minutes. No Google Cloud billing is required.

## 1. Firebase (Firestore)

1. https://console.firebase.google.com → **Create a project** → name it → turn Google Analytics off → **Create project**.
2. **Build → Firestore Database → Create database** → Standard edition → location **asia-south1 (Mumbai)** → **Start in production mode** → **Create**.
   Production-mode security rules deny all client access; Kinloop only talks to Firestore from the server.
3. **Project settings → Service accounts → Generate new private key**. Keep the JSON file outside the repository.
4. Encode it for the `FIREBASE_SERVICE_ACCOUNT` variable without printing it:

   ```bash
   node scripts/encode-service-account.mjs /path/to/key.json
   ```

   This writes `FIREBASE_SERVICE_ACCOUNT=<base64>` into `.env.local` (gitignored).

## 2. Vercel

1. Sign in at https://vercel.com with GitHub, then **Add New → Project → Import** this repository (framework: Next.js).
2. Add these **Environment Variables** (Production): `DATA_BACKEND=firestore`, `FIREBASE_SERVICE_ACCOUNT`,
   `SESSION_SECRET`, `LINK_SECRET`, `CRON_SECRET` (32+ random bytes each), `APP_URL` (the deployment URL),
   `GEMINI_API_KEY`, `GEMINI_MODEL`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
   Or from a terminal: `npx vercel env add NAME production` (the value is read from stdin, never echoed).
3. Deploy. Functions run in `bom1` (Mumbai), next to Firestore (`vercel.json`).

## 3. Scheduler (GitHub Actions)

`.github/workflows/cron.yml` runs every five minutes and calls `POST /api/cron/tick` with the
`x-cron-secret` header. Set, in the repository settings:

- **Variable** `APP_URL` = the Vercel URL
- **Secret** `CRON_SECRET` = the same value as the Vercel env var

```bash
gh variable set APP_URL --body "https://<your-app>.vercel.app"
gh secret set CRON_SECRET < secret.txt
```

GitHub's scheduler can start late or skip runs under load. The tick is **window-based and idempotent**:
each run handles everything due since the last one, and repeating a run never repeats work.

## Later: Cloud Run (container path)

The repository ships a multi-stage, non-root `Dockerfile` (Next.js standalone output, port 8080) and
a `/api/health` endpoint, so the same app runs on Cloud Run once billing is available:

```bash
gcloud run deploy kinloop --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars DATA_BACKEND=firestore,APP_URL=https://... \
  --set-secrets SESSION_SECRET=session-secret:latest,LINK_SECRET=link-secret:latest,CRON_SECRET=cron-secret:latest,FIREBASE_SERVICE_ACCOUNT=firebase-sa:latest
```
