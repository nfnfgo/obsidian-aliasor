import type AliasorPlugin from "@/main";
import type { App } from "obsidian";
import type { ObsidianCommandAPI } from "@/modules/types";

interface AppAPI extends App {
    commands: ObsidianCommandAPI;
}

export abstract class AliasorModule {
    protected p: AliasorPlugin;
    protected a: AppAPI;

    constructor(protected plugin: AliasorPlugin) {
        this.p = plugin;
        this.a = plugin.app as AppAPI;
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
