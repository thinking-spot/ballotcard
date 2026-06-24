// All 50 US states with data needed for ingestion.
// houseSeats: based on 2020 Census apportionment.
// senateClasses: the two Senate classes for each state's seats.

export type USState = {
  abbr: string;
  name: string;
  fips: string;
  houseSeats: number;
  senateClasses: [number, number];
  governorTermYears: number;
};

export const US_STATES: USState[] = [
  { abbr: "AL", name: "Alabama", fips: "01", houseSeats: 7, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "AK", name: "Alaska", fips: "02", houseSeats: 1, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "AZ", name: "Arizona", fips: "04", houseSeats: 9, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "AR", name: "Arkansas", fips: "05", houseSeats: 4, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "CA", name: "California", fips: "06", houseSeats: 52, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "CO", name: "Colorado", fips: "08", houseSeats: 8, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "CT", name: "Connecticut", fips: "09", houseSeats: 5, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "DE", name: "Delaware", fips: "10", houseSeats: 1, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "FL", name: "Florida", fips: "12", houseSeats: 28, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "GA", name: "Georgia", fips: "13", houseSeats: 14, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "HI", name: "Hawaii", fips: "15", houseSeats: 2, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "ID", name: "Idaho", fips: "16", houseSeats: 2, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "IL", name: "Illinois", fips: "17", houseSeats: 17, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "IN", name: "Indiana", fips: "18", houseSeats: 9, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "IA", name: "Iowa", fips: "19", houseSeats: 4, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "KS", name: "Kansas", fips: "20", houseSeats: 4, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "KY", name: "Kentucky", fips: "21", houseSeats: 6, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "LA", name: "Louisiana", fips: "22", houseSeats: 6, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "ME", name: "Maine", fips: "23", houseSeats: 2, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "MD", name: "Maryland", fips: "24", houseSeats: 8, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "MA", name: "Massachusetts", fips: "25", houseSeats: 9, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "MI", name: "Michigan", fips: "26", houseSeats: 13, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "MN", name: "Minnesota", fips: "27", houseSeats: 8, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "MS", name: "Mississippi", fips: "28", houseSeats: 4, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "MO", name: "Missouri", fips: "29", houseSeats: 8, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "MT", name: "Montana", fips: "30", houseSeats: 2, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "NE", name: "Nebraska", fips: "31", houseSeats: 3, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "NV", name: "Nevada", fips: "32", houseSeats: 4, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "NH", name: "New Hampshire", fips: "33", houseSeats: 2, senateClasses: [2, 3], governorTermYears: 2 },
  { abbr: "NJ", name: "New Jersey", fips: "34", houseSeats: 12, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "NM", name: "New Mexico", fips: "35", houseSeats: 3, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "NY", name: "New York", fips: "36", houseSeats: 26, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "NC", name: "North Carolina", fips: "37", houseSeats: 14, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "ND", name: "North Dakota", fips: "38", houseSeats: 1, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "OH", name: "Ohio", fips: "39", houseSeats: 15, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "OK", name: "Oklahoma", fips: "40", houseSeats: 5, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "OR", name: "Oregon", fips: "41", houseSeats: 6, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "PA", name: "Pennsylvania", fips: "42", houseSeats: 17, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "RI", name: "Rhode Island", fips: "44", houseSeats: 2, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "SC", name: "South Carolina", fips: "45", houseSeats: 7, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "SD", name: "South Dakota", fips: "46", houseSeats: 1, senateClasses: [2, 3], governorTermYears: 4 },
  { abbr: "TN", name: "Tennessee", fips: "47", houseSeats: 9, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "TX", name: "Texas", fips: "48", houseSeats: 38, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "UT", name: "Utah", fips: "49", houseSeats: 4, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "VT", name: "Vermont", fips: "50", houseSeats: 1, senateClasses: [1, 3], governorTermYears: 2 },
  { abbr: "VA", name: "Virginia", fips: "51", houseSeats: 11, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "WA", name: "Washington", fips: "53", houseSeats: 10, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "WV", name: "West Virginia", fips: "54", houseSeats: 2, senateClasses: [1, 2], governorTermYears: 4 },
  { abbr: "WI", name: "Wisconsin", fips: "55", houseSeats: 8, senateClasses: [1, 3], governorTermYears: 4 },
  { abbr: "WY", name: "Wyoming", fips: "56", houseSeats: 1, senateClasses: [1, 2], governorTermYears: 4 },
];

// US territories with non-voting House representation. Districts here render
// as state-equivalents but have no Senate seats, no state legislature, and no
// statewide execs beyond the territory's own (DC has a mayor; the islands
// have governors — handled in separate seeds).
export type USTerritory = {
  abbr: string;
  name: string;
  fips: string;
  /** "delegate" (DC, GU, VI, AS, MP, 2-year term) or "resident_commissioner" (PR, 4-year term). */
  delegateKind: "delegate" | "resident_commissioner";
};

export const US_TERRITORIES: USTerritory[] = [
  { abbr: "DC", name: "District of Columbia", fips: "11", delegateKind: "delegate" },
  { abbr: "PR", name: "Puerto Rico", fips: "72", delegateKind: "resident_commissioner" },
  { abbr: "GU", name: "Guam", fips: "66", delegateKind: "delegate" },
  { abbr: "VI", name: "U.S. Virgin Islands", fips: "78", delegateKind: "delegate" },
  { abbr: "AS", name: "American Samoa", fips: "60", delegateKind: "delegate" },
  { abbr: "MP", name: "Northern Mariana Islands", fips: "69", delegateKind: "delegate" },
];

// Roman numeral labels for Senate classes
export function senateClassLabel(classNum: number): string {
  const labels: Record<number, string> = { 1: "I", 2: "II", 3: "III" };
  return labels[classNum] || String(classNum);
}

// Senate slug from class number: "us-senate-class-ii"
export function senateSlug(classNum: number): string {
  return `us-senate-class-${senateClassLabel(classNum).toLowerCase()}`;
}

// Next election year by Senate class (from 2026 cycle)
export function senateNextElection(classNum: number): string {
  const years: Record<number, string> = {
    1: "2030-11-03",
    2: "2026-11-03",
    3: "2028-11-03",
  };
  return years[classNum] || "2026-11-03";
}

// House district geo_slug: "nc/07" or "wy/al" for at-large
export function houseGeoSlug(stateAbbr: string, district: number, totalSeats: number): string {
  const st = stateAbbr.toLowerCase();
  if (totalSeats === 1) return `${st}/al`;
  return `${st}/${String(district).padStart(2, "0")}`;
}

// House district display name: "NC-07" or "WY-AL"
export function houseDistrictName(stateAbbr: string, district: number, totalSeats: number): string {
  if (totalSeats === 1) return `${stateAbbr}-AL`;
  return `${stateAbbr}-${String(district).padStart(2, "0")}`;
}

// Normalize a state-legislative district label so the Census-derived value
// (numeric, e.g. "008") and the Open States label (e.g. "8") match.
// Numeric districts collapse to their integer string; others are slugified.
export function normDistrict(label: string): string {
  const trimmed = label.trim();
  if (/^\d+$/.test(trimmed)) return String(parseInt(trimmed, 10));
  return trimmed
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// State-legislative district slugs — shared convention with the ballot card.
export function sldUpperSlug(stateAbbr: string, district: string): string {
  return `${stateAbbr.toLowerCase()}/sldu-${normDistrict(district)}`;
}
export function sldLowerSlug(stateAbbr: string, district: string): string {
  return `${stateAbbr.toLowerCase()}/sldl-${normDistrict(district)}`;
}
