import { Modal, SuggestModal, FuzzySuggestModal } from "obsidian";

import type AliasorPlugin from "@/main";

/**
 * Pre-defined abstract class to create a FuzzySuggestModal for AliasorPlugin.
 *
 * Generally, only `getItems()` and `getItemText()` needs to be implemented in the derived class.
 */
export abstract class AliasorFuzzySuggestModal<T> extends FuzzySuggestModal<T> {
    protected placeholder = "Select an item...";

    constructor(
        protected p: AliasorPlugin,
        protected callback: (item: T) => void,
        placeholder?: string,
    ) {
        super(p.app);
        this.setPlaceholder(placeholder ?? this.placeholder);
    }

    onChooseItem(item: T): void {
        this.callback(item);
    }
}

// export abstract class AliasorSuggestModal<T> extends SuggestModal<T> {
//     protected placeholder = "Select an item...";

//     constructor(
//         protected p: AliasorPlugin,
//         protected callback: (item: T) => void,
//         placeholder?: string,
//     ) {
//         super(p.app);
//         this.setPlaceholder(placeholder ?? this.placeholder);
//     }

//     onChooseSuggestion(item: T): void {
//         this.callback(item);
//     }
// }
