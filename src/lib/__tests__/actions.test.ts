import { describe, it, expect, vi } from "vitest";
import {
  q,
  loginAsTestUser,
  formData,
  getInserts,
  getUpdates,
  TEST_USER,
} from "@/test-utils/helpers";
import {
  register,
  authenticate,
  getUserProfileAction,
  changePasswordAction,
  deleteAccountAction,
} from "@/lib/actions";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

// ── register ────────────────────────────────────────────────────────────────

describe("register", () => {
  const validForm = () =>
    formData({
      username: "newuser",
      password: "securepassword123",
      homeDistrictId: "00000000-0000-0000-0000-000000000001",
    });

  it("rejects short username", async () => {
    const result = await register(
      null,
      formData({
        username: "ab",
        password: "securepassword123",
        homeDistrictId: "00000000-0000-0000-0000-000000000001",
      })
    );
    expect(result).toContain("at least 3 characters");
  });

  it("rejects short password", async () => {
    const result = await register(
      null,
      formData({
        username: "validuser",
        password: "short",
        homeDistrictId: "00000000-0000-0000-0000-000000000001",
      })
    );
    expect(result).toContain("at least 12 characters");
  });

  it("rejects duplicate username", async () => {
    q({ id: "existing-user" }); // username taken

    const result = await register(null, validForm());
    expect(result).toBe("Username already taken.");
  });

  it("rejects invalid district", async () => {
    q(null); // no existing user
    q(null); // district not found

    const result = await register(null, validForm());
    expect(result).toBe("Invalid home district. Please try again.");
  });

  it("creates account and auto-signs in", async () => {
    q(null); // no existing user
    q({ id: "d-001" }); // district exists
    q(null); // insert success

    vi.mocked(signIn).mockImplementationOnce(async () => {
      const err = new Error("NEXT_REDIRECT:/ballot");
      (err as any).digest = "NEXT_REDIRECT";
      throw err;
    });

    await expect(register(null, validForm())).rejects.toThrow("NEXT_REDIRECT");

    const inserts = getInserts("Users");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].row as any).username).toBe("newuser");
  });

  it("returns message if auto-login fails after registration", async () => {
    q(null); // no existing user
    q({ id: "d-001" }); // district exists
    q(null); // insert success

    vi.mocked(signIn).mockImplementationOnce(async () => {
      const err = new AuthError("test");
      err.type = "CredentialsSignin";
      throw err;
    });

    const result = await register(null, validForm());
    expect(result).toBe("Account created. Please log in.");
  });
});

// ── authenticate ────────────────────────────────────────────────────────────

describe("authenticate", () => {
  it("redirects on successful login", async () => {
    vi.mocked(signIn).mockImplementationOnce(async () => {
      const err = new Error("NEXT_REDIRECT:/ballot");
      (err as any).digest = "NEXT_REDIRECT";
      throw err;
    });

    const fd = formData({ username: "testuser", password: "securepassword123" });
    await expect(authenticate(null, fd)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("returns error for invalid credentials", async () => {
    vi.mocked(signIn).mockImplementationOnce(async () => {
      const err = new AuthError("test");
      err.type = "CredentialsSignin";
      throw err;
    });

    const fd = formData({ username: "testuser", password: "wrongpassword12" });
    const result = await authenticate(null, fd);
    expect(result).toBe("Invalid username or password.");
  });
});

// ── getUserProfileAction ────────────────────────────────────────────────────

describe("getUserProfileAction", () => {
  it("requires authentication", async () => {
    const result = await getUserProfileAction();
    expect(result).toEqual({ error: "Not authenticated." });
  });

  it("returns user profile with home district", async () => {
    loginAsTestUser();
    q({
      id: TEST_USER.id,
      username: "testuser",
      home_district_id: "d-001",
      home_district_set_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    }); // user row
    q({
      id: "d-001",
      name: "Wilmington",
      geo_slug: "nc/new-hanover/wilmington",
    }); // district row

    const result = await getUserProfileAction();
    expect(result).toHaveProperty("success", true);
    expect((result as any).data.username).toBe("testuser");
    expect((result as any).data.homeDistrict.name).toBe("Wilmington");
  });
});

// ── changePasswordAction ────────────────────────────────────────────────────

describe("changePasswordAction", () => {
  it("requires authentication", async () => {
    const result = await changePasswordAction(
      null,
      formData({
        currentPassword: "anything12345",
        newPassword: "newpassword12345",
        confirmPassword: "newpassword12345",
      })
    );
    expect(result).toBe("You must be logged in.");
  });

  it("rejects wrong current password", async () => {
    loginAsTestUser();
    q({ password_hash: "hashed_correctpassword123" }); // user with known hash

    const result = await changePasswordAction(
      null,
      formData({
        currentPassword: "wrongpassword123",
        newPassword: "newpassword12345",
        confirmPassword: "newpassword12345",
      })
    );
    expect(result).toBe("Current password is incorrect.");
  });

  it("changes password and redirects", async () => {
    loginAsTestUser();
    q({ password_hash: "hashed_oldpassword123" }); // user
    q(null); // update success

    const fd = formData({
      currentPassword: "oldpassword123",
      newPassword: "newpassword12345",
      confirmPassword: "newpassword12345",
    });
    await expect(changePasswordAction(null, fd)).rejects.toThrow(
      "NEXT_REDIRECT"
    );
  });
});

// ── deleteAccountAction ─────────────────────────────────────────────────────

describe("deleteAccountAction", () => {
  it("requires authentication", async () => {
    const result = await deleteAccountAction(
      null,
      formData({ confirm: "whatever" })
    );
    expect(result).toBe("You must be logged in.");
  });

  it("rejects wrong confirmation", async () => {
    loginAsTestUser();
    const result = await deleteAccountAction(
      null,
      formData({ confirm: "wrongname" })
    );
    expect(result).toBe("Type your username to confirm deletion.");
  });

  it("redacts user, clears posts, vacates witness seat", async () => {
    loginAsTestUser();
    q(null); // redact user
    q(null); // clear post authorship
    q(null); // vacate witness seat

    const result = await deleteAccountAction(
      null,
      formData({ confirm: TEST_USER.username })
    );
    expect(result).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });

    const userUpdates = getUpdates("Users");
    expect(userUpdates).toHaveLength(1);
    expect((userUpdates[0].row as any).username).toMatch(/\[deleted-/);
    expect((userUpdates[0].row as any).password_hash).toBeNull();
  });
});
