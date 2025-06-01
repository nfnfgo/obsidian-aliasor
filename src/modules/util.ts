import { AliasorModule } from "./general";

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
}
