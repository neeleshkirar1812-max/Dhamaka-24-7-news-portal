import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const authOptions: NextAuthOptions = {
  secret: env.nextAuthSecret || undefined,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const headersObj = req?.headers as Record<string, string | string[] | undefined> | undefined;
        const rawFwd = headersObj?.["x-forwarded-for"];
        const ip =
          (Array.isArray(rawFwd) ? rawFwd[0] : rawFwd)?.split(",")[0]?.trim() ||
          (typeof headersObj?.["x-real-ip"] === "string" ? headersObj["x-real-ip"] : "unknown");

        const rate = checkRateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
        if (!rate.allowed) {
          throw new Error(`Too many login attempts. Try again in ${Math.ceil(rate.retryAfterSeconds / 60)} minutes.`);
        }

        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        resetRateLimit(`login:${ip}`);
        return {
          id: user.id,
          email: user.email,
          role: "ADMIN",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string }).role = "ADMIN";
      }
      return session;
    },
  },
};

export async function getAdminSession() {
  return getServerSession(authOptions);
}
