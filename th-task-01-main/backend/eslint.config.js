/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "joi",
              message: "Use zod only for validation.",
            },
            {
              name: "@hapi/joi",
              message: "Use zod only for validation.",
            },
            {
              name: "yup",
              message: "Use zod only for validation.",
            },
            {
              name: "ajv",
              message: "Use zod only for validation.",
            },
            {
              name: "superstruct",
              message: "Use zod only for validation.",

            },
          ],
        },
      ],
    },
  },
];

