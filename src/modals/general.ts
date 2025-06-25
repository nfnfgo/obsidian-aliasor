import { Modal, FuzzySuggestModal, Setting } from "obsidian";

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

interface AliasorModalProps {
    onConfirm?: () => void;
    onCancel?: () => void;
    title?: string;
    danger?: boolean;
    confirmText?: string;
    cancelText?: string;
}

/**
 * Usage:
 *
 * - Override `title`, `danger` or any other properties on demand.
 *
 * You could also pass some of this properties in the `constructor`,
 * which will always take precedence over the instance properties.
 * Check out constructor parameters for more details.
 *
 * - Override `setBodyContent()`.
 *
 * This method will be called before the modal is opened. So it's safe to set properties
 * of `this` and use them in `setBodyContent()`.
 */
export abstract class AliasorConfirmModal extends Modal {
    // override these properties in subclass if needed
    public title: string | undefined = undefined;
    public danger = false;
    public confirmText = "OK";
    public cancelText = "Cancel";
    public onConfirm?: () => void;
    public onCancel?: () => void;

    constructor(
        protected p: AliasorPlugin,
        {
            title,
            danger = false,
            onConfirm,
            onCancel,
            confirmText,
            cancelText,
        }: AliasorModalProps = {},
    ) {
        // init
        super(p.app);
        this.title = title ?? "Confirm Action";
        this.danger = danger;
        this.confirmText = confirmText ?? this.confirmText;
        this.cancelText = cancelText ?? this.cancelText;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    /**
     * This method is reponsible for loading all contents to the elements
     * before it being shown on the UI.
     */
    private _loadContent(): void {
        // add title if needed
        this.contentEl.empty();
        if (this.title) this.contentEl.createEl("h2", { text: this.title });
        // call overriden method to set body content
        this.setBodyContent(this.contentEl);
        // add buttons
        new Setting(this.contentEl)
            .addButton((btn) => {
                btn.setButtonText(this.confirmText).onClick(() => {
                    this.onConfirm?.();
                    this.close();
                });
                if (this.danger) {
                    btn.setWarning();
                } else {
                    btn.setCta();
                }
            })
            .addButton((btn) => {
                btn.setButtonText(this.cancelText).onClick(() => {
                    this.onCancel?.();
                    this.close();
                });
            });
    }

    open(): void {
        this._loadContent();
        super.open();
    }

    /**
     * Subclass should override this method to set the body content of this modal.
     */
    protected abstract setBodyContent(contentEl: HTMLElement): void;
}
