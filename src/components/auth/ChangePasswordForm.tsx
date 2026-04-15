"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions";

export function ChangePasswordForm() {
  const [error, action, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="currentPassword"
          className="text-sm text-bc-navy font-medium"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="newPassword"
          className="text-sm text-bc-navy font-medium"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
        <p className="text-xs text-muted-foreground">At least 12 characters.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirmPassword"
          className="text-sm text-bc-navy font-medium"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="border border-bc-light-lavender rounded px-3 py-2 text-sm text-bc-navy bg-bc-offwhite focus:outline-none focus:ring-2 focus:ring-bc-lavender"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-bc-navy text-bc-offwhite text-sm font-medium px-4 py-2.5 rounded hover:opacity-90 transition-opacity disabled:opacity-50 self-start"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
