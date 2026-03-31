# Production Deployment Guide

This guide describes how to deploy the Aidevelo application across Cloudflare (UI), Render (API & Worker), and Supabase (Database).

## Architecture Overview

**1. Supabase (Database & Auth)**
Supabase provides the managed PostgreSQL database. It is the persistent storage layer.
*Migrations*: You can apply schema changes by running `pnpm db:migrate` against your production connection string. During deployment, the server runs with `AIDEVELO_MIGRATION_AUTO_APPLY=true` which will run your pending drizzle migrations on boot.

**2. Render (Backend API)**
Render hosts the Express API (`server/`) and any background workers.
*Configuration*: The repo contains `render.yaml`. This file defines the infrastructure. However, all sensitive keys (`sync: false`) **must be provided via the Render dashboard**.

**3. Cloudflare Pages (Frontend UI)**
Cloudflare Pages hosts the Vite React application (`ui/`).
*Configuration*: It builds the static assets and needs to know where the API is (`VITE_API_URL`).

---

## 1. Setting up Render

1. Log into your Render dashboard.
2. Connect this GitHub repository and select your Blueprint (`render.yaml`).
3. Render will create the `aidevelo-api` and `aidevelo-worker` services.
4. Because we've set `sync: false` for your secrets, the services will fail or pause until you input the environment variables.
5. Go to the **Environment** tab for `aidevelo-api` and add your production strings (which were previously in `render.yaml`):

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET
AUTH_SECRET
BETTER_AUTH_SECRET
RENDER_API_KEY
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_S3_ENDPOINT
ANTHROPIC_BASE_URL
ANTHROPIC_API_KEY
```

> [!TIP]
> Make sure `NODE_ENV` is set to `production` and `PORT` is `3000`.

## 2. Setting up Cloudflare Pages (Automatic Builds)

Since you selected **automatic builds** via GitHub integration:

1. Log into your Cloudflare dashboard.
2. Go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select this GitHub repository.
4. Set up the build configuration:
   - **Framework preset**: `Vite`
   - **Build command**: `pnpm --filter @aideveloai/ui build` (Or just `cd ui && pnpm build` depending on root path config. By default, Cloudflare Pages will execute the script if root is `.`)
   - **Build output directory**: `ui/dist`
5. **Set Environment Variables**:
   Under the Settings or during setup, expand the **Environment variables** section and enter the following for the Production environment:

```text
VITE_API_URL=https://api.aidevelo.ai
VITE_SUPABASE_URL=YOUR_SUPABASE_URL (e.g. https://ngyncmglvqnmdnpiaqjq.supabase.co)
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

6. Click **Save and Deploy**. Cloudflare will automatically build and deploy the UI on every push to your main branch.

## 3. What is Supabase doing?

> "and what is with supabase ???' do i need also ??"

**Yes, you need Supabase**. Supabase is the actual database server. The Render API connects to it using `DATABASE_URL` (the `postgresql://...` link you have). Without it, your application cannot store users, agents, companies, or conversations. 

You do not need to host or deploy any *code* directly to Supabase—Supabase is just securely storing your data. The API on Render communicates with it automatically if you've populated the environment variables in the Render dashboard.

## Next Step

1. Commit these changes to your GitHub branch.
2. Log into Render and Cloudflare, connect the repository, and supply your secret keys through their secure web dashboards.
