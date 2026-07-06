// Multi-member districts (migration 0011) put several Offices rows under one
// (district_id, slug) — e.g. two state house seats both slugged "state-house"
// in the same at-large district, distinguished only by seat_label ("Seat 1",
// "Seat 2"). A URL naming just the slug is ambiguous there, so those offices
// get an extra trailing segment derived from seat_label: "/seat-1", "/seat-2".
export function seatLabelToSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-");
}
