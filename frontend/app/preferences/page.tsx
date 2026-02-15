"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import {
  Ruler,
  Shirt,
  Footprints,
  Palette,
  DollarSign,
  Check,
  User as UserIcon,
  Camera,
  Loader2,
  X,
} from "lucide-react";
import type { UserPreferences } from "@/types/preferences";

const PreferenceMannequin = dynamic(
  () =>
    import("@/components/preference-mannequin").then(
      (mod) => mod.PreferenceMannequin
    ),
  { ssr: false }
);

const TOP_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const BOTTOM_SIZES = ["26", "28", "29", "30", "31", "32", "33", "34", "36", "38", "40"];
const SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13", "14"];
const FIT_OPTIONS = ["slim", "regular", "relaxed", "oversized"] as const;
const STYLE_OPTIONS = [
  "Casual", "Streetwear", "Minimalist", "Athletic", "Preppy",
  "Bohemian", "Classic", "Avant-Garde", "Vintage", "Techwear",
];
const COLOR_OPTIONS = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Grey", hex: "#6b7280" },
  { name: "Beige", hex: "#d4b896" },
  { name: "Brown", hex: "#7c5c3c" },
  { name: "Olive", hex: "#5a6e3a" },
  { name: "Burgundy", hex: "#722f37" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Red", hex: "#dc2626" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Purple", hex: "#8b5cf6" },
];

