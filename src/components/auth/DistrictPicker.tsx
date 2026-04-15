"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getStatesAction,
  getCountiesAction,
  getMunicipalitiesAction,
} from "@/lib/district-actions";

type Option = { id: string; name: string };

type Props = {
  /** Called when the user selects a final district. */
  onSelect: (districtId: string) => void;
};

export function DistrictPicker({ onSelect }: Props) {
  const [states, setStates] = useState<Option[]>([]);
  const [counties, setCounties] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);

  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");

  const [, startTransition] = useTransition();

  // Load states on mount
  useEffect(() => {
    startTransition(async () => {
      const data = await getStatesAction();
      setStates(data);
    });
  }, []);

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stateId = e.target.value;
    setSelectedState(stateId);
    setSelectedCounty("");
    setSelectedMunicipality("");
    setCounties([]);
    setMunicipalities([]);
    if (stateId) onSelect(stateId);

    startTransition(async () => {
      const data = await getCountiesAction(stateId);
      setCounties(data);
    });
  }

  function handleCountyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const countyId = e.target.value;
    setSelectedCounty(countyId);
    setSelectedMunicipality("");
    setMunicipalities([]);
    if (countyId) onSelect(countyId);

    startTransition(async () => {
      const data = await getMunicipalitiesAction(countyId);
      setMunicipalities(data);
    });
  }

  function handleMunicipalityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const munId = e.target.value;
    setSelectedMunicipality(munId);
    if (munId) {
      onSelect(munId);
    } else if (selectedCounty) {
      onSelect(selectedCounty);
    }
  }

  const selectClass =
    "border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender disabled:opacity-50 w-full";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-bc-navy font-medium">State</label>
        <select
          id="district-state"
          value={selectedState}
          onChange={handleStateChange}
          className={selectClass}
          required
        >
          <option value="">Select a state…</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {counties.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm text-bc-navy font-medium">County</label>
          <select
            id="district-county"
            value={selectedCounty}
            onChange={handleCountyChange}
            className={selectClass}
          >
            <option value="">Select a county…</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {municipalities.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm text-bc-navy font-medium">
            City or town{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="district-municipality"
            value={selectedMunicipality}
            onChange={handleMunicipalityChange}
            className={selectClass}
          >
            <option value="">No specific city (use county)</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
