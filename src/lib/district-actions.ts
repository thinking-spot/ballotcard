"use server";

import { db } from "@/lib/supabase";

type DistrictOption = {
  id: string;
  name: string;
  kind: string;
  geoSlug: string;
};

/** All US states (kind = 'state'), ordered alphabetically. */
export async function getStatesAction(): Promise<DistrictOption[]> {
  const { data } = await db
    .from("Districts")
    .select("id, name, kind, geo_slug")
    .eq("kind", "state")
    .order("name");

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    geoSlug: r.geo_slug as string,
  }));
}

/** Counties and county-equivalent districts within a given parent district. */
export async function getCountiesAction(
  parentId: string
): Promise<DistrictOption[]> {
  const { data } = await db
    .from("Districts")
    .select("id, name, kind, geo_slug")
    .eq("parent_id", parentId)
    .eq("kind", "county")
    .order("name");

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    geoSlug: r.geo_slug as string,
  }));
}

/** Municipalities within a given county. */
export async function getMunicipalitiesAction(
  parentId: string
): Promise<DistrictOption[]> {
  const { data } = await db
    .from("Districts")
    .select("id, name, kind, geo_slug")
    .eq("parent_id", parentId)
    .eq("kind", "municipality")
    .order("name");

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    geoSlug: r.geo_slug as string,
  }));
}
