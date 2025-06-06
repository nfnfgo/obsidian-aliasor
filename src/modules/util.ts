import { AliasorModule } from "./general";
import { moment } from "obsidian";

export class UtilModule extends AliasorModule {
    async onload() {}

    /**
     * Checks if the query string is a subsequence of the target string.
     * @param query The string to check as a subsequence.
     * @param target The string to check against.
     * @returns True if query is a subsequence of target, false otherwise.
     */
    static isSubsequence(query: string, target: string): boolean {
        let i = 0;
        for (const c of target) {
            if (query[i] === c) i++;
            if (i === query.length) return true;
        }
        return i === query.length;
    }

    /**
     * Returns the current Obsidian language setting. If failed to retrieve,
     * it defaults to "en".
     *
     * @returns The current Obsidian language code, e.g., "en", "fr", etc.
     */
    static getObsidianLanguage(): string {
        // Obsidian's language is stored in the app's settings
        return moment.locale() || "en";
    }
}
