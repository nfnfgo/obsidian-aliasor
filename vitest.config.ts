import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
    test: {},
    resolve: {
        alias: {
            obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
            "@": path.resolve(__dirname, "src"),
        },
    },
});
