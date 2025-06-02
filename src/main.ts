// Entry point for the plugin
// All code from main.ts moved here
import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";

import { SettingsModule } from "@/modules/settings";
import { UtilModule } from "@/modules/util";
import { CommandsModule } from "@/modules/commands";
import { ErrorUtilModule } from "@/modules/errors";

// Remember to rename these classes and interfaces!

export default class AliasorPlugin extends Plugin {
    // plugin modules
    public modules = {
        settings: new SettingsModule(this),
        utils: new UtilModule(this),
        commands: new CommandsModule(this),
        errors: new ErrorUtilModule(this),
    };

    // onload all modules
    async loadModules() {
        for (const module of Object.values(this.modules)) {
            await module.onload();
        }
    }

    async onload() {
        await this.loadModules();

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon(
            "dice",
            "Sample Plugin",
            (evt: MouseEvent) => {
                // Called when the user clicks the icon.
                new Notice("This is a notice!");
            },
        );
        // Perform additional things with the ribbon
        ribbonIconEl.addClass("my-plugin-ribbon-class");

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText("Status Bar Text");

        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: "sample-editor-command",
            name: "Sample editor command",
            editorCallback: (editor: Editor, view: MarkdownView) => {
                console.log(editor.getSelection());
                editor.replaceSelection("Sample Editor Command");
            },
        });
    }

    onunload() {}
}
