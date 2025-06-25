/* eslint-disable @typescript-eslint/no-unused-vars */
import { TFile } from "obsidian";

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
            executeCommandById: (_id: string) => {},
        };
        // Mock leaf object
        const mockLeaf = {
            view: {
                getState: () => ({ file: "test/path/mocked-file.md" }),
            },
        };
        this.workspace = {
            activeEditor: {
                editor: {},
            },
            getActiveFile: (): TFile => {
                const f = new TFile();
                f.name = "mocked-file.md";
                f.basename = "mocked-file";
                f.extension = "md";
                f.path = "test/path/mocked-file.md";
                return f;
            },
            iterateAllLeaves: (cb: (leaf: any) => void): void => {
                cb(mockLeaf);
            },
            setActiveLeaf: (_leaf: any): void => {},
            getLeaf: (
                _type: string,
            ): { openFile: (file: TFile) => Promise<void> } => ({
                openFile: async (_file: TFile) => {},
            }),
        };
    }
    commands: {
        commands: Record<string, any>;
        executeCommandById: (id: string) => void;
    };
    workspace: {
        activeEditor: { editor: any };
        getActiveFile: () => TFile;
        iterateAllLeaves: (cb: (leaf: any) => void) => void;
        setActiveLeaf: (leaf: any) => void;
        getLeaf: (type: string) => { openFile: (file: TFile) => Promise<void> };
    };
}
