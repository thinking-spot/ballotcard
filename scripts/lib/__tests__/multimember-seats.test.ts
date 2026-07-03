import { describe, it, expect } from "vitest";
import { assignLegislativeSeats } from "../multimember-seats";
import type { OpenStatesPerson } from "../types";

function person(
  id: string,
  name: string,
  chamber: "upper" | "lower",
  district: string
): OpenStatesPerson {
  return {
    id,
    name,
    current_party: "Republican",
    current_district: district,
    current_chamber: chamber,
    image: "",
  };
}

describe("assignLegislativeSeats", () => {
  it("gives single-member districts a null seat_label", () => {
    const people = [
      person("a", "Alice", "lower", "1"),
      person("b", "Bob", "lower", "2"),
    ];
    const out = assignLegislativeSeats([{ abbr: "XX" }], new Map([["XX", people]]));
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.seatLabel === null)).toBe(true);
  });

  it("splits a systemic multi-member chamber into Seat 1/Seat 2 (Arizona-style: every House district elects 2)", () => {
    const people = [
      person("id-b", "Bergman", "lower", "1"),
      person("id-a", "Anders", "lower", "1"),
      person("id-c", "Carter", "lower", "2"),
      person("id-d", "Diaz", "lower", "2"),
    ];
    const out = assignLegislativeSeats([{ abbr: "AZ" }], new Map([["AZ", people]]));
    expect(out).toHaveLength(4);
    const district1 = out.filter((s) => s.person.current_district === "1");
    expect(district1.map((s) => s.seatLabel).sort()).toEqual(["Seat 1", "Seat 2"]);
    // Stable ordering: lower Open States id sorts first regardless of array order.
    expect(district1.find((s) => s.person.id === "id-a")?.seatLabel).toBe("Seat 1");
    expect(district1.find((s) => s.person.id === "id-b")?.seatLabel).toBe("Seat 2");
  });

  it("does not fabricate a phantom seat from an isolated duplicate (Minnesota-style stale Open States record)", () => {
    // 1 duplicated district out of 20 in the chamber (5%) — well under the
    // systemic threshold, so this should collapse to a single seat, not split.
    const people = [
      person("6292245e", "Joe McDonald", "lower", "29A"),
      person("f08531c2", "Joe Schomacker", "lower", "29A"), // stale record, wrong district
      ...Array.from({ length: 19 }, (_, i) =>
        person(`solo-${i}`, `Rep ${i}`, "lower", `${i + 30}`)
      ),
    ];
    const out = assignLegislativeSeats([{ abbr: "MN" }], new Map([["MN", people]]));
    const district29a = out.filter((s) => s.person.current_district === "29A");
    expect(district29a).toHaveLength(1);
    expect(district29a[0].seatLabel).toBeNull();
    // Deterministic: lower Open States id wins ("6..." < "f...").
    expect(district29a[0].person.name).toBe("Joe McDonald");
  });

  it("handles a 3-member district (Maryland House of Delegates-style)", () => {
    const people = [
      person("id-3", "Third", "lower", "26"),
      person("id-1", "First", "lower", "26"),
      person("id-2", "Second", "lower", "26"),
    ];
    const out = assignLegislativeSeats([{ abbr: "MD" }], new Map([["MD", people]]));
    expect(out.map((s) => s.seatLabel).sort()).toEqual(["Seat 1", "Seat 2", "Seat 3"]);
  });

  it("is stable across repeated calls with the same input", () => {
    const people = [
      person("id-b", "Bergman", "lower", "1"),
      person("id-a", "Anders", "lower", "1"),
    ];
    const states = [{ abbr: "AZ" }];
    const sourcesMap = new Map([["AZ", people]]);
    const first = assignLegislativeSeats(states, sourcesMap);
    const second = assignLegislativeSeats(states, sourcesMap);
    expect(first).toEqual(second);
  });

  it("keeps chambers independent — a multi-member House doesn't force-split an untouched Senate", () => {
    const housePeople = [
      person("id-a", "Anders", "lower", "1"),
      person("id-b", "Bergman", "lower", "1"),
    ];
    const senatePeople = [person("id-s", "Solo Senator", "upper", "1")];
    const out = assignLegislativeSeats(
      [{ abbr: "AZ" }],
      new Map([["AZ", [...housePeople, ...senatePeople]]])
    );
    const senateSeat = out.find((s) => s.person.current_chamber === "upper");
    expect(senateSeat?.seatLabel).toBeNull();
  });
});
