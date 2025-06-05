import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandsModule } from "../src/modules/commands";
import type { Command } from "obsidian";

function makeCommand(overrides: Partial<Command> = {}): Command {
    return {
        id: "test-cmd",
        name: "Test Command",
        ...overrides,
    } as Command;
}

describe("CommandsModule", () => {
    let pluginMock: any;
    let commandsModule: CommandsModule;
    let command: Command;

    beforeEach(() => {
        command = makeCommand();
        pluginMock = {
            app: {
                commands: {
                    commands: { "test-cmd": command },
                    executeCommandById: vi.fn(),
                },
                workspace: {
                    activeEditor: { editor: {} },
                },
            },
            addCommand: vi.fn(),
        };
        commandsModule = new CommandsModule(pluginMock);
        commandsModule.obsCmd = pluginMock.app.commands;
    });

    it("getCommandById returns the command if exists", () => {
        expect(commandsModule.getCommandById("test-cmd")).toBe(command);
    });

    it("isCommandExists returns true for existing command", () => {
        expect(commandsModule.isCommandExists("test-cmd")).toBe(true);
    });

    it("isCommandExists returns false for non-existing command", () => {
        expect(commandsModule.isCommandExists("not-exist")).toBe(false);
    });

    it("isCommandCallable returns true for simple command", () => {
        expect(commandsModule.isCommandCallable("test-cmd")).toBe(true);
    });

    it("isCommandCallable returns false if command does not exist", () => {
        expect(commandsModule.isCommandCallable("not-exist")).toBe(false);
    });

    it("isCommandCallable returns false if editor callback but no active editor", () => {
        const cmd = makeCommand({ editorCallback: vi.fn() });
        pluginMock.app.commands.commands["editor-cmd"] = cmd;
        pluginMock.app.workspace.activeEditor = null;
        expect(commandsModule.isCommandCallable("editor-cmd")).toBe(false);
    });

    it("isCommandCallable returns false if editorCheckCallback returns false", () => {
        const cmd = makeCommand({
            editorCheckCallback: vi.fn(() => false),
        });
        pluginMock.app.commands.commands["editor-cmd"] = cmd;
        expect(commandsModule.isCommandCallable("editor-cmd")).toBe(false);
    });

    it("isCommandCallable returns true if editorCheckCallback returns true", () => {
        const cmd = makeCommand({
            editorCheckCallback: vi.fn(() => true),
        });
        pluginMock.app.commands.commands["editor-cmd"] = cmd;
        expect(commandsModule.isCommandCallable("editor-cmd")).toBe(true);
    });

    it("isCommandCallable returns false if checkCallback returns false", () => {
        const cmd = makeCommand({ checkCallback: vi.fn(() => false) });
        pluginMock.app.commands.commands["check-cmd"] = cmd;
        expect(commandsModule.isCommandCallable("check-cmd")).toBe(false);
    });

    it("isCommandCallable returns true if checkCallback returns true", () => {
        const cmd = makeCommand({ checkCallback: vi.fn(() => true) });
        pluginMock.app.commands.commands["check-cmd"] = cmd;
        expect(commandsModule.isCommandCallable("check-cmd")).toBe(true);
    });

    it("executeCommandById calls obsCmd.executeCommandById", () => {
        commandsModule.executeCommandById("test-cmd");
        expect(pluginMock.app.commands.executeCommandById).toHaveBeenCalledWith(
            "test-cmd",
        );
    });

    it("getCommands returns all commands", () => {
        expect(commandsModule.getCommands()).toContain(command);
    });

    it("respects priority: editorCheckCallback > editorCallback > checkCallback > callback", () => {
        // editorCheckCallback returns false, checkCallback returns true: should be false
        const cmd1 = makeCommand({
            editorCheckCallback: vi.fn(() => false),
            checkCallback: vi.fn(() => true),
        });
        pluginMock.app.commands.commands["cmd1"] = cmd1;
        expect(commandsModule.isCommandCallable("cmd1")).toBe(false);

        // editorCheckCallback returns true, checkCallback returns false: should be true
        const cmd2 = makeCommand({
            editorCheckCallback: vi.fn(() => true),
            checkCallback: vi.fn(() => false),
        });
        pluginMock.app.commands.commands["cmd2"] = cmd2;
        expect(commandsModule.isCommandCallable("cmd2")).toBe(true);

        // editorCallback exists, checkCallback returns false: should be true (editorCallback present, no check)
        const cmd3 = makeCommand({
            editorCallback: vi.fn(),
            checkCallback: vi.fn(() => false),
        });
        pluginMock.app.commands.commands["cmd3"] = cmd3;
        expect(commandsModule.isCommandCallable("cmd3")).toBe(true);

        // checkCallback returns false, callback returns true: should be false
        const cmd4 = makeCommand({
            checkCallback: vi.fn(() => false),
            callback: vi.fn(() => true),
        });
        pluginMock.app.commands.commands["cmd4"] = cmd4;
        expect(commandsModule.isCommandCallable("cmd4")).toBe(false);

        // Only callback exists: should be true
        const cmd5 = makeCommand({
            callback: vi.fn(() => true),
        });
        pluginMock.app.commands.commands["cmd5"] = cmd5;
        expect(commandsModule.isCommandCallable("cmd5")).toBe(true);
    });
});
