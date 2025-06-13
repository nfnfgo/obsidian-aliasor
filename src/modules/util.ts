import type { TFile } from "obsidian";
import { moment } from "obsidian";
import { AliasorModule } from "./general";

/**
 * Util functions for Aliasor.
 *
 * This module is also depend on a valid Obsidian `app` instance reference,
 * and could access some of Obsidian APIs. However, this module should NOT
 * depend on any other modules.
 */
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

    /**
     * Get file by its path.
     *
     * Return `TFile` if exists, otherwise `undefined`.
     */
    getFileByPath(path: string): TFile | undefined {
        return this.a.vault.getFileByPath(path) ?? undefined;
    }

    /**
     * Check if a path exists in this vault.
     */
    isValidPath(path: string): boolean {
        return this.getFileByPath(path) !== undefined;
    }

    /**
     * Get the currently active file in the Obsidian workspace.
     *
     * Return `TFile` if exists, otherwise `undefined`.
     */
    getCurrentFile(): TFile | undefined {
        return this.a.workspace.getActiveFile() ?? undefined;
    }
}
