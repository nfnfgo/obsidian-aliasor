import type { App, Command } from "obsidian";
import { PluginSettingTab, Setting, TextComponent, Modal } from "obsidian";

import AliasorPlugin from "@/main";
import { AliasorError } from "@/errors/general";

import { AliasorModule } from "./general";
import { UtilModule } from "./util";

interface AliasorSettings {
    version: 1;
    aliases: Record<string, string>;
}

interface AliasInfo {
    alias: string;
    commandId?: string;
    commandName?: string;
    command?: Command;
}

const DEFAULT_SETTINGS: AliasorSettings = {
    version: 1,
    aliases: {
        mkal: "add-alias",
        rmal: "remove-alias",
        edital: "edit-alias",
        lsal: "list-aliases",
        findal: "find-alias",
        helpal: "help-alias",
        showal: "show-alias",
        copyal: "copy-alias",
        moveal: "move-alias",
        exportal: "export-alias",
        importal: "import-alias",
        syncal: "sync-alias",
        resetal: "reset-alias",
        enableal: "enable-alias",
        disableal: "disable-alias",
        backupal: "backup-alias",
        restoreal: "restore-alias",
        searchal: "search-alias",
        sortal: "sort-alias",
        mergeal: "merge-alias",
        splital: "split-alias",
        renameal: "rename-alias",
    },
};

class AliasorSettingError extends AliasorError {}
class SettingUpdateError extends AliasorSettingError {
    toReadableString(): string {
        return `Settings update failed: ${this.message}`;
    }
}

interface AddAliasParams {
    /**
     * The alias of the newly added command.
     */
    alias: string;
    /**
     * The ID of the command to be aliased.
     */
    commandId: string;
    /**
     * Check if the command with the specified ID exists before adding the alias.
     */
    check?: boolean;
}

export class SettingsModule extends AliasorModule {
    settings: AliasorSettings;
    tab: AliasorSettingsTab;

    async onload() {
        await this.loadSettings();
        this.tab = new AliasorSettingsTab(this.a, this.p);
        console.log("adding tab");
        this.p.addSettingTab(this.tab);
    }

    async loadSettings(): Promise<AliasorSettings> {
        // Object assign will only use shallow copy
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.p.loadData(),
        );
        return this.settings as AliasorSettings;
    }

    async saveSettings(): Promise<void> {
        await this.p.saveData(this.settings);
    }

    getAliasedCommands(): AliasInfo[] {
        const aliases = this.settings.aliases;
        const aliasedCommands: AliasInfo[] = [];

        for (const [alias, commandId] of Object.entries(aliases)) {
            const command = this.p.modules.commands.getCommandById(commandId);
            if (command) {
                aliasedCommands.push({
                    alias,
                    commandId,
                    commandName: command.name,
                    command,
                });
            } else {
                // If the command is not found, still include the alias
                aliasedCommands.push({ alias, commandId });
            }
        }

        return aliasedCommands;
    }

    /**
     * Adds a new alias for a commmand.
     */
    async addAlias({
        alias,
        commandId,
        check = true,
    }: AddAliasParams): Promise<void> {
        if (!alias || !commandId) {
            throw new SettingUpdateError(
                "Alias and command ID must be provided.",
            );
        }
        if (this.settings.aliases[alias]) {
            throw new SettingUpdateError(`Alias "${alias}" already used.`);
        }
        if (check && !this.p.modules.commands.getCommandById(commandId)) {
            throw new SettingUpdateError(
                `Command with ID "${commandId}" does not exist.`,
            );
        }
        this.settings.aliases[alias] = commandId;
        await this.saveSettings();
    }

    async updateAlias(oldAlias: string, newAlias: string): Promise<void> {
        if (!this.settings.aliases[oldAlias]) {
            throw new SettingUpdateError(`Alias "${oldAlias}" does not exist.`);
        }
        if (this.settings.aliases[newAlias]) {
            throw new SettingUpdateError(`Alias "${newAlias}" already exists.`);
        }
        this.settings.aliases[newAlias] = this.settings.aliases[oldAlias];
        delete this.settings.aliases[oldAlias];
        await this.saveSettings();
    }

    // TODO
    addNewAliasCommandHandler() {
        let selectedCommand: Command | undefined = undefined;
        this.p.modules.commands.selectCommandByModal(async (command) => {
            if (!command) return;
            selectedCommand = command;
            // use a new modal to get the alias from the user
        });
    }

    isAliasExists(alias: string): boolean {
        return alias in this.settings.aliases;
    }

    isValidNewAlias(alias: string | undefined): boolean {
        if (!alias) return false;
        // Check if the alias is not empty and does not already exist
        return alias.trim() !== "" && !this.isAliasExists(alias);
    }

    /**
     * A util method.
     *
     * Add a onChange event listener to the input element
     * which will change input color to red if the input alias
     * already exist.
     */
    addInvalidNewAliasIndicatorToInput(text: TextComponent): void {
        const inputEl = text.inputEl;
        text.onChange(() => {
            console.log("On change triggered");
            if (!this.isValidNewAlias(inputEl.value)) {
                inputEl.parentElement?.classList.add("aliasor-error");
            } else {
                inputEl.parentElement?.classList.remove("aliasor-error");
            }
        });
    }
}

