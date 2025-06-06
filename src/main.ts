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
        settings: new SettingsModule(this),
        utils: new UtilModule(this),
        commands: new CommandsModule(this),
        errors: new ErrorUtilModule(this),
        i18n: new I18nModule(this),
    };

    // onload all modules
    async loadModules() {
        await this.modules.i18n.init();
        for (const module of Object.values(this.modules)) {
            await module.onload();
        }
    }

    async onload() {
        await this.loadModules();
    }

    onunload() {}
}
