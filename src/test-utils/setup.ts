import { vi, beforeEach } from "vitest";

// ── Hoisted mock state ──────────────────────────────────────────────────────
// vi.hoisted ensures these are available inside vi.mock factories.

const _state = vi.hoisted(() => {
  const responses: Array<{ data: unknown; error: unknown }> = [];
  return { responses };
});

// ── Supabase mock ───────────────────────────────────────────────────────────

vi.mock("@/lib/supabase", () => {
  function nextResponse() {
    return _state.responses.shift() ?? { data: null, error: null };
  }

  function createBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const m of [
      "select",
      "eq",
      "neq",
      "in",
      "is",
      "not",
      "order",
      "limit",
    ]) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve(nextResponse());
    builder.single = () => Promise.resolve(nextResponse());
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(nextResponse()).then(resolve, reject);
    return builder;
  }

  return {
    db: { from: vi.fn(() => createBuilder()) },
  };
});

// ── Next.js mocks ──────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// ── Expose state for helpers module ────────────────────────────────────────

(globalThis as unknown as { __bcMockState: typeof _state }).__bcMockState =
  _state;

// ── Reset between tests ────────────────────────────────────────────────────

beforeEach(() => {
  _state.responses.length = 0;
  vi.clearAllMocks();
});