export default function PreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [authed, setAuthed] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [prefs, setPrefs] = useState<Partial<UserPreferences>>({
    height_cm: null,
    weight_kg: null,
    top_size: null,
    bottom_size: null,
    shoe_size: null,
    fit_preference: null,
    preferred_styles: [],
    preferred_colors: [],
    budget_min: null,
    budget_max: null,
    gender: null,
    photo_url: null,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/preferences");
      if (!res.ok) return;
      const { preferences } = await res.json();
      if (preferences) {
        setPrefs(preferences);
      }
    } finally {
      setLoading(false);
      // Allow autosave after initial load settles
      setTimeout(() => { initialLoadRef.current = false; }, 100);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchPrefs();
  }, [authed, fetchPrefs]);

  // Autosave with 800ms debounce
  useEffect(() => {
    if (initialLoadRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        });
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 1500);
        }
      } catch {
        setSaveStatus("idle");
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [prefs]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      // Send to server for conversion (handles HEIC, WebP, PNG → JPEG via sharp)
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/preferences/photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Photo upload error:", data.error);
        return;
      }

      const { photoUrl } = await res.json();
      setPrefs((p) => ({ ...p, photo_url: photoUrl }));
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setPhotoUploading(false);
    }
  }

  function toggleArrayItem(field: "preferred_styles" | "preferred_colors", item: string) {
    setPrefs((prev) => {
      const arr = prev[field] ?? [];
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      };
    });
  }

  function cmToFtIn(cm: number) {
    const totalIn = cm / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inches = Math.round(totalIn % 12);
    return `${ft}'${inches}"`;
  }

  if (!authed || loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-28 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <Header />
      <div className="pt-28" />

      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Preferences
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Help us find your perfect fit and style.
        </p>

        {/* Two-column layout: settings + mannequin */}
        <div className="mt-10 flex gap-10 lg:gap-14">
          {/* ── Left: Settings ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-10">
            {/* Gender */}
            <Section icon={<UserIcon size={20} />} title="Gender">
              <div className="flex flex-wrap gap-2">
                {(["male", "female", "non-binary"] as const).map((g) => (
                  <Chip
                    key={g}
                    label={g === "non-binary" ? "Non-binary" : g.charAt(0).toUpperCase() + g.slice(1)}
                    active={prefs.gender === g}
                    onClick={() => setPrefs((p) => ({ ...p, gender: p.gender === g ? null : g }))}
                  />
                ))}
              </div>
            </Section>

            {/* Photo */}
            <Section icon={<Camera size={20} />} title="Your Photo">
              <p className="text-sm text-muted-foreground mb-3">
                Upload a full-body photo for AI try-on videos.
              </p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {prefs.photo_url ? (
                <div className="relative inline-block">
                  <div className="relative h-48 w-36 rounded-xl overflow-hidden bg-secondary">
                    <Image
                      src={prefs.photo_url}
                      alt="Your photo"
                      fill
                      className="object-cover"
                      sizes="144px"
                    />
                  </div>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change photo
                  </button>
                  <button
                    onClick={() => setPrefs((p) => ({ ...p, photo_url: null }))}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 px-8 hover:border-foreground/30 hover:bg-secondary/50 transition-colors"
                >
                  {photoUploading ? (
                    <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  ) : (
                    <Camera size={24} className="text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {photoUploading ? "Uploading..." : "Upload photo"}
                  </span>
                </button>
              )}
            </Section>

            {/* Measurements */}
            <Section icon={<Ruler size={20} />} title="Measurements">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Height</label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={140}
                      max={210}
                      step={1}
                      value={prefs.height_cm ?? 170}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, height_cm: Number(e.target.value) }))
                      }
                      className="flex-1 accent-foreground"
                    />
                    <input
                      type="number"
                      min={140}
                      max={210}
                      value={prefs.height_cm ?? 170}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 100 && v <= 250) setPrefs((p) => ({ ...p, height_cm: v }));
                      }}
                      className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-sm text-center text-foreground tabular-nums focus:border-foreground focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      cm ({cmToFtIn(prefs.height_cm ?? 170)})
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Weight</label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={40}
                      max={150}
                      step={1}
                      value={prefs.weight_kg ?? 70}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, weight_kg: Number(e.target.value) }))
                      }
                      className="flex-1 accent-foreground"
                    />
                    <input
                      type="number"
                      min={40}
                      max={150}
                      value={prefs.weight_kg ?? 70}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 20 && v <= 200) setPrefs((p) => ({ ...p, weight_kg: v }));
                      }}
                      className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-sm text-center text-foreground tabular-nums focus:border-foreground focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      kg ({Math.round((prefs.weight_kg ?? 70) * 2.205)} lb)
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {/* Sizing */}
            <Section icon={<Shirt size={20} />} title="Sizing">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Top Size</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TOP_SIZES.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        active={prefs.top_size === s}
                        onClick={() => setPrefs((p) => ({ ...p, top_size: p.top_size === s ? null : s }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bottom Size (waist)</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BOTTOM_SIZES.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        active={prefs.bottom_size === s}
                        onClick={() => setPrefs((p) => ({ ...p, bottom_size: p.bottom_size === s ? null : s }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Shoe Size (US)</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SHOE_SIZES.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        active={prefs.shoe_size === s}
                        onClick={() => setPrefs((p) => ({ ...p, shoe_size: p.shoe_size === s ? null : s }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Fit Preference */}
            <Section icon={<Footprints size={20} />} title="Fit Preference">
              <div className="flex flex-wrap gap-2">
                {FIT_OPTIONS.map((f) => (
                  <Chip
                    key={f}
                    label={f.charAt(0).toUpperCase() + f.slice(1)}
                    active={prefs.fit_preference === f}
                    onClick={() =>
                      setPrefs((p) => ({ ...p, fit_preference: p.fit_preference === f ? null : f }))
                    }
                  />
                ))}
              </div>
            </Section>

            {/* Style */}
            <Section icon={<Palette size={20} />} title="Style">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Preferred Styles</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      active={prefs.preferred_styles?.includes(s) ?? false}
                      onClick={() => toggleArrayItem("preferred_styles", s)}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <label className="text-sm font-medium text-muted-foreground">Preferred Colors</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => toggleArrayItem("preferred_colors", c.name)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all ${
                        prefs.preferred_colors?.includes(c.name)
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-border/50"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Budget */}
            <Section icon={<DollarSign size={20} />} title="Budget Range">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Min ($)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={prefs.budget_min ?? ""}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        budget_min: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Max ($)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="500"
                    value={prefs.budget_max ?? ""}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        budget_max: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                  />
                </div>
              </div>
            </Section>

            {/* Autosave indicator */}
            <div className="flex items-center gap-2 pb-4 text-sm text-muted-foreground">
              {saveStatus === "saving" && (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check size={14} className="text-green-500" />
                  Saved
                </>
              )}
            </div>
          </div>

          {/* ── Right: Live mannequin preview ──────────────── */}
          <div className="hidden lg:flex lg:flex-col w-[600px] shrink-0">
            <div className="sticky top-32 flex-1 flex flex-col">
              <div className="relative h-full min-h-[520px] rounded-2xl bg-background overflow-hidden border border-border/50">
                <PreferenceMannequin
                  heightCm={prefs.height_cm ?? 170}
                  weightKg={prefs.weight_kg ?? 70}
                  gender={prefs.gender ?? null}
                  fitPreference={prefs.fit_preference ?? null}
                />
                {/* Readout overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10">
                  <div className="flex items-end justify-between text-white">
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-wider">Preview</p>
                      <p className="text-sm font-semibold">
                        {prefs.height_cm ?? 170} cm &middot; {prefs.weight_kg ?? 70} kg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/60 uppercase tracking-wider">Fit</p>
                      <p className="text-sm font-semibold capitalize">
                        {prefs.fit_preference ?? "Regular"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Drag to rotate &middot; Updates live
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Reusable components ──────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
