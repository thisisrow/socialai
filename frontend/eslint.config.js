import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react-refresh/only-export-components": "warn",
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
  pluginJs.configs.recommended,
  pluginReactConfig,
];