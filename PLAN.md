# Family Tree App — Implementation Plan

A roadmap.sh-style interactive family tree: starts at the great-great-grandparents
(generation 0) and renders down through 7 generations to the great-grandchildren.
Anyone can view the tree; family members register, attach themselves under their
parents, and their additions are approved by a tree admin.

---

## 1. Product requirements

### Must have (MVP)
- Public read-only view of the whole tree, roadmap.sh style (pan/zoom, click to expand)
- 7 generations: great-great-grandparents → great-grandchildren (gen 0..gen 6)
- Each person has: name (first/last/maiden), gender, birth/death dates & places, photo, bio
- Real genealogy structure: every person can have **two parents** (father + mother)
- Self-registration (email + password); members claim a person node in the tree
- "Add a child to a parent" flow: member submits, tree admin approves before it's public
- Admin moderation queue (approve / reject / edit pending entries)

### Nice to have (later phases)
- Search by name
- Expand/collapse branches on demand (7 generations is too big to render at once)
- GEDCOM export (and later import)
- Email notifications for approvals (Resend)
- Privacy toggles for living members (hide birth dates / full name)
- Photo uploads, marriage/divorce events, notes & sources

---

## 2. Recommended stack

| Layer      | Choice                                                       | Why |
|------------|--------------------------------------------------------------|-----|
| Framework  | Next.js (App Router) + TypeScript                            | Full-stack React, API routes + server components in one deploy |
| Styling    | Tailwind CSS                                                 | Fast iteration on the tree UI |
| Database   | **Supabase (PostgreSQL)**                                    | Postgres with recursive CTE support (needed for tree queries), generous free tier |
| ORM        | Prisma                                                       | Type-safe schema & migrations; use raw SQL for recursive tree queries |
| Auth       | **Supabase Auth** (email/password)                           | Built-in sign-up/sign-in UI + sessions, zero auth code to maintain |
| Storage    | Supabase Storage                                             | Person photos, same account as DB |
| Tree UI    | **React Flow (xyflow)**                                      | Interactive pan/zoom node graph — the same approach roadmap.sh uses |
| Deploy     | Vercel                                                       | Free tier, one-command Next.js deploy |

