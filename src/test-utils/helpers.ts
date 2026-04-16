type MockState = {
  responses: Array<{ data: unknown; error: unknown }>;
  session: unknown;
  inserts: Array<{ table: string; row: unknown }>;
  updates: Array<{ table: string; row: unknown }>;
  upserts: Array<{ table: string; row: unknown; options?: unknown }>;
};

function state(): MockState {
  return (globalThis as any).__bcMockState;
}

/** Queue a Supabase response. Consumed in FIFO order by mock query builders. */
export function q(data: unknown, error: unknown = null) {
  state().responses.push({ data, error });
}

/** Set the mock auth session. */
export function setSession(
  session: {
    user: { id: string; username: string; homeDistrictId?: string };
  } | null
) {
  state().session = session;
}

/** Get all INSERT calls to a specific table (or all tables). */
export function getInserts(table?: string) {
  const all = state().inserts;
  return table ? all.filter((i) => i.table === table) : [...all];
}

/** Get all UPDATE calls to a specific table (or all tables). */
export function getUpdates(table?: string) {
  const all = state().updates;
  return table ? all.filter((u) => u.table === table) : [...all];
}

/** Get all UPSERT calls to a specific table (or all tables). */
export function getUpserts(table?: string) {
  const all = state().upserts;
  return table ? all.filter((u) => u.table === table) : [...all];
}

// ── Standard test fixtures ──────────────────────────────────────────────────

export const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "testuser",
  homeDistrictId: "00000000-0000-0000-0000-000000000101",
};

export function loginAsTestUser() {
  setSession({ user: TEST_USER });
}

/** Create a FormData object from a plain object. */
export function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}
