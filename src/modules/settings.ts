import type { App, Command } from "obsidian";
import {
    PluginSettingTab,
    Setting,
    TextComponent,
    Notice,
    TFile,
} from "obsidian";

import AliasorPlugin from "@/main";
import { AliasorError } from "@/errors/general";

import { AliasorModule } from "./general";
import { UtilModule } from "./util";
import { KeyUpdateError } from "./util";

import { AliasorConfirmModal } from "@/modals/general";

interface AliasorSettings {
    /**
     * Current version of the settings schema.
     *
     * Version number should +1 when breaking changes are made.
     */
    version: 1;
    /**
     * If true, only callable commands will be shown in the alias selection modal.
     */
    callableOnly: boolean;
    /**
     * A map of aliases to command IDs.
     *
     * The key is the alias, and the value is the ID of the command it refers to.
     */
    aliases: Record<string, string>;
    /**
     * A map of file aliases to file paths.
     */
    fileAliases: Record<string, string>;
}

interface CommandAliasInfo {
    type: "command";
    alias: string;
    commandId: string;
    commandName?: string;
    command?: Command;
}

interface FileAliasInfo {
    type: "file";
    alias: string;
    filePath: string;
    file?: TFile;
}

export type AliasInfo = CommandAliasInfo | FileAliasInfo;

interface AliasDisplayInfo {
    /**The alias string */
    alias: string;
    /**
     * A string that should be readable to users and be a represents of the target.
     *
     * E.g. This field could be a command name or a file name etc.
     */
    name: string;
    /**
     * The unique identifier of the target of this alias.
     * This ID may not be directly readable to users.
     *
     * E.g. This field could be the command ID or a path to a file.
     */
    identifier: string;
}

