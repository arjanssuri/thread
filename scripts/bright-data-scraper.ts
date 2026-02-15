#!/usr/bin/env npx ts-node
/**
 * bright-data-scraper.ts
 *
 * Scrapes fashion product data from major e-commerce sites using Bright Data's
 * AI-powered web data platform and populates the Supabase products table.
 *
 * Bright Data products used:
 *   - Web Scraper API   – Pre-built e-commerce scrapers with structured output
 *   - Web Unlocker API  – Bypasses anti-bot, CAPTCHAs, and fingerprinting
 *   - SERP API          – Discovers trending products via Google Shopping results
 *   - Crawl API         – Turns fashion retailer catalogs into AI-ready datasets
 *
 * Workflow:
 *   1. Use SERP API to discover trending products for each category
 *   2. Trigger Web Scraper collection on target retailer sites
 *   3. Web Unlocker handles anti-bot bypassing automatically (CAPTCHAs, JS rendering)
 *   4. Poll until snapshot is ready, download structured results
 *   5. Normalize into our Product schema and upsert into Supabase
 *   6. Trigger Elasticsearch re-index so products are searchable (Jina embeddings)
 *
 * Usage:
 *   BRIGHT_DATA_API_TOKEN=<token> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx ts-node scripts/bright-data-scraper.ts [--category jeans] [--limit 200]
 *
 * Env vars:
 *   BRIGHT_DATA_API_TOKEN    – Bright Data API token (https://brightdata.com/cp/api_tokens)
 *   SUPABASE_URL             – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Supabase service role key (server-side writes)
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

// Bright Data API endpoints
const BD_DATASETS_API = "https://api.brightdata.com/datasets/v3";
const BD_SERP_API = "https://api.brightdata.com/serp/req";
const BD_DCA_API = "https://api.brightdata.com/dca";

// Dataset IDs — Bright Data provides 120+ pre-built scrapers; these are fashion-related
const BD_FASHION_DATASET_ID = "gd_l7q7dkf244hwjntr0"; // Fashion/apparel dataset
const BD_ECOMMERCE_DATASET_ID = "gd_l1viktl72bvl7bjuj0"; // General e-commerce products

const POLL_INTERVAL_MS = 15_000; // 15 seconds between status checks
const MAX_POLL_ATTEMPTS = 40; // ~10 minutes max wait

// Categories to scrape if none specified
const DEFAULT_CATEGORIES = [
  "jeans",
  "t-shirts",
  "hoodies",
  "sneakers",
  "dresses",
  "jackets",
  "bags",
  "shirts",
  "pants",
  "shoes",
  "accessories",
];

// Source retailer URLs — Web Unlocker auto-handles anti-bot on these
const SOURCE_URLS = [
  "https://www.zara.com/us/en/search?searchTerm={query}",
  "https://www.nordstrom.com/sr?keyword={query}",
  "https://www.asos.com/us/search/?q={query}",
  "https://www2.hm.com/en_us/search-results.html?q={query}",
  "https://www.uniqlo.com/us/en/search?q={query}",
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrightDataProduct {
  title?: string;
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  images?: string[];
  price?: number | string;
  currency?: string;
  brand?: string;
  category?: string;
  url?: string;
  rating?: number;
  reviews_count?: number;
  color?: string;
  sizes?: string[];
  material?: string;
  availability?: string;
}

interface SnapshotStatus {
  snapshot_id: string;
  status: "running" | "ready" | "failed";
  progress?: number;
  records_count?: number;
}

interface SupabaseProduct {
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  category: string | null;
  brand: string | null;
  source: string;
  metadata: Record<string, unknown>;
}

// ─── Bright Data API ─────────────────────────────────────────────────────────

const BD_TOKEN = process.env.BRIGHT_DATA_API_TOKEN;
if (!BD_TOKEN) {
  console.error("❌ BRIGHT_DATA_API_TOKEN is required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${BD_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── SERP API: Discover Trending Products ────────────────────────────────────

/**
 * Use Bright Data's SERP API to discover trending products on Google Shopping.
 * Returns additional product URLs to feed into the Web Scraper collection.
 * SERP API delivers real-time, structured search engine results with geo-targeting.
 */
async function discoverViaSERP(queries: string[]): Promise<string[]> {
  console.log(`\n🔍 Discovering products via Bright Data SERP API...`);
  const discoveredUrls: string[] = [];

  for (const query of queries) {
    try {
      const res = await fetch(BD_SERP_API, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `${query} fashion clothing`,
          search_engine: "google_shopping",
          country: "us",
          language: "en",
          pages: 2, // First 2 pages of Google Shopping results
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ url?: string; link?: string }>;
        };
        const urls = (data.results ?? [])
          .map((r) => r.url || r.link)
          .filter(Boolean) as string[];
        discoveredUrls.push(...urls);
        console.log(`   🔎 "${query}": found ${urls.length} product URLs`);
      }
    } catch (err) {
      console.warn(`   ⚠️  SERP query "${query}" failed:`, err);
    }
  }

  console.log(`   ✅ SERP discovery: ${discoveredUrls.length} total URLs`);
  return discoveredUrls;
}

