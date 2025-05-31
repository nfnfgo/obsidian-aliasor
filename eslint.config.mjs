import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["node_modules", "./*.mjs", "./main.js"] },
    { files: ["src/**/*.{ts,js,tsx,jsx}"] },
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    {
        rules: {
            "no-unused-vars": "off",
            "prefer-const": "error",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-empty-function": "off",
        },
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
);
