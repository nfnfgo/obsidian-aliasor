import type { App } from "obsidian";
import { PluginSettingTab, Setting, TextComponent } from "obsidian";

import AliasorPlugin from "@/main";
import { AliasorModule } from "./general";
import { UtilModule } from "./util";

interface AliasorSettings {
    version: 1;
    aliases: Record<string, string>;
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
}

class AliasorSettingsTab extends PluginSettingTab {
    p: AliasorPlugin;
    a: App;
    settingsModule: SettingsModule;

    private sortCriteria: "alias" | "commandId" = "alias";
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
        // Create a container div for alias tiles
        let aliasTilesDiv = container.querySelector(
            ".aliasor-alias-tiles",
        ) as HTMLElement | null;
        if (!aliasTilesDiv) {
            aliasTilesDiv = container.createDiv({
                cls: "aliasor-alias-tiles",
            });
        }
        // Clear previous content
        aliasTilesDiv.empty();

        const aliases = this.settingsModule.settings.aliases;
        let entries = Object.entries(aliases);

        // Apply filter
        if (this.filterText) {
            entries = entries.filter(
                ([alias, commandId]) =>
                    UtilModule.isSubsequence(this.filterText, alias) ||
                    UtilModule.isSubsequence(this.filterText, commandId),
            );
        }

        // Apply sorting
        entries.sort((a, b) => {
            const key = this.sortCriteria === "alias" ? 0 : 1;
            const cmp = a[key].localeCompare(b[key]);
            return this.sortAscend ? cmp : -cmp;
        });
        if (entries.length === 0) {
            aliasTilesDiv.createEl("p", { text: "No aliases found." });
            return;
        }

        // Create tiles for each alias
        for (const [alias, value] of entries) {
            this._createAliasSettingTile(alias, value, aliasTilesDiv);
        }
    }

    /**
     * Create a single setting tile for an alias.
     */
    private _createAliasSettingTile(
        alias: string,
        commandId: string,
        parentDiv?: HTMLElement,
    ): void {
        const containerEl = parentDiv ?? this.containerEl;

        // Create a new setting for the alias
        new Setting(containerEl)
            .setName(commandId)
            .addText((text) => {
                const changeHandler = this._aliasChangeHandler(
                    alias,
                    commandId,
                    text,
                );

                text.setValue(alias);
                // use changeHandler to check everytime when input changes
                // but not update the value until blurred
                text.onChange((newAlias) => {
                    changeHandler(newAlias, false);
                });
                // add event listener to the input element to handle alias change
                // when input is blurred
                text.inputEl.addEventListener("blur", () => {
                    changeHandler(text.inputEl.value, true);
                });
            })
            .addButton((btn) => {
                btn.setButtonText("Delete").onClick(async () => {
                    delete this.settingsModule.settings.aliases[alias];
                    await this.settingsModule.saveSettings();
                    this.displayAliasTiles();
                });
            });
    }

    private _aliasChangeHandler(
        alias: string,
        value: string,
        textComponent?: TextComponent,
    ) {
        let prevAlias = alias;
        // Helper function to set error color
        function setErrorColor(isError: boolean) {
            if (textComponent) {
                const parent = textComponent.inputEl.parentElement;
                if (parent) {
                    if (isError) {
                        parent.classList.add("aliasor-error");
                    } else {
                        parent.classList.remove("aliasor-error");
                    }
                }
            }
        }

        return async (newAlias: string, update = false) => {
            // Remove error class by default
            setErrorColor(false);
            if (!newAlias || newAlias.trim() === "") {
                // new Notice("Alias cannot be empty.");
                setErrorColor(true);
                return;
            }
            if (newAlias === alias) return; // No change
            if (newAlias in this.settingsModule.settings.aliases) {
                // new Notice("Alias already exists.");
                setErrorColor(true);
                return;
            }
            if (!update) {
                return;
            }

            // Update alias
            this.settingsModule.settings.aliases[newAlias] = value;
            delete this.settingsModule.settings.aliases[prevAlias];
            await this.settingsModule.saveSettings();
            prevAlias = newAlias; // Update previous alias
            // Remove error class on success
            setErrorColor(false);
        };
    }

    private _displaySortTile(parentDiv?: HTMLElement): void {
        const container = parentDiv ?? this.containerEl;
        new Setting(container)
            .setName("Sort by")
            .addDropdown((dropdown) => {
                dropdown.addOption("alias", "Alias");
                dropdown.addOption("commandId", "Command ID");
                dropdown.setValue(this.sortCriteria);
                dropdown.onChange((value) => {
                    this.sortCriteria = value as "alias" | "commandId";
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
