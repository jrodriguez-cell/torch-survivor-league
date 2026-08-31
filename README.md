# 🔥 Torch — Fantasy Survivor League

A fantasy Survivor league **and** weekly pick'em for you and your friends.
Built with Next.js 14 + Supabase (Postgres, auth, row-level security).

**Deploy:** import this repo at **[vercel.com/new](https://vercel.com/new)** as a
new project (recommended — no duplicate repo), or use the one-click
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjrodriguez-cell%2Ftorch-survivor-league&project-name=torch-survivor-league&repository-name=torch-survivor-league&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_SITE_URL&envDescription=Supabase%20URL%20%2B%20anon%20key%2C%20and%20your%20app%27s%20public%20URL)
button (note: the button makes its own copy of the repo). Full steps in
[Deploy to Vercel](#5-deploy-to-vercel-when-youre-ready-to-share).

> Set up your Supabase project **first** (steps below) so you have the two keys
> ready when Vercel asks for them.

This is a **standalone project** — its own repo, its own Vercel project. It
shares nothing with, and cannot affect, any other app or website.

## What it does

- **Leagues** — create a league, get a 6-character invite code, friends join with it.
- **Fantasy** — the commissioner adds the season's castaways; each member drafts a
  team. Members earn all the fantasy points their castaways rack up each week.
- **Weekly pick'em** — the commissioner posts prediction questions per episode
  (who's voted out, who wins immunity, etc.); members submit picks before the
  episode airs; picks lock automatically and score once results are entered.
- **Two leaderboards + a combined one** — fantasy points, pick'em points, and total.
- **Commissioner tools** — manage castaways, weeks, scoring, and questions.
- **Logins** — passwordless magic-link email sign-in. Everyone sees shared,
  live data. Row-level security keeps each league private to its members.

## Tech stack

| Piece        | Choice                                  |
| ------------ | --------------------------------------- |
| Framework    | Next.js 14 (App Router) + TypeScript    |
| Styling      | Tailwind CSS                            |
| Database     | Supabase Postgres                       |
| Auth         | Supabase Auth (email magic link)        |
| Hosting      | Vercel (recommended) + Supabase (free)  |

---

## Setup (about 15 minutes)

### 1. Create a Supabase project

1. Go to <https://supabase.com>, create a free account and a **New project**.
2. Once it's ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

### 2. Create the database schema

1. In Supabase, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates all tables, security policies, and the leaderboard views.

### 3. Configure the app

```bash
cd survivor-league
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, click **Get started**, enter your email, and click
the magic link. You're in.

> **Magic-link redirect note:** in Supabase go to **Authentication → URL
> Configuration** and add your site URL (e.g. `http://localhost:3000` and later
> your Vercel URL) to **Redirect URLs**, so the sign-in links are trusted.

### 5. Deploy to Vercel (when you're ready to share)

The **[Deploy with Vercel](#-torch--fantasy-survivor-league)** button at the top
imports this repo as a **brand-new, isolated Vercel project** — it will not
touch any existing project, domain, or environment on your account. During the
flow Vercel asks for the three environment variables:

| Variable                        | Value                                             |
| ------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | your Supabase project URL                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key                      |
| `NEXT_PUBLIC_SITE_URL`          | leave blank for now, then update it (see step 3)   |

Prefer to import manually? Go to **<https://vercel.com/new>**, pick
`torch-survivor-league`, keep the defaults (Next.js is auto-detected), add the
env vars above, and **Deploy**. Either way it lands as its own project.

**After the first deploy:**

1. Copy your new production URL (e.g. `https://torch-survivor-league.vercel.app`).
2. In Vercel → your project → **Settings → Environment Variables**, set
   `NEXT_PUBLIC_SITE_URL` to that URL, then **redeploy** (Deployments → ⋯ →
   Redeploy) so magic-link emails point to the right place.
3. In Supabase → **Authentication → URL Configuration**, add that same URL to
   **Redirect URLs** (keep `http://localhost:3000` there too for local dev).
4. Share the app link + your league's invite code with your friends. 🔥

**Keeping it isolated from your other apps:**

- It's a separate Git repo, so Vercel treats it as a separate project with its
  own `*.vercel.app` domain — no collision with existing domains.
- Environment variables are per-project; these Supabase keys live only here.
- Use a **separate Supabase project** for it too (don't reuse a business one),
  so its database and users are fully independent.

---

## How a season runs

1. **You (commissioner)** create a league and share the invite code.
2. Friends sign in and **join** with the code.
3. You add the season's **castaways** under **Commissioner → Castaways**.
4. Everyone drafts their **team** under **My Team**.
5. Each week: add a **Week/Episode**, set a **picks-lock** time, and add
   **pick'em questions**.
6. Friends submit **picks** before lock.
7. After the episode: enter **fantasy scoring** for castaways, set the **correct
   answers** for pick'em questions, then **Mark week scored**. Standings update
   instantly.

Fantasy scoring uses a sensible default template (immunity win, made merge,
found idol, voted out, etc.) that you can adjust per entry — see
`lib/types.ts → DEFAULT_SCORING`.

---

## Moving this to its own repo

This folder is fully self-contained. To give it its own brand-new GitHub repo:

```bash
# from the survivor-league/ folder
./scripts/extract-to-new-repo.sh ~/torch-survivor
cd ~/torch-survivor
# create an empty repo on GitHub first, then:
git remote add origin git@github.com:YOUR_USERNAME/torch.git
git push -u origin main
```

That copies just this app into a fresh directory, initializes a new Git repo,
and makes the first commit — completely separate from any other project.

---

## Project structure

```
survivor-league/
├── app/
│   ├── page.tsx                     # landing page
│   ├── login/                       # magic-link sign in
│   ├── auth/                        # callback + sign-out/profile actions
│   ├── dashboard/                   # your leagues; create/join
│   └── leagues/[id]/
│       ├── layout.tsx               # league shell + tabs
│       ├── page.tsx                 # standings (fantasy + pick'em + combined)
│       ├── roster/                  # draft your team
│       ├── pickem/                  # weekly picks
│       └── admin/                   # commissioner tools
│           └── episodes/[episodeId] # per-week scoring + questions
├── components/                      # UI + client components
├── lib/
│   ├── supabase/                    # browser/server/middleware clients
│   ├── league.ts                    # league loader + role guard
│   └── types.ts                     # shared types + scoring template
├── supabase/schema.sql              # run this once in Supabase
└── middleware.ts                    # auth session refresh + route guard
```

## Ideas for later

- Draft with no duplicate castaways across teams (snake draft).
- Auto-award "survived" points to everyone still in each week.
- Email/text reminders before picks lock.
- Per-league custom scoring rules stored in the DB.
- A season-long chart of standings over time.
