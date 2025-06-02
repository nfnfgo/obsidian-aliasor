import { Notice } from "obsidian";
import { AliasorModule } from "@/modules/general";
import { getReadableErrorMsg } from "@/errors/general";

interface ErrorHandlerParams {
    error: Error;
    /**
     * Show a notice in Obsidian UI with the readable error message.
     */
    showNotice?: boolean;
    /**
     * Log the original error to the console.
     */
    consoleLog?: boolean;
}

export class ErrorUtilModule extends AliasorModule {
    async onload() {}

    /**
     * Handles errors in a consistent way across the plugin
     *
     * @example
     * ```typescript
     * try{
     *    // some code that may throw an error
     * } catch (error) {
     *    this.errorHandler({
     *       error,
     *       showNotice: true,
     *       consoleLog: true
     *    });
     * }
     */
    errorHandler(params: ErrorHandlerParams) {
        const { error, showNotice, consoleLog } = params;

        if (showNotice) {
            const msg = getReadableErrorMsg(error);
            let durationSec = msg.length / 10;
            durationSec = Math.min(durationSec, 5);
            new Notice(msg, durationSec * 1000);
        }

        if (consoleLog) {
            console.log(error);
        }
    }
}
