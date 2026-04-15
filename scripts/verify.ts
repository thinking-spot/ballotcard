// Post-ingestion verification for BallotCard seeded tier.
// Run: npx tsx --env-file=.env.local scripts/verify.ts

import { db } from "./lib/supabase-client";

type Check = {
  label: string;
  query: () => Promise<number>;
  expected: number | [number, number]; // exact or [min, max]
};

async function count(table: string, filters?: Record<string, unknown>): Promise<number> {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filters) {
    for (const [key, val] of Object.entries(filters)) {
      q = q.eq(key, val);
    }
  }
  const { count: c } = await q;
  return c ?? 0;
}

const checks: Check[] = [
  {
    label: "State districts",
    query: () => count("Districts", { kind: "state" }),
    expected: 50,
  },
  {
    label: "US House districts",
    query: () => count("Districts", { kind: "us_house" }),
    expected: 435,
  },
  {
    label: "Municipality districts",
    query: () => count("Districts", { kind: "municipality" }),
    expected: [1, 400], // at least the existing Wilmington + mayors
  },
  {
    label: "US House offices",
    query: async () => {
      const { count: c } = await db
        .from("Offices")
        .select("*", { count: "exact", head: true })
        .eq("slug", "us-house");
      return c ?? 0;
    },
    expected: 435,
  },
  {
    label: "US Senate offices",
    query: async () => {
      const { count: c } = await db
        .from("Offices")
        .select("*", { count: "exact", head: true })
        .like("slug", "us-senate-%");
      return c ?? 0;
    },
    expected: 100,
  },
  {
    label: "Governor offices",
    query: () => count("Offices", { slug: "governor" }),
    expected: 50,
  },
  {
    label: "Mayor offices",
    query: () => count("Offices", { slug: "mayor" }),
    expected: [20, 400],
  },
  {
    label: "Current officials",
    query: () => count("Officials", { is_current: true }),
    expected: [550, 950], // 535 Congress + 50 govs + mayors
  },
  {
    label: "Official tags",
    query: () => count("Tags", { kind: "official" }),
    expected: [550, 950],
  },
  {
    label: "NC-07 office still exists",
    query: async () => {
      const { data } = await db
        .from("Offices")
        .select("id")
        .eq("id", "00000000-0000-4000-8000-000000000020");
      return data?.length ?? 0;
    },
    expected: 1,
  },
  {
    label: "Pat Vance still current",
    query: async () => {
      const { data } = await db
        .from("Officials")
        .select("id")
        .eq("id", "00000000-0000-4000-8000-000000000030")
        .eq("is_current", true);
      return data?.length ?? 0;
    },
    expected: 1,
  },
  {
    label: "Existing posts untouched",
    query: async () => {
      const { count: c } = await db
        .from("Posts")
        .select("*", { count: "exact", head: true })
        .eq("office_id", "00000000-0000-4000-8000-000000000020")
        .is("deleted_at", null);
      return c ?? 0;
    },
    expected: [3, 10], // at least the 3 seeded posts
  },
];

async function main() {
  console.log("=== BallotCard Ingestion Verification ===\n");
  let pass = 0;
  let fail = 0;

  for (const check of checks) {
    const actual = await check.query();
    let ok: boolean;
    let expectStr: string;

    if (Array.isArray(check.expected)) {
      ok = actual >= check.expected[0] && actual <= check.expected[1];
      expectStr = `${check.expected[0]}–${check.expected[1]}`;
    } else {
      ok = actual === check.expected;
      expectStr = String(check.expected);
    }

    const status = ok ? "PASS" : "FAIL";
    console.log(`  ${ok ? "✓" : "✗"} ${check.label}: ${actual} (expected ${expectStr}) ${status}`);
    if (ok) pass++;
    else fail++;
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
