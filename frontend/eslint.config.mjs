import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["app/**/*.{js,jsx}", "components/**/*.{js,jsx}", "layers/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/lib/*",
            "@/store/*",
            "@/hooks/*",
            "@/components/accounts/AccountLayout",
            "@/components/dashboard/dashboardlayout",
            "@/components/layout/PanelLayout",
          ],
        },
      ],
    },
  },
  {
    files: ["layers/application/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/presentation/*"],
        },
      ],
    },
  },
  {
    files: ["layers/infrastructure/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/presentation/*", "@/application/*"],
        },
      ],
    },
  },
]);

export default eslintConfig;
