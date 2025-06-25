import { FuzzySuggestModal, Notice } from "obsidian";
import type { App, Command, FuzzyMatch } from "obsidian";
import { AliasorModule } from "@/modules/general";
import { AliasInfo } from "./settings";
import { AliasorFuzzySuggestModal } from "@/modals/general";
import type { ObsidianCommandAPI } from "./types";

export class CommandsModule extends AliasorModule {
    public obsCmd: ObsidianCommandAPI;

    async onload() {
        // unsafe type conversion
        // this module are using undocumented Obsidian `app` API
        this.obsCmd = this.a.commands;

        this.p.addCommand({
            id: "exec-by-alias",
            name: this.p.modules.i18n.t("commandName.exec-by-alias"),
            callback: () => {
                this.aliasTriggerHandler();
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
    isCommandExists(commandId: string | undefined): boolean {
        if (commandId === undefined || commandId === null) {
            return false;
        }
        return !(this.getCommandById(commandId) === undefined);
    }

    /**
     * Check if an alias is callable. Will automatically use different criteria
     * based on the alias type.
     *
     * Returns:
     * - `true` if the alias is callable.
     * - `false` if the alias is not callable or the type of alias is not supported.
     */
    isAliasCallable(aliasInfo: AliasInfo): boolean {
        // if alias is a command alias, check if the command is callable
        if (aliasInfo.type == "command") {
            return this.isCommandCallable(aliasInfo.commandId);
        }

        // if alias is a file alias, check if the file exists
        if (aliasInfo.type == "file") {
            return this.p.modules.utils.isValidPath(aliasInfo.filePath);
        }

        return false;
    }

    /**
     * Check if a command is callable.
     *
     * If a command has a checkable callback, this method will perform the check process.
     * Read [Obsidian documentation](https://docs.obsidian.md/Reference/TypeScript+API/Command)
     * for more information about command callbacks.
     *
     * Returns:
     *
     * - `true` if the command is callable.
     * - `true` if command has no checkable callback.
     * - `false` if the command is not callable.
     * - `false` if the command does not exist.
     */
    isCommandCallable(commandId: string | undefined): boolean {
        if (!this.isCommandExists(commandId)) {
            return false;
        }

        // at this point, the commandId must not be undefined and the command must exist
        // so we can safely do the cast as follows
        const cmd = this.getCommandById(commandId as string) as Command;

        if (cmd.editorCheckCallback || cmd.editorCallback) {
            if (
                this.a.workspace.activeEditor === null ||
                this.a.workspace.activeEditor === undefined ||
                this.a.workspace.activeEditor.editor === null ||
                this.a.workspace.activeEditor.editor === undefined
            ) {
                // If the command has an editor callback, but no active editor, it is not callable
                return false;
            }

            if (cmd.editorCheckCallback) {
                const ret = cmd.editorCheckCallback(
                    true,
                    this.a.workspace.activeEditor.editor,
                    this.a.workspace.activeEditor,
                );
                if (ret === false) {
                    // If the editor check callback returns false, it is not callable
                    return false;
                }
            }

            return true;
        }

        if (cmd.checkCallback) {
            // If the command has a check callback, we need to call it
            const ret = cmd.checkCallback(true);
            if (ret === false) {
                // If the check callback returns false, it is not callable
                return false;
            }
            return true;
        }

        return true;
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

    /**
     * Open a modal to select a command by its alias, then execute that selected command.
     */
    aliasTriggerHandler() {
        new SelectAliasedCommandSuggestModal(
            this.p,
            (aliasInfo: AliasInfo) => {
                // const i18n = this.p.modules.i18n;
                if (aliasInfo.type === "command") {
                    this._triggerCommandAlias(aliasInfo);
                } else if (aliasInfo.type === "file") {
                    this._triggerFileAlias(aliasInfo);
                } else {
                    // new Notice(
                    //     i18n.t("settings.alias.exec.typeNotFound", {
                    //         type: aliasInfo.type,
                    //     }),
                    // );
                }
            },
            "Select an alias to execute...",
        ).open();
    }

    _triggerCommandAlias(aliasInfo: AliasInfo): void {
        if (aliasInfo.type !== "command") {
            return;
        }
        if (aliasInfo.command === undefined) {
            new Notice(
                `Command for alias "${aliasInfo.alias}" is not defined.`,
            );
            return;
        }
        this.executeCommandById(aliasInfo.commandId);
    }

    async _triggerFileAlias(aliasInfo: AliasInfo) {
        const util = this.p.modules.utils;
        const i18n = this.p.modules.i18n;

        // check before try opening file
        if (aliasInfo.type !== "file") {
            return;
        }
        if (aliasInfo.filePath === undefined) {
            new Notice(
                i18n.t("command.fileAlias.notExist", {
                    filepath: aliasInfo.filePath,
                }),
            );
            return;
        }
        if (aliasInfo.file === undefined) {
            new Notice(
                i18n.t("command.fileAlias.notExist", {
                    filepath: aliasInfo.filePath,
                }),
            );
            return;
        }

        // try opening file and show a notice
        try {
            await util.openFileInWorkspace(aliasInfo.file);
            new Notice(
                i18n.t("command.fileAlias.opened", {
                    filename: aliasInfo.file.name,
                }),
            );
        } catch (error) {
            new Notice(
                i18n.t("command.fileAlias.errorWhenOpen", {
                    filepath: aliasInfo.filePath,
                }),
            );
            console.error(error);
        }
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
        const settingsModule = this.p.modules.settings;
        const aliasInfo = item.item;
        const displayInfo = settingsModule.getAliasDisplayInfo(aliasInfo);

        el.createEl("div", { text: displayInfo.alias });
        el.createEl("small", { text: displayInfo.name });
    }

    getItems(): AliasInfo[] {
        const items = this.p.modules.settings.getAliases();

        // Only show callable commands if the corresponding setting is enabled
        const settingsModule = this.p.modules.settings;
        const commandsModule = this.p.modules.commands;

        // filter out non-callable aliases if the relevant setting is enabled
        if (settingsModule.settings.callableOnly) {
            return items.filter((item) => {
                return commandsModule.isAliasCallable(item);
            });
        }
        // otherwise, return all aliases
        return items;
    }

    getItemText(item: AliasInfo): string {
        return item.alias;
    }
}
