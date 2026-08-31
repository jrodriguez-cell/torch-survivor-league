# 🔥 Torch — Fantasy Survivor League

A fantasy Survivor league **and** weekly pick'em for you and your friends.
Built with Next.js 14 + Supabase (Postgres, auth, row-level security).

This is a **standalone side project**. It lives in its own folder and shares
nothing with the surrounding repo — see [Moving this to its own repo](#moving-this-to-its-own-repo).

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

### 5. Deploy (when you're ready to share)

1. Push this to a Git repo (see below) and import it on <https://vercel.com>.
2. In Vercel, set the three `NEXT_PUBLIC_*` env vars (use your real deployed URL
   for `NEXT_PUBLIC_SITE_URL`).
3. Add the deployed URL to Supabase **Redirect URLs**.
4. Share the app link + your league's invite code with your friends.

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
