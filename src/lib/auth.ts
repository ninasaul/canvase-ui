import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

/**
 * Social providers are opt-in: each one appears in the UI only when both its
 * client id and secret are present, so a self-hosted instance without OAuth
 * keeps the email + password flow and nothing breaks.
 */
const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID?.trim() &&
  process.env.GOOGLE_CLIENT_SECRET?.trim()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID.trim(),
          clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
        },
      }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID?.trim() &&
  process.env.GITHUB_CLIENT_SECRET?.trim()
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID.trim(),
          clientSecret: process.env.GITHUB_CLIENT_SECRET.trim(),
        },
      }
    : {}),
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
  emailAndPassword: {
    enabled: true,
    // Enforced server-side as well as in the form.
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    // Long-lived sessions for a self-hosted tool; refreshed once per day.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 40,
    customRules: {
      // Brute-force protection on the two credential endpoints.
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 300, max: 5 },
    },
  },
});
