import globals from "globals";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Without this, no-unused-vars cannot see identifiers used only in JSX.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      /*
       * Data-fetch-on-mount effects legitimately call setState. The rule cannot
       * tell those apart from prop-to-state mirroring, which is the pattern it
       * exists to catch - that one we fix with a `key` instead, so this stays a
       * warning rather than a build-blocking error.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
