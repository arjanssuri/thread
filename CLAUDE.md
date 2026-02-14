# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**thread** — a reimagined shopping experience built on semantic search and 3D visualization. Users search for products (e.g., "jeans") and explore results as an interactive 3D force-directed graph of clusters and items. Users can filter, scroll, and navigate within the graph. After finding items, they can visualize outfits on themselves using Three.js and Sora. An AI shopping agent can be spun up with user preferences to autonomously shop on their behalf.

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Package Manager:** pnpm
- **Database & Auth:** Supabase (Postgres + pgvector for semantic search, Auth, Edge Functions)
- **3D Visualization:** Three.js / React Three Fiber (R3F) for graph visualization and outfit rendering
- **AI/ML:** OpenAI embeddings for semantic search, Sora for outfit try-on generation
- **Styling:** TBD (Tailwind CSS recommended)

## Common Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript compiler check (tsc --noEmit)
```

## Architecture

### Core Features

1. **Semantic Search** — Product queries are embedded via OpenAI and matched against pgvector embeddings in Supabase. Results are clustered by similarity.
2. **3D Graph Visualization** — Search results render as a force-directed graph using React Three Fiber. Clusters group related products; nodes are interactive and filterable.
3. **Outfit Visualization** — Selected items are composed into an outfit preview using Three.js. Sora generates a try-on image/video of the user wearing the outfit.
4. **AI Shopping Agent** — Users provide preferences (style, budget, sizing) and an autonomous agent browses, filters, and recommends products on their behalf.

### Planned Directory Structure

```
src/
├── app/                  # Next.js App Router pages and layouts
│   ├── (auth)/           # Auth-related routes (login, signup)
│   ├── search/           # Search results + graph view
│   ├── outfit/           # Outfit visualization / try-on
│   ├── agent/            # AI shopping agent dashboard
│   └── api/              # API route handlers
├── components/
│   ├── graph/            # 3D graph components (R3F Canvas, nodes, edges, clusters)
│   ├── outfit/           # Three.js outfit viewer, Sora try-on
│   ├── agent/            # Agent UI (preferences form, activity feed)
│   └── ui/               # Shared UI primitives
├── lib/
│   ├── supabase/         # Supabase client, server client, middleware helpers
│   ├── embeddings/       # OpenAI embedding generation and vector search
│   ├── agent/            # AI agent logic (tool definitions, preference engine)
│   └── utils/            # Shared utilities
├── types/                # Shared TypeScript types and interfaces
└── hooks/                # Custom React hooks
```

### Key Integration Points

- **Supabase client** should be initialized per-request on the server (using `createServerClient`) and as a singleton on the client (using `createBrowserClient`). Use middleware for auth session refresh.
- **pgvector** column on the products table stores embeddings. Semantic search uses Supabase RPC to call a similarity search function.
- **React Three Fiber** components must be dynamically imported with `next/dynamic` and `ssr: false` since Three.js requires the DOM.
- **Sora API** calls should go through server-side API routes to protect API keys.

## Conventions

- Use Next.js App Router patterns: server components by default, `"use client"` only when needed (interactivity, hooks, browser APIs).
- Colocate route-specific components inside their `app/` route folder. Shared components go in `src/components/`.
- Supabase types should be auto-generated with `supabase gen types typescript` and stored in `types/supabase.ts`.
- Environment variables: prefix client-exposed vars with `NEXT_PUBLIC_`. Keep Supabase service role key, OpenAI key, and Sora key server-side only.

## Development Plan

Phased plan to ship **thread** from zero to full feature set. Complete phases in order; each phase should be testable before moving on.

### Phase 1 — Foundation

- [X] **Scaffold** — Next.js (App Router) + TypeScript + pnpm. Add Tailwind CSS. Create `src/` layout per planned directory structure (empty folders + root layout).
- [X] **Supabase** — Create project, enable Auth and Database. Add `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Implement `lib/supabase/` (server client, browser client, middleware for session refresh).
- [X] **Auth** — `app/(auth)/login` and `app/(auth)/signup` with Supabase Auth. Protected layout or middleware for authenticated routes. Basic nav (home, search, login/logout).
- [X] **Types** — Run `supabase gen types typescript`, save to `types/supabase.ts`. Add shared types in `types/` for product, cluster, etc. as needed.

