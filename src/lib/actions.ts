"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/supabase";
import { RegisterSchema, ChangePasswordSchema } from "@/lib/validation";

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Create a new account, then sign in automatically.
 * Used with useActionState — returns an error string on failure, null on success
 * (success throws a redirect internally).
 */
export async function register(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const parsed = RegisterSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    homeDistrictId: formData.get("homeDistrictId"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { username, password, homeDistrictId } = parsed.data;

  // Username uniqueness check
  const { data: existing } = await db
    .from("Users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) return "Username already taken.";

  // District must exist
  const { data: district } = await db
    .from("Districts")
    .select("id")
    .eq("id", homeDistrictId)
    .maybeSingle();

  if (!district) return "Invalid home district. Please try again.";

  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await db.from("Users").insert({
    username,
    password_hash: passwordHash,
    home_district_id: homeDistrictId,
    home_district_set_at: new Date().toISOString(),
  });

  if (error) return "Failed to create account. Please try again.";

  // Auto-sign-in after registration
  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/ballot",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Account created. Please log in.";
    }
    throw error; // Re-throw redirect
  }

  return null;
}

// ─── Authenticate (login) ─────────────────────────────────────────────────────

/**
 * Sign in with username and password.
 * Used with useActionState on the login form.
 */
export async function authenticate(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/ballot";

  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid username or password.";
        default:
          return "Something went wrong. Please try again.";
      }
    }
    throw error; // Re-throw redirect
  }

  return null;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout() {
  await signOut({ redirectTo: "/" });
}

// ─── Get current user profile ─────────────────────────────────────────────────

export async function getUserProfileAction() {
  const session = await auth();
  if (!session) return { error: "Not authenticated." };

  const { data: user } = await db
    .from("Users")
    .select(
      "id, username, home_district_id, home_district_set_at, created_at"
    )
    .eq("id", session.user.id)
    .single();

  if (!user) return { error: "User not found." };

  // Get home district name if set
  let homeDistrict: { id: string; name: string; geo_slug: string } | null =
    null;
  if (user.home_district_id) {
    const { data } = await db
      .from("Districts")
      .select("id, name, geo_slug")
      .eq("id", user.home_district_id)
      .single();
    homeDistrict = data;
  }

  return {
    success: true,
    data: {
      id: user.id as string,
      username: user.username as string,
      homeDistrict,
      homeDistrictSetAt: user.home_district_set_at
        ? new Date(user.home_district_set_at as string)
        : null,
      createdAt: new Date(user.created_at as string),
    },
  };
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePasswordAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (!session) return "You must be logged in.";

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { currentPassword, newPassword } = parsed.data;

  const { data: user } = await db
    .from("Users")
    .select("password_hash")
    .eq("id", session.user.id)
    .single();

  if (!user?.password_hash) return "User not found.";

  const valid = await bcrypt.compare(currentPassword, user.password_hash as string);
  if (!valid) return "Current password is incorrect.";

  const newHash = await bcrypt.hash(newPassword, 10);

  const { error } = await db
    .from("Users")
    .update({ password_hash: newHash })
    .eq("id", session.user.id);

  if (error) return "Failed to update password. Please try again.";

  redirect("/settings?message=password-changed");
}

// ─── Delete account ───────────────────────────────────────────────────────────

/**
 * Soft-redacts the user. Posts remain in the archive but authorship is cleared.
 * Any active Witness seat is vacated.
 */
export async function deleteAccountAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await auth();
  if (!session) return "You must be logged in.";

  const confirmation = formData.get("confirm") as string;
  if (confirmation !== session.user.username) {
    return "Type your username to confirm deletion.";
  }

  const userId = session.user.id;
  const shortId = userId.slice(0, 8);

  // Redact user row
  await db
    .from("Users")
    .update({
      username: `[deleted-${shortId}]`,
      password_hash: null,
      home_district_id: null,
      home_district_set_at: null,
    })
    .eq("id", userId);

  // Clear authorship on posts (soft-delete kept for archive)
  await db.from("Posts").update({ author_id: null }).eq("author_id", userId);

  // Vacate any active Witness seat
  await db
    .from("Witnesses")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true);

  await signOut({ redirectTo: "/" });

  return null;
}
