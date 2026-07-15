# Synapse Adaptive — Setup (plain-English, beginner friendly)

The app runs with **zero setup** first (your data stays on your device, and the
AI uses a safe built-in fallback). Everything below is optional and turns on one
feature at a time. Do them in any order.

## 0) Run it (always do this first)
1. Open this folder in VS Code.
2. Open the terminal (Terminal → New Terminal) and run:
   - `npm install`   (installs everything, ~1 min)
   - `npm run dev`
3. Open http://localhost:3000. Click around: Login → Continue on this device →
   onboarding → do a check-in → see the dashboard → open the **Agent**.

Your secret keys go in a file named **.env.local** (copy `.env.example` and
rename the copy to `.env.local`). After editing it, stop the app (Ctrl+C) and
`npm run dev` again.

## 1) Turn on the real AI brain — Google Gemini (FREE)
1. Go to **https://aistudio.google.com/apikey** and sign in with Google.
2. Click **Create API key** → copy it.
3. In `.env.local`, paste it after `GEMINI_API_KEY=`.
4. Restart. The Agent and insights are now powered by Gemini. (No credit card —
   Gemini has a genuinely free tier.)

## 2) Turn on Google sign-in + cloud save — Supabase (FREE)
1. Go to **https://supabase.com** → sign in → **New project** (pick any name +
   a database password you save somewhere).
2. When it finishes, open **Project Settings → API**. Copy:
   - **Project URL** → paste into `NEXT_PUBLIC_SUPABASE_URL=`
   - **anon public** key → paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
3. Set up Google as a login option:
   a. Go to **https://console.cloud.google.com** → create a project (top bar).
   b. Search "**OAuth consent screen**" → choose **External** → fill app name +
      your email → Save (you can skip the optional bits).
   c. Search "**Credentials**" → **Create credentials → OAuth client ID** →
      type **Web application**.
   d. Under **Authorized redirect URIs**, add the callback URL Supabase shows you:
      in Supabase go to **Authentication → Providers → Google**; it displays a
      "Redirect URL" like `https://<your-project>.supabase.co/auth/v1/callback`.
      Paste that into Google, click **Create**.
   e. Google gives you a **Client ID** and **Client secret**. Copy both back into
      Supabase's **Google** provider box and click **Save / Enable**.
4. Restart the app. The Login screen's "Continue with Google" now works, and
   Settings shows your account.

## 3) (Later) Payments — Stripe, and emails — Resend
Only when you're ready to charge for Pro ($10/month). Steps are in `README.md`
under "Billing" and "Going live". You can ignore these to start.

## Notes
- You already had an old `.env` in this folder. It's safe, but it was for the old
  version. Use `.env.local` with the new variable names above (the app reads that).
- Nothing here ever requires a paid API. Gemini + Supabase free tiers cover it.