### Phase 2 — Data & Semantic Search

- [ ] **Schema** — Products table: id, name, description, image_url, price, category, metadata (JSONB). Enable pgvector extension; add `embedding vector(1536)` (or chosen dimension). Index for similarity search.
- [ ] **Search RPC** — Supabase RPC (e.g. `match_products`) that takes a query embedding and returns products by cosine similarity (limit + optional filters).
- [ ] **Embeddings** — `lib/embeddings/`: function to get OpenAI embedding for a string; optional batch helper for backfill. Server-only.
- [ ] **Seed data** — Migration or script to insert sample products. Backfill embeddings for all products (one-time or trigger).
- [ ] **Search API** — `app/api/search/route.ts`: accept query text → get embedding → call RPC → return products. Optional: cluster results by category or similarity in API or client.
- [ ] **Search page (basic)** — `app/search/`: search input, call API, display results as a simple list/cards (no 3D yet). Validates end-to-end search.

### Phase 3 — 3D Graph Visualization

- [ ] **R3F setup** — Install `@react-three/fiber`, `@react-three/drei`, `three`. Create `components/graph/` with a Canvas wrapper; load via `next/dynamic` with `ssr: false`.
- [ ] **Graph data model** — From search API (or client), build nodes (products and/or cluster centroids) and edges (similarity or category links). Define types in `types/`.
- [ ] **Force-directed layout** — Implement or integrate a force simulation (e.g. `d3-force` in a worker or R3F-friendly physics) to compute positions for nodes. Pass positions into R3F.
- [ ] **Render graph** — Nodes as meshes/sprites with labels or thumbnails; edges as lines. Camera controls (orbit/pan/zoom) via `@react-three/drei`. Click node → show product detail or add to outfit.
- [ ] **Filters** — Filter state (category, price range) in search page; refetch or filter search results and regenerate graph. Ensure URL or state stays in sync for shareable links.
- [ ] **Integration** — Search page uses graph as primary view; list view optional. Loading and error states.

### Phase 4 — Outfit Visualization & Try-On

- [ ] **Outfit state** — Allow “add to outfit” from graph or product detail. Persist selected product IDs in state or DB (e.g. `outfit_items` table or session). `app/outfit/` page reads selected items.
- [ ] **Outfit preview** — Three.js scene in `components/outfit/`: place product images or simple meshes in a basic layout (mannequin or flat). No Sora yet; focus on composition and UX.
- [ ] **Sora API route** — `app/api/try-on/route.ts`: accept user image + outfit/product context; call Sora API (or current try-on endpoint); return generated image/video URL. Keep API key server-side.
- [ ] **Try-on UI** — On outfit page: upload or capture photo, trigger try-on, show loading then result. Handle errors and rate limits.

### Phase 5 — AI Shopping Agent

- [ ] **Agent data** — Tables or columns for user preferences: style, budget, sizing, constraints. Link to auth user. `lib/agent/`: load/save preferences, type definitions.
- [ ] **Agent tools** — Define tools (e.g. search_products, filter_by_price, add_recommendation). Implement tool handlers that use existing search API and DB.
- [ ] **Agent loop** — Server-side agent (e.g. OpenAI Assistants API or chat completions with function calling): read preferences, call tools, iterate until recommendations are ready. Store recommendations and activity log.
- [ ] **Agent API** — `app/api/agent/route.ts` or similar: start/run agent, return recommendations or stream progress. Authenticated only.
- [ ] **Agent UI** — `app/agent/`: form for preferences, “Start agent” action, activity feed (searches, filters, recommendations). Accept/reject recommendations and optionally add to outfit or cart.

### Phase 6 — Polish & Launch

- [ ] **Errors & loading** — Consistent error boundaries, API error responses, and loading skeletons across search, outfit, and agent.
- [ ] **Responsive & a11y** — Layout and 3D canvas usable on smaller screens; keyboard and screen reader basics for critical flows.
- [ ] **Performance** — Lazy load 3D and heavy components; optimize images; ensure embedding and RPC usage is efficient (indexes, limits).
- [ ] **Docs & deploy** — README with setup and env vars. Deploy (e.g. Vercel) with Supabase production project; configure env and auth redirect URLs.
