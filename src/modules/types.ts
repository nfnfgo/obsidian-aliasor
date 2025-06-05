import type { Command } from "obsidian";

export interface ObsidianCommandAPI {
    commands: Record<string, Command>;
    executeCommandById(commandId: string): void;
}
