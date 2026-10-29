import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/theme-provider.tsx",
      "src/components/theme-toggle.tsx",
      "src/components/app-modal.tsx",
      "src/components/confirm-modal.tsx",
      "src/components/form-field.tsx",
      "src/components/locale-provider.tsx",
      "src/components/canvas/**/*.{ts,tsx}",
      "src/components/playground/**/*.{ts,tsx}",
      "src/components/preference-list.tsx",
      "src/components/currency-provider.tsx",
      "src/components/model-name-with-logo.tsx",
      "src/lib/canvas/**/*.{ts,tsx}",
      "src/lib/playground/**/*.{ts,tsx}",
      "src/lib/playground-*.ts",
      "src/lib/portal-session.ts",
      "src/lib/v1-client.ts",
      "src/hooks/use-portal-query.ts",
    ],
    rules: {
      // Ported from tu_api; overlay/theme animation patterns trip newer React hooks lint.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: [
      "src/lib/i18n-path.ts",
      "src/lib/tenant-login-redirect.ts",
      "src/lib/model-pricing.ts",
      "src/lib/canvas/canvas-dag-runner.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
