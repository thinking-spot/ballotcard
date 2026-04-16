import { vi, beforeEach } from "vitest";

// ── Hoisted mock state ──────────────────────────────────────────────────────
// vi.hoisted ensures these are available inside vi.mock factories.

const _state = vi.hoisted(() => {
  const responses: Array<{ data: unknown; error: unknown }> = [];
  let session: unknown = null;
  const inserts: Array<{ table: string; row: unknown }> = [];
  const updates: Array<{ table: string; row: unknown }> = [];
  const upserts: Array<{ table: string; row: unknown; options?: unknown }> = [];

  return {
    responses,
    inserts,
    updates,
    upserts,
    get session() {
      return session;
    },
    set session(v: unknown) {
      session = v;
    },
  };
});

// ── Supabase mock ───────────────────────────────────────────────────────────

vi.mock("@/lib/supabase", () => {
  function nextResponse() {
    return _state.responses.shift() ?? { data: null, error: null };
  }

  function createBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const m of [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "order",
      "limit",
      "delete",
    ]) {
      builder[m] = () => builder;
    }
    builder.insert = (row: unknown) => {
      _state.inserts.push({ table, row });
      return builder;
    };
    builder.update = (row: unknown) => {
      _state.updates.push({ table, row });
      return builder;
    };
    builder.upsert = (row: unknown, options?: unknown) => {
      _state.upserts.push({ table, row, options });
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve(nextResponse());
    builder.single = () => Promise.resolve(nextResponse());
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(nextResponse()).then(resolve, reject);
    return builder;
  }

  return {
    db: { from: vi.fn((table: string) => createBuilder(table)) },
  };
});

// ── Auth mock ───────────────────────────────────────────────────────────────

vi.mock("@/auth", () => ({
  auth: vi.fn(() => Promise.resolve(_state.session)),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ── next-auth mock (AuthError class) ────────────────────────────────────────

vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string;
    constructor(message?: string) {
      super(message);
      this.type = "AuthError";
      this.name = "AuthError";
    }
  }
  return { AuthError };
});

// ── Next.js mocks ──────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as any).digest = "NEXT_REDIRECT";
    throw err;
  }),
}));

// ── Rate limit mock (always allow) ─────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  limits: new Proxy({}, { get: () => () => true }),
  checkRateLimit: () => true,
}));

// ── Election data mock ─────────────────────────────────────────────────────

vi.mock("@/lib/election-data", () => ({
  isResidentOfDistrictSubtree: vi.fn(() => Promise.resolve(true)),
}));

// ── OG fetch mock ──────────────────────────────────────────────────────────

vi.mock("@/lib/og-fetch", () => ({
  fetchOpenGraph: vi.fn(() =>
    Promise.resolve({
      url: "https://example.com/article",
      title: "Example Article",
      description: "An example article",
      imageUrl: null,
      domain: "example.com",
      publishedAt: null,
      fetchStatus: "success",
    })
  ),
}));

// ── bcryptjs mock ──────────────────────────────────────────────────────────

vi.mock("bcryptjs", () => {
  const hash = vi.fn(async (password: string) => `hashed_${password}`);
  const compare = vi.fn(
    async (password: string, storedHash: string) =>
      storedHash === `hashed_${password}`
  );
  return { default: { hash, compare }, hash, compare };
});

// ── Expose state for helpers module ────────────────────────────────────────

(globalThis as any).__bcMockState = _state;

// ── Reset between tests ────────────────────────────────────────────────────

beforeEach(() => {
  _state.responses.length = 0;
  _state.inserts.length = 0;
  _state.updates.length = 0;
  _state.upserts.length = 0;
  _state.session = null;
  vi.clearAllMocks();
});
