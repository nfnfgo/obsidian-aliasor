export class PluginSettingTab {}
export class Setting {
    setName() {
        return this;
    }
    setDesc() {
        return this;
    }
    addButton() {
        return this;
    }
    addText() {
        return this;
    }
    addDropdown() {
        return this;
    }
}
export class Notice {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_msg: any) {}
}
export class Modal {
    constructor() {}
}
export class FuzzySuggestModal {
    constructor() {}
}
// AppAPI mock: extends App and adds commands property
export class App {
    constructor() {
        this.commands = {
            commands: {},
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            executeCommandById: (_id) => {},
        };
        this.workspace = {
            activeEditor: {
                editor: {},
            },
        };
    }
    commands: {
        commands: Record<string, any>;
        executeCommandById: (id: string) => void;
    };
    workspace: { activeEditor: { editor: any } };
}
