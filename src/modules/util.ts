import type { AliasorModule } from "./general";

export class UtilModule {
    static isSubsequence(query: string, target: string): boolean {
        let i = 0;
        for (const c of target) {
            if (query[i] === c) i++;
            if (i === query.length) return true;
        }
        return i === query.length;
    }
}
