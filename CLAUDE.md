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