class AliasorSettingsTab extends PluginSettingTab {
    p: AliasorPlugin;
    a: App;
    settingsModule: SettingsModule;

    private sortCriteria: "alias" | "commandId" | "commandName" = "alias";
    private sortAscend = true;
    private filterText = "";

    constructor(app: App, plugin: AliasorPlugin) {
        super(app, plugin);
        this.p = plugin;
        this.a = app;
        this.settingsModule = this.p.modules.settings;
    }
    /**
     * Display the settings tab content.
     * This method is called when the settings tab is opened.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        this.displayAliasManagement();
    }

    /**
     * Display the alias management section (title, sort/filter, and alias tiles) in a container div.
     */
    private displayAliasManagement(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;

        // Create or get the main alias management container
        let aliasManagementDiv = container.querySelector(
            ".aliasor-alias-management",
        ) as HTMLElement | null;
        if (!aliasManagementDiv) {
            aliasManagementDiv = container.createDiv({
                cls: "aliasor-alias-management",
            });
        }

        aliasManagementDiv.empty();
        aliasManagementDiv.createEl("h1", { text: "Alias Management" });

        this._displayAddAliasTile(aliasManagementDiv);

        aliasManagementDiv.createEl("h2", { text: "Sort & Filter" });
        this._displaySortTile(aliasManagementDiv);
        this._displayFilterTile(aliasManagementDiv);
        aliasManagementDiv.createEl("h2", { text: "Aliases" });
        this.displayAliasTiles(aliasManagementDiv);
    }

    /**
     * Display alias tiles based on the current settings, with
     * filtering and sorting applied.
     *
     * Call this method when the only part need to be updated is the alias tiles.
     * Optionally accepts a parent div to render into.
     */
    private displayAliasTiles(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        let aliasTilesDiv = container.querySelector(
            ".aliasor-alias-tiles",
        ) as HTMLElement | null;
        if (!aliasTilesDiv) {
            aliasTilesDiv = container.createDiv({
                cls: "aliasor-alias-tiles",
            });
        }
        aliasTilesDiv.empty();

        let entries = this.settingsModule.getAliasedCommands();

        // Apply filter
        if (this.filterText) {
            entries = entries.filter(
                (info) =>
                    UtilModule.isSubsequence(this.filterText, info.alias) ||
                    (info.commandId &&
                        UtilModule.isSubsequence(
                            this.filterText,
                            info.commandId,
                        )) ||
                    (info.commandName &&
                        UtilModule.isSubsequence(
                            this.filterText,
                            info.commandName,
                        )),
            );
        }

        // Apply sorting
        entries.sort((a, b) => {
            let aKey = "",
                bKey = "";
            if (this.sortCriteria === "alias") {
                aKey = a.alias;
                bKey = b.alias;
            } else if (this.sortCriteria === "commandId") {
                aKey = a.commandId ?? "";
                bKey = b.commandId ?? "";
            } else if (this.sortCriteria === "commandName") {
                aKey = a.commandName ?? "";
                bKey = b.commandName ?? "";
            }
            const cmp = aKey.localeCompare(bKey);
            return this.sortAscend ? cmp : -cmp;
        });
        if (entries.length === 0) {
            aliasTilesDiv.createEl("p", { text: "No aliases found." });
            return;
        }

        // Create tiles for each alias
        for (const info of entries) {
            this._createAliasSettingTile(info, aliasTilesDiv);
        }
    }

