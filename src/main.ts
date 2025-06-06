// Entry point for the plugin
// All code from main.ts moved here
import { Plugin } from "obsidian";

import { SettingsModule } from "@/modules/settings";
import { UtilModule } from "@/modules/util";
import { CommandsModule } from "@/modules/commands";
import { ErrorUtilModule } from "@/modules/errors";
import { I18nModule } from "@/modules/i18n";

// Remember to rename these classes and interfaces!

export default class AliasorPlugin extends Plugin {
    // plugin modules
    public modules = {
        i18n: new I18nModule(this),
        utils: new UtilModule(this),
        errors: new ErrorUtilModule(this),
        settings: new SettingsModule(this),
        commands: new CommandsModule(this),
    };

    // onload all modules
    async loadModules() {
        await this.modules.i18n.init();
        for (const [name, module] of Object.entries(this.modules)) {
            try {
                await module.onload();
            } catch {
                console.log(`Aliasor module "${name}" failed to load`);
            }
        }
    }

    async onload() {
        await this.loadModules();
    }

    onunload() {}
}
