import { FuzzySuggestModal } from "obsidian";
import type { App, Command, FuzzyMatch } from "obsidian";
import { AliasorModule } from "@/modules/general";

interface ObsidianCommandAPI {
    commands: Record<string, Command>;
    executeCommandById(commandId: string): void;
}

export class CommandsModule extends AliasorModule {
    public obsCmd: ObsidianCommandAPI;

    async onload() {
        // unsafe type conversion
        // this module are using undocumented Obsidian `app` API
        this.obsCmd = (this.a as any).commands as ObsidianCommandAPI;
    }

    executeCommandById(commandId: string): void {
        if (commandId) {
            this.obsCmd.executeCommandById(commandId);
        }
    }

    getCommands(): Command[] {
        return Object.values(this.obsCmd.commands);
    }

    getCommandById(commandId: string): Command | undefined {
        return this.obsCmd.commands[commandId];
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

    // TODO
    execCommandHandler() {}
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
