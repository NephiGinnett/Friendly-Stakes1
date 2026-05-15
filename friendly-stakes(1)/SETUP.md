# Friendly Stakes - Setup Guide

A fun point-wagering app for your friend group. Bet on local events, accept or counter-offer odds, and vote to settle wagers.

---

## Quick Start (Local)

You'll need **Node.js** (v18+) installed. Open your terminal and run these commands.

> **No GitHub required for local setup!** GitHub/deployment is only needed when you want your friends to access it online. For running it on your own computer, just follow the steps below.

### 1. Get the project files onto your computer

Download or clone the workspace, then open your terminal and navigate into the project folder:

```bash
cd path/to/team/friendly-stakes
```

For example, if you downloaded the workspace to your Downloads folder:

```bash
cd ~/Downloads/team/friendly-stakes
```

### 2. Install everything and set up the database

```bash
npm run setup
```

This single command: installs all packages, generates the database client, creates the SQLite database file, and seeds it with your admin account. Takes about a minute.

### 3. Start the app

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. That's it!

### 4. Log in as admin

- **Username:** `zoe`
- **PIN:** `0000`

> Change your PIN after first login — just ask Momo to add a "Change PIN" feature when you're ready!

---

## How It Works

### Roles
- **Admin** (that's you, Zoe): Can settle wagers by override, adjust anyone's point balance, and close wagers early
- **Regular users**: Can create wagers, accept/counter, and vote on outcomes

### Wager Flow

1. **Create** — Set an event, your prediction, your stake, and a deadline
2. **Accept or Counter** — Others can accept at their own stake, or suggest different stakes
3. **Vote** — When the deadline hits (or someone closes early), everyone votes on who won
4. **Settle** — Auto-settles with 2+ votes and a majority, or admin overrides anytime

### Points
- Everyone starts with **1,000 points**
- Points are deducted when you create or accept a wager (held in escrow)
- Winner gets the entire pool (both stakes)
- Admin can top up anyone's balance from the Admin panel

---

## For Your Friends

Share this link when deployed (or your local IP if on the same network):
1. They go to the site
2. Click "Create account"
3. Pick a username + 2-4 digit PIN
4. They're in with 1,000 points!

---

## Deploying Online

Since your friends need to access this away from home, you'll want to deploy it. Here's the simplest path:

### Option A: Railway (recommended for SQLite)

Railway needs two things to work correctly: a **Volume** (so your database isn't wiped on redeploy) and a **DATABASE_URL** env variable pointing to it.

**Step 1 — Add a Volume for persistent storage**
1. In your Railway project dashboard, click your service
2. Go to **Settings** → **Volumes** → **Add Volume**
3. Set the mount path to `/data`
4. Save

**Step 2 — Set the DATABASE_URL environment variable**
1. Go to your service → **Variables**
2. Add a new variable:
   - Key: `DATABASE_URL`
   - Value: `file:/data/prod.db`
3. Save (Railway will redeploy automatically)

**Step 3 — Redeploy**
After setting the variable, Railway will rebuild and deploy. The build now automatically:
- Generates the Prisma client
- Creates the database
- Seeds your admin account (`zoe` / `0000`)

Your public URL will work as soon as the deploy finishes!

### Option B: Vercel + Hosted Database

Vercel doesn't support SQLite in production (serverless = no persistent file storage). If you prefer Vercel:

1. Sign up at [neon.tech](https://neon.tech) (free tier, PostgreSQL)
2. Create a database and copy the connection string
3. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`
4. Set `DATABASE_URL` to your Neon connection string
5. Deploy to Vercel and set the env var there too

I can help you with either option when you're ready!

---

## Useful Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run db:seed` | Re-run the seed (creates admin account) |
| `npm run db:studio` | Open Prisma Studio (visual database browser) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
