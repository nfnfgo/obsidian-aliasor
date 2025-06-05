import { FuzzySuggestModal, Notice } from "obsidian";
import type { App, Command, FuzzyMatch } from "obsidian";
import { AliasorModule } from "@/modules/general";
import { AliasInfo } from "./settings";
import { AliasorFuzzySuggestModal } from "@/modals/general";
import { ObsidianCommandAPI } from "./types";

export class CommandsModule extends AliasorModule {
    public obsCmd: ObsidianCommandAPI;

    async onload() {
        // unsafe type conversion
        // this module are using undocumented Obsidian `app` API
        this.obsCmd = this.a.commands;

        this.p.addCommand({
            id: "exec-by-alias",
            name: "Execute command by alias",
            callback: () => {
                this.execCommandHandler();
            },
        });
    }

    executeCommandById(commandId: string): void {
        if (commandId) {
            this.obsCmd.executeCommandById(commandId);
        }
    }

    getCommands(): Command[] {
        return Object.values(this.obsCmd.commands);
    }

    /**
     * Get command instance by it's ID. Return `undefined` if not exists.
     */
    getCommandById(commandId: string): Command | undefined {
        return this.obsCmd.commands[commandId];
    }

    /**
     * Check if a command exists in this vault.
     */
    isCommandExists(commandId: string): boolean {
        return !(this.getCommandById(commandId) === undefined);
    }

    /**
     * Open a modal to select a command from the list of available commands.
     * @param afterSelectionCallback Callback function to be called after a command is selected.
     */
    selectCommandByModal(afterSelectionCallback: (command: Command) => void) {
        const modal = new SelectCommandSuggestModal(
            this.a,
            this,
            afterSelectionCallback,
        );
        modal.open();
    }

    // TODO
    execCommandHandler() {
        new SelectAliasedCommandSuggestModal(
            this.p,
            (aliasInfo: AliasInfo) => {
                if (aliasInfo.commandId === undefined) {
                    new Notice(
                        `Command ID for alias "${aliasInfo.alias}" is not defined.`,
                    );
                    return;
                }
                if (!this.isCommandExists(aliasInfo.commandId)) {
                    new Notice(
                        `Command with ID "${aliasInfo.commandId}" does not exists in this vault.`,
                    );
                }
                this.executeCommandById(aliasInfo.commandId);
            },
            "Select an alias to execute...",
        ).open();
    }
}

/**
 * Modal for selecting a command from the list of available commands.
 *
 * This modal shall not be used directly, consider using `CommandsModule.selectCommandByModal`
 * to open the modal.
 */
class SelectCommandSuggestModal extends FuzzySuggestModal<Command> {
    constructor(
        private a: App,
        private m: CommandsModule,
        private cb: (command: Command) => void,
        protected msg?: string,
    ) {
        super(a);
        this.setPlaceholder(msg ?? "Select a command...");
    }

    getItems(): Command[] {
        return this.m.getCommands();
    }

    getItemText(item: Command): string {
        return item.name;
    }

    onChooseItem(item: Command): void {
        if (item) {
            this.cb(item);
        }
    }
}

class SelectAliasedCommandSuggestModal extends AliasorFuzzySuggestModal<AliasInfo> {
    placeholder = "Enter an alias...";

    renderSuggestion(item: FuzzyMatch<AliasInfo>, el: HTMLElement): void {
        el.createEl("div", {
            text: item.item.alias,
        });
        el.createEl("small", {
            text: item.item.commandName ?? "Unknown Command",
        });
    }

    getItems(): AliasInfo[] {
        return this.p.modules.settings.getAliasedCommands();
    }

    getItemText(item: AliasInfo): string {
        return item.alias;
    }
}
