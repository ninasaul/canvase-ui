import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
