import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";
import { seatLabelToSlug } from "@/lib/seat-slug";

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
  let districts: { id: string; geo_slug: string; parent_id: string | null }[] = [];
  let offices: { district_id: string; slug: string; seat_label: string | null }[] = [];
  let lastRun: string | undefined;
  try {
    [districts, offices] = await Promise.all([
      selectAll<{ id: string; geo_slug: string; parent_id: string | null }>(
        "Districts",
        "id, geo_slug, parent_id"
      ),
      selectAll<{ district_id: string; slug: string; seat_label: string | null }>(
        "Offices",
        "district_id, slug, seat_label"
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

  // A district holding exactly one office and no sub-districts redirects to
  // that office (see the catch-all page's passthroughOfficeUrl) — skip it
  // here so the sitemap doesn't submit URLs that just 308 elsewhere.
  const officeCountByDistrict = new Map<string, number>();
  // A multi-member district (migration 0011) has several offices sharing one
  // (district_id, slug) — that combo needs a /seat-n segment to be a distinct,
  // resolvable URL (see seat-slug.ts and the catch-all page's resolveSlug).
  const officeCountBySlug = new Map<string, number>();
  for (const o of offices) {
    if (!o.slug) continue;
    officeCountByDistrict.set(
      o.district_id,
      (officeCountByDistrict.get(o.district_id) ?? 0) + 1
    );
    const slugKey = `${o.district_id}::${o.slug}`;
    officeCountBySlug.set(slugKey, (officeCountBySlug.get(slugKey) ?? 0) + 1);
  }
  const childCountByParent = new Map<string, number>();
  for (const d of districts) {
    if (!d.parent_id) continue;
    childCountByParent.set(
      d.parent_id,
      (childCountByParent.get(d.parent_id) ?? 0) + 1
    );
  }
  const isPassthroughDistrict = (d: { id: string }) =>
    (officeCountByDistrict.get(d.id) ?? 0) === 1 &&
    (childCountByParent.get(d.id) ?? 0) === 0;

  const districtEntries: MetadataRoute.Sitemap = districts
    .filter((d) => !isPassthroughDistrict(d))
    .map((d) => ({
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
    const needsSeatSlug =
      (officeCountBySlug.get(`${o.district_id}::${o.slug}`) ?? 1) > 1 &&
      o.seat_label;
    const path = needsSeatSlug
      ? `${geo}/${o.slug}/${seatLabelToSlug(o.seat_label as string)}`
      : `${geo}/${o.slug}`;
    officeEntries.push({
      url: `${BASE}/${path}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return [...staticEntries, ...districtEntries, ...officeEntries];
}