    /**
     * Create a single setting tile for an alias.
     */
    private _createAliasSettingTile(
        info: AliasInfo,
        parentDiv?: HTMLElement,
    ): void {
        const containerEl = parentDiv ?? this.containerEl;
        const command =
            info.command ??
            (info.commandId
                ? this.p.modules.commands.getCommandById(info.commandId)
                : undefined);
        // Create a new setting for the alias
        new Setting(containerEl)
            .setName(command?.name ?? "[Unrecognized Command]")
            .setDesc(info.commandId ?? "[unknown-command-id]")
            .addText((text) => {
                text.setValue(info.alias);
                this.settingsModule.addInvalidNewAliasIndicatorToInput(text);
                text.inputEl.addEventListener("blur", () => {
                    this.settingsModule.updateAlias(
                        info.alias,
                        text.inputEl.value,
                    );
                    info.alias = text.inputEl.value;
                });
            })
            .addButton((btn) => {
                btn.setButtonText("Delete").onClick(async () => {
                    delete this.settingsModule.settings.aliases[info.alias];
                    await this.settingsModule.saveSettings();
                    this.displayAliasTiles();
                });
            });
    }

    // private _aliasChangeHandler(
    //     alias: string,
    //     value: string,
    //     textComponent?: TextComponent,
    // ) {
    //     let prevAlias = alias;

    //     return async (newAlias: string, update = false) => {
    //         if (!this.settingsModule.isValidNewAlias(newAlias) || !update) {
    //             return;
    //         }

    //         // Update alias
    //         this.settingsModule.settings.aliases[newAlias] = value;
    //         delete this.settingsModule.settings.aliases[prevAlias];
    //         await this.settingsModule.saveSettings();
    //         prevAlias = newAlias; // Update previous alias
    //     };
    // }

    private _displayAddAliasTile(parentDiv: HTMLElement): void {
        new Setting(parentDiv)
            .setName("Add New Alias")
            .setDesc("Add a new alias for a command.")
            .addButton((btn) => {
                btn.setCta()
                    .setButtonText("New")
                    .onClick(() => {
                        this.p.modules.commands.selectCommandByModal(
                            async (command) => {
                                if (!command) return;
                                const alias = command.id;
                                // Prevent duplicate alias
                                if (
                                    this.settingsModule.settings.aliases[alias]
                                ) {
                                    // Optionally show a notice here
                                    return;
                                }
                                this.settingsModule.settings.aliases[alias] =
                                    command.id;
                                await this.settingsModule.saveSettings();
                                this.displayAliasTiles(parentDiv);
                            },
                        );
                    });
            });
    }

    private _displaySortTile(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        new Setting(container)
            .setName("Sort by")
            .addDropdown((dropdown) => {
                dropdown.addOption("alias", "Alias");
                dropdown.addOption("commandId", "Command ID");
                dropdown.addOption("commandName", "Command Name");
                dropdown.setValue(this.sortCriteria);
                dropdown.onChange((value) => {
                    this.sortCriteria = value as
                        | "alias"
                        | "commandId"
                        | "commandName";
                    this.displayAliasTiles(parentDiv);
                });
            })
            .addButton((btn) => {
                btn.setButtonText(
                    this.sortAscend ? "Ascend" : "Descend",
                ).onClick(() => {
                    this.sortAscend = !this.sortAscend;
                    this.displayAliasManagement();
                });
            });
    }

    private _displayFilterTile(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        new Setting(container).setName("Filter").addText((text) => {
            text.setPlaceholder("Type to filter...");
            text.setValue(this.filterText);
            text.onChange((value) => {
                this.filterText = value;
                this.displayAliasTiles(parentDiv);
            });
        });
    }
}

class NewAliasInputModal extends Modal {
    onSubmit: (alias: string) => any;

    constructor(
        app: App,
        onSubmit: (alias: string) => any,
        commandName?: string,
    ) {
        super(app);
        this.onSubmit = onSubmit;
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Enter Alias" });
        contentEl.createEl("p", {
            text: `Please enter a new alias for the command ${commandName ?? ""}`,
        });

        // TODO
        new Setting(this.contentEl)
            .setName("Name")
            .addText((text) => text.onChange((value) => {}));

        new Setting(contentEl)
            // .addButton((btn) => {
            //     btn.setCta();
            //     btn.setButtonText("OK").onClick(() => {
            //         this.onSubmit(this.aliasInput.getValue().trim());
            //     });
            // })
            .addButton((btn) => {
                btn.setButtonText("Cancel").onClick(() => {
                    this.close();
                });
            });
    }
}
