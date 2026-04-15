import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { LoginSchema } from "@/lib/validation";

// Type augmentation for custom session fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      homeDistrictId?: string;
    };
  }
  interface User {
    username: string;
    homeDistrictId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username: string;
    homeDistrictId?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;

        const { data: user } = await db
          .from("Users")
          .select("id, username, password_hash, home_district_id")
          .eq("username", username)
          .single();

        if (!user?.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id as string,
          username: user.username as string,
          homeDistrictId: (user.home_district_id as string) ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.username = user.username;
        token.homeDistrictId = user.homeDistrictId;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        username: token.username,
        homeDistrictId: token.homeDistrictId,
      };
      return session;
    },
  },
});