// ─── Web Scraper API: Trigger Collection ─────────────────────────────────────

/**
 * Trigger a Bright Data Web Scraper dataset collection.
 *
 * Uses the /datasets/v3/trigger endpoint (documented at docs.brightdata.com).
 * Web Unlocker is built-in — handles CAPTCHAs, browser fingerprinting, JS
 * rendering, and proxy rotation from 150M+ IPs across 195 countries.
 *
 * The dataset scraper extracts structured product data (name, price, image,
 * brand, description, etc.) from each URL automatically.
 */
async function triggerCollection(
  queries: string[],
  extraUrls: string[] = []
): Promise<string> {
  console.log(`\n🚀 Triggering Bright Data Web Scraper collection...`);
  console.log(`   Queries: ${queries.join(", ")}`);

  // Build input URLs from queries × retailer sites
  const retailerInputs = queries.flatMap((query) =>
    SOURCE_URLS.map((tpl) => ({
      url: tpl.replace("{query}", encodeURIComponent(query)),
    }))
  );

  // Add SERP-discovered URLs
  const serpInputs = extraUrls.map((url) => ({ url }));

  const allInputs = [...retailerInputs, ...serpInputs];
  console.log(`   📋 ${retailerInputs.length} retailer URLs + ${serpInputs.length} SERP-discovered URLs`);

  // POST /datasets/v3/trigger — triggers async collection, returns snapshot_id
  const res = await fetch(
    `${BD_DATASETS_API}/trigger?dataset_id=${BD_FASHION_DATASET_ID}&include_errors=true`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(allInputs),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bright Data trigger failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { snapshot_id: string };
  console.log(`   ✅ Snapshot started: ${data.snapshot_id}`);
  return data.snapshot_id;
}

// ─── Snapshot Polling & Download ─────────────────────────────────────────────

/**
 * Poll Bright Data until the snapshot is ready.
 * GET /datasets/v3/snapshot/{id} returns 202 while running, 200 when ready.
 */
async function waitForSnapshot(snapshotId: string): Promise<void> {
  console.log(`\n⏳ Waiting for snapshot ${snapshotId}...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(
      `${BD_DATASETS_API}/snapshot/${snapshotId}?format=json`,
      { headers }
    );

    if (res.status === 202) {
      const status = (await res.json()) as SnapshotStatus;
      const pct = status.progress != null ? `${(status.progress * 100).toFixed(0)}%` : "...";
      process.stdout.write(`   ⏳ ${status.status} (${pct})\r`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (res.ok) {
      console.log(`\n   ✅ Snapshot ready!`);
      return;
    }

    throw new Error(`Snapshot poll failed (${res.status}): ${await res.text()}`);
  }

  throw new Error(`Snapshot timed out after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Download the completed snapshot data.
 * Returns structured product data automatically extracted by Bright Data's scraper.
 */
async function downloadSnapshot(snapshotId: string): Promise<BrightDataProduct[]> {
  console.log(`\n📥 Downloading snapshot data...`);

  const res = await fetch(
    `${BD_DATASETS_API}/snapshot/${snapshotId}?format=json`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as BrightDataProduct[];
  console.log(`   ✅ Downloaded ${data.length} raw products`);
  return data;
}

// ─── Data Normalization ──────────────────────────────────────────────────────

/**
 * Normalize a raw Bright Data product into our Supabase product schema.
 * Handles inconsistent field names across different scraped sites.
 */
function normalizeProduct(
  raw: BrightDataProduct,
  fallbackCategory: string
): SupabaseProduct | null {
  const name = (raw.title || raw.name || "").trim();
  if (!name) return null; // Skip products with no name

  // Resolve image URL (different sites use different field names)
  const imageUrl =
    raw.image_url ||
    raw.image ||
    (Array.isArray(raw.images) && raw.images.length > 0 ? raw.images[0] : null);

  // Parse price (can be number or string like "$29.99")
  let price: number | null = null;
  if (typeof raw.price === "number") {
    price = raw.price;
  } else if (typeof raw.price === "string") {
    const parsed = parseFloat(raw.price.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed)) price = parsed;
  }

  // Detect category from product data or fall back to search query category
  const category = inferCategory(raw.category || name, fallbackCategory);

  // Build rich metadata for the agent to learn from
  const metadata: Record<string, unknown> = {};
  if (raw.color) metadata.color = raw.color;
  if (raw.sizes) metadata.sizes = raw.sizes;
  if (raw.material) metadata.material = raw.material;
  if (raw.rating) metadata.rating = raw.rating;
  if (raw.reviews_count) metadata.reviews_count = raw.reviews_count;
  if (raw.availability) metadata.availability = raw.availability;
  if (raw.url) metadata.source_url = raw.url;

  // Enrich description with color/material if the original is sparse
  let description = raw.description || null;
  if (!description && (raw.color || raw.material)) {
    const parts: string[] = [];
    if (raw.color) parts.push(raw.color);
    if (raw.material) parts.push(raw.material);
    description = parts.join(", ") + ` ${name.toLowerCase()}`;
  }

  return {
    name,
    description,
    image_url: imageUrl || null,
    price,
    category,
    brand: raw.brand?.trim() || null,
    source: "bright_data",
    metadata,
  };
}

/** Map raw category strings to our canonical category values. */
function inferCategory(raw: string, fallback: string): string {
  const lower = raw.toLowerCase();
  const categoryMap: Record<string, string> = {
    jean: "pant",
    jeans: "pant",
    pants: "pant",
    trouser: "pant",
    shorts: "pant",
    "t-shirt": "top",
    tshirt: "top",
    shirt: "shirt",
    blouse: "shirt",
    hoodie: "top",
    sweatshirt: "top",
    sweater: "top",
    jacket: "jacket",
    coat: "jacket",
    blazer: "jacket",
    dress: "dress",
    skirt: "dress",
    sneaker: "shoe",
    shoe: "shoe",
    boot: "shoe",
    sandal: "shoe",
    bag: "bag",
    purse: "bag",
    backpack: "bag",
    accessory: "accessories",
    hat: "accessories",
    belt: "accessories",
    scarf: "accessories",
    jewelry: "accessories",
    watch: "accessories",
    sunglasses: "accessories",
  };

  for (const [keyword, cat] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) return cat;
  }
  return fallback;
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  return createClient(url, key);
}

/**
 * Upsert products into Supabase. Uses name+brand as the dedup key
 * to avoid duplicate entries across multiple scrape runs.
 */
async function upsertProducts(products: SupabaseProduct[]): Promise<number> {
  console.log(`\n💾 Upserting ${products.length} products to Supabase...`);

  const supabase = getSupabaseClient();
  let inserted = 0;

  // Batch upsert in chunks of 100
  const BATCH = 100;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "name,brand", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error(`   ⚠️  Batch ${i / BATCH + 1} error:`, error.message);
    } else {
      inserted += count ?? batch.length;
    }

    process.stdout.write(
      `   📦 ${Math.min(i + BATCH, products.length)}/${products.length} processed\r`
    );
  }

  console.log(`\n   ✅ Upserted ${inserted} products`);
  return inserted;
}

