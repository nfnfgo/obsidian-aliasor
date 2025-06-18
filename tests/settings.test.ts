import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SettingsModule } from "../src/modules/settings";
import * as fs from "fs";
import * as path from "path";

const DATA_PATH = path.resolve(__dirname, "../data.json");

// Helper to reset data.json to a known state
function writeDataJson(content: object) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(content, null, 2), "utf-8");
}

const defaultData = {
    version: 1,
    aliases: {
        addal: "aliasor:add-new-alias",
    },
};

describe("SettingsModule", () => {
    let settingsModule: SettingsModule;
    let pluginMock: any;

    beforeEach(async () => {
        // Reset data.json to default before each test
        writeDataJson(defaultData);
        // Mock plugin and dependencies
        pluginMock = {
            loadData: vi.fn(async () => defaultData),
            saveData: vi.fn(async (data) => writeDataJson(data)),
            modules: {
                commands: {
                    getCommandById: vi.fn((id) => id && { id, name: id }),
                },
                i18n: {
                    t: vi.fn((key) => key),
                },
            },
            addSettingTab: vi.fn(),
            addCommand: vi.fn(),
        };
        settingsModule = new SettingsModule(pluginMock);
        await settingsModule.onload();
    });

    afterEach(() => {
        // Clean up: reset data.json
        writeDataJson(defaultData);
    });

    it("loads default config correctly", async () => {
        expect(settingsModule.settings.version).toBe(1);
        expect(settingsModule.settings.aliases).toHaveProperty("addal");
    });

    it("merges aliases correctly", async () => {
        const newAliases = { foo: "bar", addal: "should-not-overwrite" };
        await settingsModule.mergeAliases(newAliases);
        expect(settingsModule.settings.aliases.foo).toBe("bar");
        // Existing alias should not be overwritten
        expect(settingsModule.settings.aliases.addal).toBe(
            "aliasor:add-new-alias",
        );
    });

    it("adds a new alias", async () => {
        await settingsModule.addAlias({ alias: "test", commandId: "cmd" });
        expect(settingsModule.settings.aliases.test).toBe("cmd");
    });

    it("throws if adding duplicate alias", async () => {
        await expect(
            settingsModule.addAlias({ alias: "addal", commandId: "cmd" }),
        ).rejects.toThrow();
    });

    it("updates an alias name", async () => {
        await settingsModule.addAlias({ alias: "old", commandId: "cmd" });
        await settingsModule.updateAlias("old", "new");
        expect(settingsModule.settings.aliases.new).toBe("cmd");
        expect(settingsModule.settings.aliases.old).toBeUndefined();
    });

    it("getAliasedCommands returns correct info", () => {
        const result = settingsModule.getAliases();
        expect(result.some((a) => a.alias === "addal")).toBe(true);
    });

    it("isAliasExists and isValidNewAlias work as expected", async () => {
        expect(settingsModule.isAliasExists("addal")).toBe(true);
        expect(settingsModule.isValidNewAlias("addal")).toBe(false);
        expect(settingsModule.isValidNewAlias("newalias")).toBe(true);
    });

    it("mergeAliases does not overwrite existing aliases", async () => {
        await settingsModule.addAlias({ alias: "foo", commandId: "bar" });
        await settingsModule.mergeAliases({
            foo: "baz",
            addal: "should-not-overwrite",
        });
        expect(settingsModule.settings.aliases.foo).toBe("bar");
        expect(settingsModule.settings.aliases.addal).toBe(
            "aliasor:add-new-alias",
        );
    });
});
