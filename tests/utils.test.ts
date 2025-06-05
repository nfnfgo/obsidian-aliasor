import { describe, it, expect } from "vitest";
import { UtilModule } from "../src/modules/util";

describe("UtilModule.isSubsequence", () => {
    it("returns true for exact match", () => {
        expect(UtilModule.isSubsequence("abc", "abc")).toBe(true);
    });

    it("returns true for subsequence", () => {
        expect(UtilModule.isSubsequence("abc", "aXbYcZ")).toBe(true);
        expect(UtilModule.isSubsequence("ace", "abcde")).toBe(true);
    });

    it("returns false if not a subsequence", () => {
        expect(UtilModule.isSubsequence("acb", "abc")).toBe(false);
        expect(UtilModule.isSubsequence("xyz", "abcde")).toBe(false);
    });

    it("returns true for empty query", () => {
        expect(UtilModule.isSubsequence("", "abc")).toBe(true);
    });

    it("returns false for empty target but non-empty query", () => {
        expect(UtilModule.isSubsequence("a", "")).toBe(false);
    });

    it("returns true for both empty query and target", () => {
        expect(UtilModule.isSubsequence("", "")).toBe(true);
    });
});
