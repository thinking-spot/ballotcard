"use client";

import { useActionState, useState } from "react";
import { register } from "@/lib/actions";
import { DistrictPicker } from "./DistrictPicker";

export function SignupForm() {
  const [error, action, pending] = useActionState(register, null);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm text-bc-navy font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_\-]+"
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
        <p className="text-xs text-muted-foreground">
          3–30 characters. Letters, numbers, underscores, hyphens.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-bc-navy font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
        <p className="text-xs text-muted-foreground">
          At least 12 characters.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-bc-navy font-medium">Home district</p>
        <p className="text-xs text-muted-foreground mb-1">
          Your ballot card is built from this. You can change it later.
        </p>
        <DistrictPicker onSelect={setSelectedDistrictId} />
        <input
          type="hidden"
          name="homeDistrictId"
          value={selectedDistrictId}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !selectedDistrictId}
        className="bg-bc-navy text-bc-offwhite text-sm font-medium px-4 py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        No email. No tracking. No ads.{" "}
        <a href="/privacy" className="underline hover:text-bc-navy">
          Privacy
        </a>{" "}
        ·{" "}
        <a href="/terms" className="underline hover:text-bc-navy">
          Terms
        </a>
      </p>
    </form>
  );
}