const DEFAULT_SETTINGS: AliasorSettings = {
    version: 1,
    callableOnly: false,
    aliases: {
        addal: "aliasor:add-new-alias",
    },
    fileAliases: {},
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
        this.p.addCommand({
            id: "add-alias-for-current-file",
            name: this.p.modules.i18n.t(
                "commandName.add-alias-for-current-file",
            ),
            callback: () => {
                this.addAliasForCurrentFileHandler();
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

    /**
     * Get a list of alias of all types.
     * returned in an array of `AliasInfo` objects.
     *
     * For different types of aliases, this method will try to retrieve some
     * extra info based on `alias` if those info exists, such as `Command` instance
     * or a `TFile` instance.
     */
    getAliases(): AliasInfo[] {
        const aliases = this.settings.aliases;
        const aliasInfoList: AliasInfo[] = [];

        // add command aliases to return
        for (const [alias, commandId] of Object.entries(aliases)) {
            // try to retrieve and attach corresponding Command instance if exists
            const command = this.p.modules.commands.getCommandById(commandId);
            aliasInfoList.push({
                type: "command",
                alias,
                commandId,
                commandName: command?.name ?? undefined,
                command,
            });
        }

        // Add file aliases to return
        for (const [alias, filePath] of Object.entries(
            this.settings.fileAliases,
        )) {
            const file = this.p.modules.utils.getFileByPath(filePath);
            aliasInfoList.push({
                type: "file",
                alias,
                filePath,
                file,
            });
        }

        return aliasInfoList;
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

    /**
     * Add a new file alias.
     *
     * Will check before adding and throw `SettingUpdateError` if check failed.
     */
    async addFileAlias({
        alias,
        filePath,
    }: {
        alias: string;
        filePath: string;
    }): Promise<void> {
        if (!alias || !filePath) {
            throw new SettingUpdateError(
                "Alias and file path must be provided.",
            );
        }
        if (!this.isValidNewAlias(alias)) {
            throw new SettingUpdateError(
                `Alias "${alias}" is invalid or already used.`,
            );
        }
        if (!this.p.modules.utils.isValidPath(filePath)) {
            throw new SettingUpdateError(
                `File with path "${filePath}" does not exist.`,
            );
        }
        this.settings.fileAliases[alias] = filePath;
        await this.saveSettings();
    }

    /**
     * Update the alias string of an existing alias setting.
     *
     * Throw:
     *
     * - `SettingUpdateError` if failed to update the alias.
     *
     * Will show an Obsidian `Notice` on UI if the update is successful.
     */
    async updateAlias(oldAlias: string, newAlias: string): Promise<void> {
        const i18n = this.p.modules.i18n;

        // check before trying to update
        if (oldAlias === newAlias) {
            throw new SettingUpdateError(
                i18n.t("settings.alias.update.identical", {
                    alias: oldAlias,
                }),
            );
        }
        if (!this.isValidNewAlias(newAlias)) {
            throw new SettingUpdateError(
                i18n.t("settings.alias.update.invalid", {
                    alias: newAlias,
                }),
            );
        }

        let updated = false;

        // define a list of objects that storing all the aliases info
        const searchObjects = [
            this.settings.aliases,
            this.settings.fileAliases,
        ];

        for (const obj of searchObjects) {
            try {
                // will throw if key does not exist
                UtilModule.updateObjKey(oldAlias, newAlias, obj);
                updated = true;
                // once updated in one object, we can stop searching
                break;
            } catch (e) {
                if (e instanceof KeyUpdateError) {
                } else {
                    throw e;
                }
            }
        }

        if (!updated) {
            throw new SettingUpdateError(
                i18n.t("settings.alias.update.nonExist", {
                    alias: oldAlias,
                }),
            );
        }

        new Notice(
            i18n.t("settings.alias.update.updated", {
                oldAlias,
                newAlias,
            }),
        );

        await this.saveSettings();
    }

    /**
     * Return a set of info that used to display alias based on `AliasInfo` instance.
     *
     * This method will use the extra info reference like `Command` and `TFile` object ref
     * in the `AliasInfo` instance. And will NOT refetch those info based on alias settings.
     */
    getAliasDisplayInfo(aliasInfo: AliasInfo): AliasDisplayInfo {
        const i18n = this.p.modules.i18n;

        let dispName = "";
        let dispId = "";

        // Command types
        if (aliasInfo.type === "command") {
            dispId = aliasInfo.commandId;
            dispName =
                aliasInfo.commandName ??
                i18n.t("settings.alias.unrecognizedCommand");
        }
        // File types
        else if (aliasInfo.type === "file") {
            dispId = aliasInfo.filePath;
            dispName =
                aliasInfo.file?.name ??
                i18n.t("settings.alias.unrecognizedFile");
        }
        // Unknown types
        else {
            dispName = i18n.t("settings.alias.unknownAliasType");
            dispId = i18n.t("settings.alias.unknownAliasTypeDesc");
        }

        return { alias: aliasInfo.alias, name: dispName, identifier: dispId };
    }

    /**
     * Check if an alias exists in the settings. Check will include
     * all types of aliases.
     */
    isAliasExists(alias: string): boolean {
        if (alias in this.settings.aliases) {
            return true;
        } else if (alias in this.settings.fileAliases) {
            return true;
        }
        return false;
    }

    /**
     * Check if an alias is valid to be a new alias.
     * - Check alias is not empty.
     * - Check alias does not already exist.
     */
    isValidNewAlias(alias: string | undefined): boolean {
        if (!alias) return false;
        // Check if the alias is not empty and does not already exist
        return alias.trim() !== "" && !this.isAliasExists(alias);
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

    // trigger this function when user wants to add an alias for current active file for workspace
    addAliasForCurrentFileHandler() {
        const util = this.p.modules.utils;
        const activeFile = util.getCurrentFile();

        // no currently active file
        if (!activeFile) {
            new Notice(
                this.p.modules.i18n.t("settings.alias.addFile.noCurrentFile"),
            );
            return;
        }

        // use modal to input new alias for this file
        const modal = new NewFileAliasInputModal(this.p);
        modal.file = activeFile;
        modal.open();
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

    private sortCriteria: "alias" | "name" | "identifier" = "alias";
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
                            this._displayAliasManagement();
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
                        this.settingsModule.addNewAliasCommandHandler(() => {
                            this._displayAliasManagement();
                        });
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
                    this.t("settings.alias.sort.byAlias"),
                );
                dropdown.addOption(
                    "name",
                    this.t("settings.alias.sort.byName"),
                );
                dropdown.addOption(
                    "identifier",
                    this.t("settings.alias.sort.byIdentifier"),
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
        // find target div element
        const container = parentDiv ?? this.containerEl;
        let aliasTilesDiv = container.querySelector(
            ".aliasor-alias-tiles",
        ) as HTMLElement | null;
        if (!aliasTilesDiv) {
            aliasTilesDiv = container.createDiv({
                cls: "aliasor-alias-tiles",
            });
        }
        // clear previous content
        aliasTilesDiv.empty();

        // get all aliases
        let entries = this.settingsModule.getAliases();

        // apply filter
        if (this.filterText) {
            entries = entries.filter((info) => {
                if (info.type === "command") {
                    return (
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
                            ))
                    );
                } else if (info.type === "file") {
                    return (
                        UtilModule.isSubsequence(this.filterText, info.alias) ||
                        UtilModule.isSubsequence(this.filterText, info.filePath)
                    );
                }
                return false;
            });
        }

        // Apply sorting
        entries.sort((a, b) => {
            const settingsModule = this.settingsModule;
            const dispA = settingsModule.getAliasDisplayInfo(a);
            const dispB = settingsModule.getAliasDisplayInfo(b);

            let aKey = "";
            let bKey = "";
            if (this.sortCriteria === "alias") {
                aKey = dispA.alias;
                bKey = dispB.alias;
            } else if (this.sortCriteria === "name") {
                aKey = dispA.name;
                bKey = dispB.name;
            } else {
                aKey = dispA.identifier;
                bKey = dispB.identifier;
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
            this._displayAliasSettingTile(info, aliasTilesDiv);
        }
    }

    private _displayAliasSettingTile(
        info: AliasInfo,
        parentDiv?: HTMLElement,
    ): void {
        const { name, identifier } =
            this.settingsModule.getAliasDisplayInfo(info);

        // Create a new setting for the alias
        const containerEl = parentDiv ?? this.containerEl;
        new Setting(containerEl)
            .setName(name)
            .setDesc(identifier)
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

/**
 * Usage:
 *
 * - set `commandId` property to the ID of the command you want to add an alias for.
 * - set `commandName` property to the name of the command (optional).
 * - Call `open()` to show the modal.
 *
 * Advanced:
 * - set `onSuccess` property to a callback function
 *   that will be called after a successful alias addition (optional).
 * - Override `onConfirm` if needed (will invalidate `onSuccess`).
 */
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

/**
 * Usage:
 *
 * - Set `file` property to the file you want to create an alias for.
 * - Call `open()` to show the modal.
 *
 * Unless `onConfirm` is overridden, this modal will add new alias settings
 * after a successful user input and confirmation.
 */
class NewFileAliasInputModal extends AliasorConfirmModal {
    title = this.p.modules.i18n.t("settings.alias.addFile.title");
    confirmText = this.p.modules.i18n.t("settings.alias.add.confirm");

    public file: TFile;
    public onSuccess?: (() => void) | undefined;
    public aliasInput: TextComponent;

    protected setBodyContent(contentEl: HTMLElement): void {
        // make sure this.file is set
        if (!(this.file instanceof TFile)) {
            throw new AliasorSettingError(
                "Could not continue process since modal doesn't receive valid TFile instance",
            );
        }

        contentEl.createEl("p", {
            text: this.p.modules.i18n.t("settings.alias.addFile.inputDesc", {
                filename: this.file.name,
            }),
        });

        // show red input when alias invalid
        new Setting(this.contentEl)
            .setName(this.p.modules.i18n.t("settings.alias.addFile.inputLabel"))
            .addText((text) => {
                this.p.modules.settings.addInvalidNewAliasIndicatorToInput(
                    text,
                );
                this.aliasInput = text;
            });
    }

    public onConfirm?: (() => void) | undefined = () => {
        const newAlias = this.aliasInput.getValue().trim();
        try {
            this.p.modules.settings.addFileAlias({
                alias: newAlias,
                filePath: this.file.path,
            });
            new Notice(
                this.p.modules.i18n.t("settings.alias.addFile.success", {
                    alias: newAlias,
                }),
            );
            this.onSuccess?.();
        } catch (e) {
            this.p.modules.errors.errorHandler({ error: e });
        }
    };
}