**Alternative:** if you prefer self-hosted auth, swap Supabase Auth for
[Auth.js (NextAuth)](https://authjs.dev) with the credentials provider, and use
Neon (plain Postgres) instead of Supabase. Supabase is recommended because it
covers database + auth + photo storage with one free account and less code.

---

## 3. Data model

### `people` — one row per person
```prisma
model Person {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String
  maidenName  String?
  gender      Gender?          // MALE | FEMALE | OTHER
  birthDate   DateTime?
  birthPlace  String?
  deathDate   DateTime?
  deathPlace  String?
  photoUrl    String?
  bio         String?
  isLiving    Boolean  @default(true)
  status      Status   @default(PENDING)  // PENDING | APPROVED | REJECTED
  createdBy   String?           // user id of the submitter
  createdAt   DateTime @default(now())

  // relationships defined in PersonParent table
  parents     PersonParent[]    @relation("child")
  children    PersonParent[]    @relation("parent")
}
```

### `person_parents` — parent ↔ child links (the tree itself)
```prisma
model PersonParent {
  id         String   @id @default(cuid())
  childId    String
  parentId   String
  role       ParentRole @default(PARENT)  // FATHER | MOTHER | PARENT | GUARDIAN
  child      Person   @relation("child", fields: [childId], references: [id])
  parent     Person   @relation("parent", fields: [parentId], references: [id])

  @@unique([childId, parentId])
}
```

**Why a join table instead of `fatherId`/`motherId` columns:** it handles
half-siblings, unknown parents (only one known), adoption/guardianship roles, and
keeps the graph clean. The whole tree is a **directed acyclic graph** — each node
has ≤ 2 parents and any number of children.

### `profiles` — links a login account to their person node
```prisma
model Profile {
  id       String @id @default(cuid())
  userId   String @unique   // Supabase Auth user id
  personId String @unique   // which Person this account represents
  role     Role   @default(MEMBER)  // ADMIN | MEMBER
}
```

### `pending_edits` — moderation queue
When a member adds a new person, it's created with `status = PENDING` **plus** a
row here so the admin can review and approve:
```prisma
model PendingEdit {
  id          String   @id @default(cuid())
  personId    String
  requestType String   // ADD_PERSON | ADD_CHILD_LINK | EDIT_PERSON
  submittedBy String
  submittedAt DateTime @default(now())
  reviewedBy  String?
  reviewedAt  DateTime?
  decision    String?  // APPROVED | REJECTED
  adminNote   String?
}
```

**Approval flow:** the new person exists in the DB as a "ghost node" (rendered
dashed in the tree) until approved → atomically flip `status` to `APPROVED`.
Rejected rows are soft-deleted (`deletedAt`) so we keep an audit trail.

---

## 4. Tree rendering (the hard part)

roadmap.sh renders a nested tree; a real family tree is a **layered graph**:

```
Gen 0  [Great-Great-Grandpa]──[Great-Great-Grandma]
Gen 1        [Grandpa]──[Grandma]         [Aunt]
Gen 2             [Dad]──[Mom]        [Cousin]
Gen 3               [You]  [Sibling]
```

### Layout algorithm
1. Compute each person's **generation** (distance from the root generation).
2. Render generations as horizontal rows, oldest at top.
3. Within a row, position a person's subtree so children center under their
   parents with no overlap — classic **tidy tree layout** (Reingold–Tilford
   adapted for two-parent nodes). Couples render side-by-side as one unit.
4. Connect with orthogonal elbow edges (parent row → child row).

### Using React Flow (xyflow)
- Nodes = person cards, edges = parent→child links. Pan/zoom and dragging come free.
- **Never render all 7 generations at once.** On first load, fetch only the root
  generation + 1 level; clicking a person expands their subtree on demand
  (lazy-load via API, `addNodes`).
- Render with `fitView` and viewport-based culling for large trees.

### Data fetching — recursive CTE
Fetch a person's whole subtree with one Postgres query:

```sql
WITH RECURSIVE subtree AS (
  SELECT * FROM people WHERE id = $1
  UNION ALL
  SELECT p.* FROM people p
  JOIN person_parents pp ON pp.child_id = p.id
  JOIN subtree s ON pp.parent_id = s.id
)
SELECT * FROM subtree;
```

(Add a `depth` limit and a `MAX_ANCESTOR` guard so a data bug can't loop forever.)

---

## 5. Core user flows

### A. View the tree (public)
1. Visit home → tree renders from the great-great-grandparents down.
2. Pan/zoom; click a card → profile drawer (bio, dates, photo, children).
3. Click "expand" on a person → lazy-load their descendants.

### B. Register & claim yourself
1. Sign up with email/password (Supabase Auth).
2. Search for your parents in the tree → select them.
3. Submit "this is me" with your details → creates a `PENDING` person + link
   to your parents. Admin approves; your account is now bound to that node.

### C. Member adds a child to a parent
1. Logged-in member opens a person card → "Add child".
2. Enters the child's details (name, dates, gender, photo).
3. New person created as `PENDING` with a parent link → shows dashed in tree.
4. Admin approves in the moderation queue → goes live.

### D. Admin moderation
1. Admin dashboard lists pending edits with a side-by-side diff.
2. Approve → `status = APPROVED`. Reject → soft delete with a note.

---

## 6. API surface (Next.js route handlers)

| Method | Route                          | Auth   | Purpose |
|--------|--------------------------------|--------|---------|
| GET    | `/api/tree?rootId=&depth=`     | public | Subtree via recursive CTE |
| GET    | `/api/people/:id`              | public | Person detail + parents + children |
| POST   | `/api/people`                  | member | Create person (status=PENDING) |
| POST   | `/api/people/:id/parents`      | member | Link child to a parent (PENDING) |
| PATCH  | `/api/people/:id`              | member | Edit own node / propose edit (PENDING) |
| GET    | `/api/admin/pending`           | admin  | Moderation queue |
| POST   | `/api/admin/pending/:id`       | admin  | Approve / reject |
| POST   | `/api/profile/claim`           | member | Bind account to a person node |
| GET    | `/api/search?q=`               | public | Name search (later phase) |

All write endpoints validate:
- **Cycle prevention** — a person can never become their own ancestor
  (check with a recursive query before inserting a parent link).
- **Duplicate detection** — warn if first+last name + birth date already exist.
- **Ownership** — members can only edit their own node (admins edit anything).

---

## 7. Build phases (roadmap for the build itself)

### Phase 0 — Scaffold
- [ ] `create-next-app` (TypeScript, Tailwind, App Router)
- [ ] Supabase project + Prisma schema + first migration
- [ ] Supabase Auth wired up (sign up / sign in / session)
- [ ] Seed script: a fake 7-generation family (4–5 people per generation) for dev

### Phase 1 — Public read-only tree (the visual core) ✅
- [x] Person card component + generation-row layout algorithm (`src/lib/layout.ts` — couple-unit tidy tree)
- [x] React Flow canvas with pan/zoom + generation legend + minimap (`src/components/tree/TreeCanvas.tsx`)
- [x] `/api/tree` recursive CTE endpoint (supports `rootId` + `depth` for lazy loading later)
- [x] Profile drawer on card click (`src/components/tree/PersonDrawer.tsx`)
- [x] Milestone: the roadmap.sh-style tree renders from seed data (verified: 18 nodes, 21 edges, gens 0–6, no overlaps)

### Phase 2 — Auth + self-insert with approvals ✅
- [x] Registration / login pages (`/signup`, `/login`) + sign-out + auth-aware header
- [x] "Claim me" flow (`/claim` — search parents → submit self → PENDING) + `POST /api/claim`
- [x] "Add child" flow (`/add`, drawer button → `POST /api/people`) — members add *other* people through the same queue
- [x] Admin moderation queue + approve/reject (`/admin`, `/api/admin/pending`)
- [x] Milestone: a new member can add themselves and appear after approval (12/12 + 12/12 e2e tests pass)
- [x] PENDING ghost nodes: dashed + "pending approval" badge; visible to the submitter and admins only
- [ ] Future: claim-existing-person option

### Phase 3 — Member experience
- [x] Edit own profile — bio, birth/death dates & places, gender, maiden name, isLiving (`/profile`, `PATCH /api/people/:id`, direct apply to own node; names stay read-only)
- [ ] Photo upload (Supabase Storage) — deferred
- [x] Search — name search overlay on the tree, jump-to-person with fitView (`/api/search` + `PersonSearch`)
- [x] Expand/collapse branch controls (per-node toggle with +N badge, "expand all" control, search auto-expands ancestors); generation color-coding was done in Phase 1
- [x] Email notification to admins on new pending entry (Resend — `src/lib/email.ts`, fired from `/api/claim` + `/api/people`; safe no-op without `RESEND_API_KEY`)

### Phase 4 — Hardening & extras
- [ ] Cycle & duplicate validation hardening
- [ ] Privacy toggles for living members
- [ ] GEDCOM export
- [ ] Deploy to Vercel + custom domain

---

## 8. Open questions to decide before coding

1. **Unknown parents** — great-great-grandparents may be only partially known.
   Decision: allow single-parent nodes (e.g. only the grandmother known), render
   a "+ unknown" placeholder. Recommended: yes, allow it.
2. **Multiple partners** — a person remarrying means children with two different
   partners. The join-table model handles this automatically; the renderer shows
   both partner cards. Confirm you want this in the first version.
3. **Who is the admin?** Recommended: the person who creates the tree is admin
   and can promote other members.
4. **Photos of living people** — default to private (visible to members only) in
   Phase 3.

---

## 9. First concrete steps

1. Scaffold: `npx create-next-app@latest` (TypeScript + Tailwind + App Router).
2. Create a Supabase account → new project → grab the connection string.
3. Write the Prisma schema from §3 → `prisma migrate dev`.
4. Run the seed script, then build the Phase 1 renderer.

Setup links:
- Supabase: https://supabase.com/dashboard (free Postgres + auth + storage)
- Auth.js alternative: https://authjs.dev