// ─── Elasticsearch Re-Index ──────────────────────────────────────────────────

/**
 * Trigger re-indexing so new products get embedded (via Jina) and indexed in ES.
 * Calls our own API endpoint which handles inference + indexing.
 */
async function triggerReindex(): Promise<void> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  console.log(`\n🔄 Triggering Elasticsearch re-index via ${appUrl}...`);

  try {
    const res = await fetch(`${appUrl}/api/search/index`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      console.log(`   ✅ Re-indexed: ${data.indexed ?? "?"} products`);
    } else {
      console.warn(`   ⚠️  Re-index returned ${res.status} — run manually if needed`);
    }
  } catch {
    console.warn("   ⚠️  Could not reach app for re-index — run POST /api/search/index manually");
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let categories = DEFAULT_CATEGORIES;
  let limit = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      categories = args[i + 1].split(",").map((s) => s.trim());
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 500;
      i++;
    }
  }

  return { categories, limit };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   🔆 Bright Data → Supabase Product Scraper             ║");
  console.log("║   Web Scraper API · Web Unlocker · SERP API · Crawl API ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const { categories, limit } = parseArgs();
  console.log(`\n📋 Config: ${categories.length} categories, limit ${limit} products`);

  // 1. SERP API: discover trending product URLs via Google Shopping
  const serpUrls = await discoverViaSERP(categories);

  // 2. Web Scraper API + Web Unlocker: scrape retailer sites + SERP URLs
  const snapshotId = await triggerCollection(categories, serpUrls);

  // 3. Wait for completion
  await waitForSnapshot(snapshotId);

  // 3. Download results
  const rawProducts = await downloadSnapshot(snapshotId);

  // 4. Normalize and deduplicate
  const seen = new Set<string>();
  const normalized: SupabaseProduct[] = [];

  for (const raw of rawProducts) {
    const product = normalizeProduct(raw, "other");
    if (!product) continue;

    const dedupKey = `${product.name.toLowerCase()}|${(product.brand || "").toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    normalized.push(product);
    if (normalized.length >= limit) break;
  }

  console.log(`\n📊 Normalized ${normalized.length} unique products from ${rawProducts.length} raw results`);

  // 5. Upsert to Supabase
  const inserted = await upsertProducts(normalized);

  // 6. Re-index in Elasticsearch (Jina embeddings)
  await triggerReindex();

  // Summary
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log(`║   ✅ Done!                                        ║`);
  console.log(`║   Raw scraped:  ${String(rawProducts.length).padStart(6)}                           ║`);
  console.log(`║   Normalized:   ${String(normalized.length).padStart(6)}                           ║`);
  console.log(`║   Upserted:     ${String(inserted).padStart(6)}                           ║`);
  console.log("╚══════════════════════════════════════════════════╝");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
