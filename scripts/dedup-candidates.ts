// Remove duplicate candidate rows where a state Secretary-of-State / Ballotpedia
// row and an FEC row describe the same person in the same race. We KEEP the FEC
// row (canonical federal identity + finance data) and DELETE the state-source
// duplicate. Matching is nickname-tolerant: "Bob Harvie" (PA SoS) collapses into
// "Robert J Harvie" (FEC) within the same (office_id, cycle).
//
// This is the one-time cleanup companion to the nickname-aware skip logic added
// to scrape-candidates.ts — that prevents new duplicates; this clears existing
// ones. DRY-RUN by default; pass --apply to delete.
//
//   npx tsx --env-file=.env.local scripts/dedup-candidates.ts          # preview
//   npx tsx --env-file=.env.local scripts/dedup-candidates.ts --apply  # delete

import { db } from "./lib/supabase-client";

const APPLY = process.argv.includes("--apply");

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Kept deliberately conservative — only unambiguous diminutives, no chained
// mappings (John/Jonathan/Jack are omitted). Mirrors the table in
// scripts/scrape-candidates.ts; this script is a standalone one-off.
const NICKNAMES: Record<string, string> = {
  bob: "robert", rob: "robert", bobby: "robert", robbie: "robert",
  bill: "william", will: "william", billy: "william", willie: "william",
  dick: "richard", rick: "richard", ricky: "richard", rich: "richard", richie: "richard",
  jim: "james", jimmy: "james", jamie: "james",
  joe: "joseph", joey: "joseph",
  mike: "michael", mikey: "michael",
  tom: "thomas", tommy: "thomas",
  tony: "anthony",
  dave: "david", davey: "david",
  dan: "daniel", danny: "daniel",
  ed: "edward", eddie: "edward",
  steve: "steven", stevie: "steven",
  chris: "christopher",
  chuck: "charles", charlie: "charles",
  matt: "matthew",
  greg: "gregory",
  ken: "kenneth", kenny: "kenneth",
  ron: "ronald", ronnie: "ronald",
  don: "donald", donnie: "donald",
  pat: "patrick",
  pete: "peter",
  sam: "samuel", sammy: "samuel",
  ben: "benjamin", benny: "benjamin",
  andy: "andrew", drew: "andrew",
  fred: "frederick", freddie: "frederick",
  gabe: "gabriel",
  nate: "nathaniel",
  nick: "nicholas",
  phil: "philip",
  ray: "raymond",
  vince: "vincent",
  walt: "walter",
  kate: "katherine", katie: "katherine", kathy: "katherine",
  cathy: "catherine",
  beth: "elizabeth", liz: "elizabeth", lizzie: "elizabeth", betty: "elizabeth", betsy: "elizabeth",
  sue: "susan", susie: "susan",
  peg: "margaret", peggy: "margaret", meg: "margaret", maggie: "margaret",
  patty: "patricia", patti: "patricia", trish: "patricia",
  jen: "jennifer", jenny: "jennifer",
  jess: "jessica",
  abby: "abigail",
  becky: "rebecca",
  vicky: "victoria",
  val: "valerie",
};

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const canonicalNickname = (t: string) => NICKNAMES[t] ?? t;

function firstAndLastToken(s: string): [string, string] | null {
  const tokens = normalizeName(s).split(" ").filter(Boolean);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length < 2) return null;
  return [tokens[0], tokens[tokens.length - 1]];
}

// canonical-first + last, falling back to the full normalized name for mononyms.
function matchKey(s: string): string {
  const fl = firstAndLastToken(s);
  return fl ? `${canonicalNickname(fl[0])} ${fl[1]}` : normalizeName(s);
}

type Row = {
  id: string;
  office_id: string;
  cycle: number;
  name: string;
  source: string;
};

async function loadAll(): Promise<Row[]> {
  const rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("Candidates")
      .select("id, office_id, cycle, name, source")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  console.log(`=== Candidate dedup (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);
  const rows = await loadAll();
  console.log(`Loaded ${rows.length} candidate rows.`);

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const g = `${r.office_id}::${r.cycle}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  const toDelete: Array<{ row: Row; matchedFec: string }> = [];
  for (const group of groups.values()) {
    const fec = group.filter((r) => r.source === "fec");
    if (fec.length === 0) continue;
    const fecByKey = new Map<string, Row>();
    for (const f of fec) fecByKey.set(matchKey(f.name), f);
    for (const r of group) {
      if (r.source === "fec") continue;
      const f = fecByKey.get(matchKey(r.name));
      if (f) toDelete.push({ row: r, matchedFec: f.name });
    }
  }

  console.log(`\nFound ${toDelete.length} state-source duplicates of FEC rows:\n`);
  for (const { row, matchedFec } of toDelete) {
    console.log(`  delete [${row.source}] "${row.name}"  ⇐ keep [fec] "${matchedFec}"`);
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to dedup.");
    return;
  }
  if (!APPLY) {
    console.log(
      `\nDRY RUN — no rows deleted. Re-run with --apply to delete ${toDelete.length} rows.`
    );
    return;
  }

  const ids = toDelete.map((d) => d.row.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error } = await db.from("Candidates").delete().in("id", chunk);
    if (error) throw new Error(`delete failed at ${i}: ${error.message}`);
    deleted += chunk.length;
  }
  console.log(`\nDeleted ${deleted} duplicate rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
