import { Modal, SuggestModal, FuzzySuggestModal } from "obsidian";

import type AliasorPlugin from "@/main";

abstract class AliasorFuzzySuggestModal<T> extends FuzzySuggestModal<T> {
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

// TODO
abstract class AliasorSuggestModal<T> extends SuggestModal<T> {
    protected placeholder = "Select an item...";

    constructor(
        protected p: AliasorPlugin,
        protected callback: (item: T) => void,
        placeholder?: string,
    ) {
        super(p.app);
        this.setPlaceholder(placeholder ?? this.placeholder);
    }

    abstract getItems(): T[];

    onChooseSuggestion(item: T): void {
        this.callback(item);
    }
}
