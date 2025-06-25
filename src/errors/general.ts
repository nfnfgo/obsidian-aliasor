/**
 * Extended error class for Aliasor.
 *
 * To create a new custom error, first extend this class,
 * then override the `toReadableString` method if needed.
 */
export class AliasorError extends Error {
    public name = "AliasorError";
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
    }

    /**
     * Returns readable string representation of the error.
     *
     * The returned string should be succinct and user-friendly,
     * as it may be directly displayed to the user using a Notice
     * in Obsidian UI.
     */
    toReadableString(): string {
        if (this.message) {
            return this.message;
        }
        return "An error occurred in Aliasor";
    }
}

export function getReadableErrorMsg(error: Error): string {
    if (error instanceof AliasorError) {
        return error.toReadableString();
    }
    return "An unexpected error occurred in Aliasor";
}
