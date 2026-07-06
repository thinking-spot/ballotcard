// Decides how an incoming ingestion source's external_refs should combine
// with what's already on an Officials row.
//
// Same person (name unchanged, e.g. a party switch): carry forward existing
// refs the new source doesn't repeat — they still point at the same human.
//
// Different person (name changed — a new occupant of the seat): the new
// source's refs fully replace the old ones. Merging here would silently
// carry the *predecessor's* ballotpedia/wikipedia/openstates ID onto the new
// officeholder's page, since Congress/OpenStates rows never repeat those
// keys on every run — only the source that originally set them does.
export function mergeOfficialRefs(
  existingName: string,
  incomingName: string,
  existingRefs: Record<string, string> | null | undefined,
  incomingRefs: Record<string, string> | null | undefined
): Record<string, string> {
  const incoming = incomingRefs ?? {};
  if (existingName !== incomingName) return incoming;
  return { ...(existingRefs ?? {}), ...incoming };
}
