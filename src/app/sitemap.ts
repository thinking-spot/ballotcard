import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";

// Indexability is a core principle ("permalinked, permanent, indexable"). This
// sitemap exposes every district and office permalink so crawlers can discover
// the whole tree, not just whatever happens to be linked. Regenerated daily.
export const revalidate = 86400;

const BASE = "https://ballot-card.com";

// Supabase caps a single SELECT at 1000 rows — paginate or silently lose rows.
async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

const STATIC_PATHS = ["/", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "monthly",
    priority: p === "/" ? 1 : 0.5,
  }));

  // Pull the place tree + offices. If the DB is unreachable at build/revalidate
  // time, fall back to the static entries rather than failing the whole route.
  let districts: { id: string; geo_slug: string }[] = [];
  let offices: { district_id: string; slug: string }[] = [];
  let lastRun: string | undefined;
  try {
    [districts, offices] = await Promise.all([
      selectAll<{ id: string; geo_slug: string }>("Districts", "id, geo_slug"),
      selectAll<{ district_id: string; slug: string }>(
        "Offices",
        "district_id, slug"
      ),
    ]);
    const { data: run } = await db
      .from("IngestionRuns")
      .select("finished_at")
      .eq("status", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastRun = (run?.finished_at as string) || undefined;
  } catch {
    return staticEntries;
  }

  const lastModified = lastRun ? new Date(lastRun) : undefined;
  const slugById = new Map(districts.map((d) => [d.id, d.geo_slug]));

  const districtEntries: MetadataRoute.Sitemap = districts.map((d) => ({
    url: `${BASE}/${d.geo_slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const officeEntries: MetadataRoute.Sitemap = [];
  for (const o of offices) {
    if (!o.slug) continue;
    const geo = slugById.get(o.district_id);
    if (!geo) continue;
    officeEntries.push({
      url: `${BASE}/${geo}/${o.slug}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return [...staticEntries, ...districtEntries, ...officeEntries];
}
