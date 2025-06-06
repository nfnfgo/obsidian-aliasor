import type { App, Command } from "obsidian";
import { PluginSettingTab, Setting, TextComponent, Notice } from "obsidian";

import AliasorPlugin from "@/main";
import { AliasorError } from "@/errors/general";

import { AliasorModule } from "./general";
import { UtilModule } from "./util";

import { AliasorConfirmModal } from "@/modals/general";

interface AliasorSettings {
    version: 1;
    /**
     * If true, only callable commands will be shown in the alias selection modal.
     */
    callableOnly: boolean;
    aliases: Record<string, string>;
}

export interface AliasInfo {
    alias: string;
    commandId?: string;
    commandName?: string;
    command?: Command;
}

const DEFAULT_SETTINGS: AliasorSettings = {
    version: 1,
    callableOnly: false,
    aliases: {
        addal: "aliasor:add-new-alias",
    },
};

class AliasorSettingError extends AliasorError {}
class SettingUpdateError extends AliasorSettingError {
    toReadableString(): string {
        return `Settings update failed: ${this.message}`;
    }
}
class SettingParseError extends AliasorSettingError {}

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
        this.p.addSettingTab(this.tab);

        this.p.addCommand({
            id: "add-new-alias",
            name: this.p.modules.i18n.t("commandName.add-new-alias"),
            callback: () => {
                this.addNewAliasCommandHandler();
            },
        });
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
        if (!this.isValidNewAlias(alias)) {
            throw new SettingUpdateError(
                `Alias "${alias}" is invalid or already used.`,
            );
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

    addNewAliasCommandHandler(onSuccess?: () => any): void {
        this.p.modules.commands.selectCommandByModal(async (command) => {
            if (!command) {
                new Notice("No command selected.");
                return;
            }
            const modal = new NewAliasInputModal(this.p);
            modal.commandId = command.id;
            modal.commandName = command.name;
            modal.onSuccess = onSuccess;
            modal.open();
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
    addInvalidNewAliasIndicatorToInput(
        text: TextComponent,
        original?: AliasInfo | undefined,
    ): void {
        const inputEl = text.inputEl;
        text.onChange(() => {
            if (original && inputEl.value === original.alias) {
                inputEl.parentElement?.classList.remove("aliasor-error");
            } else if (!this.isValidNewAlias(inputEl.value)) {
                inputEl.parentElement?.classList.add("aliasor-error");
            } else {
                inputEl.parentElement?.classList.remove("aliasor-error");
            }
        });
    }

    /**
     * Merge current aliases settings with new set of new aliases.
     *
     * Previously existed settings will always take precedence of
     * newly passed in aliases.
     * It could be considered that this method could add set of new
     * aliases into current settings without breaking/changing any
     * of currently working aliases.
     */
    async mergeAliases(newAliases: Record<string, string>) {
        const mergedAliases = {
            ...newAliases,
            ...this.settings.aliases,
        };
        this.settings.aliases = mergedAliases;
        await this.saveSettings();
    }

    async exportAliasesToClipboard() {
        const aliasesJson = JSON.stringify(this.settings.aliases);
        await navigator.clipboard.writeText(aliasesJson);
    }

    async mergeAliasesFromClipboard() {
        const clipboardText = await navigator.clipboard.readText();
        let newAliases;
        try {
            newAliases = JSON.parse(clipboardText);
        } catch {
            throw new SettingParseError(
                "Failed to parse aliases info from clipboard",
            );
        }
        await this.mergeAliases(newAliases);
    }
}

class AliasorSettingsTab extends PluginSettingTab {
    p: AliasorPlugin;
    a: App;
    settingsModule: SettingsModule;
    t: (key: string, options?: any) => string;

    private sortCriteria: "alias" | "commandId" | "commandName" = "alias";
    private sortAscend = true;
    private filterText = "";

    constructor(app: App, plugin: AliasorPlugin) {
        super(app, plugin);
        this.p = plugin;
        this.a = app;
        this.settingsModule = this.p.modules.settings;
        this.t = this.p.modules.i18n.t;
    }
    /**
     * Display the settings tab content.
     * This method is called when the settings tab is opened.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        this._displayGeneralSettings();
        this._displayConfigImportExport();
        this._displayAliasManagement();
        this._displayAbout();
    }

    private _displayGeneralSettings(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        container.createEl("h2", { text: this.t("settings.general.title") });
        new Setting(container)
            .setName(this.t("settings.general.callableOnly.name"))
            .setDesc(this.t("settings.general.callableOnly.desc"))
            .setTooltip(this.t("settings.general.callableOnly.tooltip"))
            .addToggle((toggle) => {
                toggle.setValue(this.settingsModule.settings.callableOnly);
                toggle.onChange(async (value) => {
                    this.settingsModule.settings.callableOnly = value;
                    await this.settingsModule.saveSettings();
                });
            });
    }

    private _displayConfigImportExport(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        container.createEl("h2", { text: this.t("settings.config.title") });
        new Setting(container)
            .setName(this.t("settings.config.export.name"))
            .setDesc(this.t("settings.config.export.desc"))
            .addButton((btn) => {
                btn.setButtonText(
                    this.t("settings.config.export.button"),
                ).onClick(async () => {
                    await this.settingsModule.exportAliasesToClipboard();
                    new Notice(this.t("settings.config.export.success"));
                });
            });
        new Setting(container)
            .setName(this.t("settings.config.import.name"))
            .setDesc(this.t("settings.config.import.desc"))
            .addButton((btn) => {
                btn.setButtonText(this.t("settings.config.import.button"))
                    .setCta()
                    .onClick(async () => {
                        try {
                            await this.settingsModule.mergeAliasesFromClipboard();
                            new Notice(
                                this.t("settings.config.import.success"),
                            );
                        } catch {
                            new Notice(this.t("settings.config.import.error"));
                        }
                    });
            });
    }

    private _displayAliasManagement(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        let aliasManagementDiv = container.querySelector(
            ".aliasor-alias-management",
        ) as HTMLElement | null;
        if (!aliasManagementDiv) {
            aliasManagementDiv = container.createDiv({
                cls: "aliasor-alias-management",
            });
        }
        aliasManagementDiv.empty();
        aliasManagementDiv.createEl("h2", {
            text: this.t("settings.alias.title"),
        });
        this._displayAddAliasTile(aliasManagementDiv);
        this._displaySortTile(aliasManagementDiv);
        this._displayFilterTile(aliasManagementDiv);
        this._displayAliasTiles(aliasManagementDiv);
    }

    /**
     * Display alias tiles based on the current settings, with
     * filtering and sorting applied.
     *
     * Call this method when the only part need to be updated is the alias tiles.
     */
    private _displayAddAliasTile(parentDiv: HTMLElement): void {
        new Setting(parentDiv)
            .setName(this.t("settings.alias.add.name"))
            .setDesc(this.t("settings.alias.add.desc"))
            .addButton((btn) => {
                btn.setCta()
                    .setButtonText(this.t("settings.alias.add.button"))
                    .onClick(() => {
                        this.settingsModule.addNewAliasCommandHandler();
                    });
            });
    }

    private _displaySortTile(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        new Setting(container)
            .setName(this.t("settings.alias.sort.name"))
            .addDropdown((dropdown) => {
                dropdown.addOption(
                    "alias",
                    this.t("settings.alias.sort.alias"),
                );
                dropdown.addOption(
                    "commandId",
                    this.t("settings.alias.sort.commandId"),
                );
                dropdown.addOption(
                    "commandName",
                    this.t("settings.alias.sort.commandName"),
                );
                dropdown.setValue(this.sortCriteria);
                dropdown.onChange((value) => {
                    this.sortCriteria = value as any;
                    this._displayAliasTiles();
                });
            })
            .addButton((btn) => {
                btn.setButtonText(
                    this.sortAscend
                        ? this.t("settings.alias.sort.ascend")
                        : this.t("settings.alias.sort.descend"),
                ).onClick(() => {
                    this.sortAscend = !this.sortAscend;
                    this._displayAliasManagement();
                });
            });
    }

    private _displayFilterTile(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        new Setting(container)
            .setName(this.t("settings.alias.filter.name"))
            .addText((text) => {
                text.setPlaceholder(
                    this.t("settings.alias.filter.placeholder"),
                );
                text.setValue(this.filterText);
                text.onChange((value) => {
                    this.filterText = value;
                    this._displayAliasTiles();
                });
            });
    }

    private _displayAliasTiles(parentDiv?: HTMLElement): void {
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
            aliasTilesDiv.createEl("p", {
                text: this.t("settings.alias.noAliases"),
            });
            return;
        }

        // Create tiles for each alias
        for (const info of entries) {
            this._createAliasSettingTile(info, aliasTilesDiv);
        }
    }

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
            .setName(
                command?.name ?? this.t("settings.alias.unrecognizedCommand"),
            )
            .setDesc(
                info.commandId ?? this.t("settings.alias.unknownCommandId"),
            )
            .addText((text) => {
                text.setValue(info.alias);
                this.settingsModule.addInvalidNewAliasIndicatorToInput(
                    text,
                    info,
                );
                text.inputEl.addEventListener("blur", () => {
                    this.settingsModule.updateAlias(
                        info.alias,
                        text.inputEl.value,
                    );
                    info.alias = text.inputEl.value;
                });
            })
            .addButton((btn) => {
                btn.setButtonText(this.t("settings.alias.delete")).onClick(
                    async () => {
                        delete this.settingsModule.settings.aliases[info.alias];
                        await this.settingsModule.saveSettings();
                        this._displayAliasTiles();
                    },
                );
            });
    }

    private _displayAbout(parentDiv?: HTMLElement) {
        const container = parentDiv ?? this.containerEl;
        container.createEl("h2", { text: this.t("settings.about.title") });

        const links = [
            {
                name: this.t("settings.about.bug.name"),
                desc: this.t("settings.about.bug.desc"),
                url: "https://github.com/nfnfgo/obsidian-aliasor/issues",
                btnText: this.t("settings.about.bug.button"),
            },
            {
                name: this.t("settings.about.doc.name"),
                desc: this.t("settings.about.doc.desc"),
                url: "https://github.com/nfnfgo/obsidian-aliasor/wiki",
                btnText: this.t("settings.about.doc.button"),
            },
        ];

        for (const link of links) {
            new Setting(container)
                .setName(link.name)
                .setDesc(link.desc)
                .addButton((btn) => {
                    btn.setButtonText(link.btnText).onClick(() =>
                        window.open(link.url, "_blank"),
                    );
                });
        }
    }
}

class NewAliasInputModal extends AliasorConfirmModal {
    title = this.p.modules.i18n.t("settings.alias.add.title");
    confirmText = this.p.modules.i18n.t("settings.alias.add.confirm");

    public aliasInput: TextComponent;
    public commandId: string;
    public commandName?: string;
    public onSuccess?: (() => void) | undefined;

    protected setBodyContent(contentEl: HTMLElement): void {
        contentEl.createEl("p", {
            text: this.p.modules.i18n.t("settings.alias.add.inputDesc", {
                command: this.commandName ?? "",
            }),
        });

        // show red input when alias invalid
        new Setting(this.contentEl)
            .setName(this.p.modules.i18n.t("settings.alias.add.inputLabel"))
            .addText((text) => {
                this.p.modules.settings.addInvalidNewAliasIndicatorToInput(
                    text,
                );
                this.aliasInput = text;
            });
    }

    public onConfirm?: (() => void) | undefined = () => {
        try {
            this.p.modules.settings.addAlias({
                alias: this.aliasInput.getValue().trim(),
                commandId: this.commandId,
            });
            new Notice(
                this.p.modules.i18n.t("settings.alias.add.success", {
                    alias: this.aliasInput.getValue(),
                }),
            );
            this.onSuccess?.();
        } catch (e) {
            this.p.modules.errors.errorHandler({ error: e });
        }
    };
}
