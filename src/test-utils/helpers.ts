type MockState = {
  responses: Array<{ data: unknown; error: unknown }>;
};

function state(): MockState {
  return (globalThis as unknown as { __bcMockState: MockState }).__bcMockState;
}

/** Queue a Supabase response. Consumed in FIFO order by mock query builders. */
export function q(data: unknown, error: unknown = null) {
  state().responses.push({ data, error });
}

/** Create a FormData object from a plain object. */
export function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}
