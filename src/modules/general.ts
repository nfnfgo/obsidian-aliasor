import type AliasorPlugin from "@/main";
import type { App } from "obsidian";

export abstract class AliasorModule {
    protected p: AliasorPlugin;
    protected a: App;

    constructor(protected plugin: AliasorPlugin) {
        this.p = plugin;
        this.a = plugin.app;
    }

    /**
     * Loads the module. This method is called when the plugin is loaded.
     * Should be an async method.
     */
    public abstract onload(): Promise<any>;
    /**
     * Unloads the module.
     * This method is called when the plugin is unloaded.
     */
    public async unload(): Promise<void> {}
}
