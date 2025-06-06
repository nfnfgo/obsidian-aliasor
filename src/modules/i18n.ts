import i18next, { Resource, type InitOptions } from "i18next";

import { AliasorModule } from "@/modules/general";
import { UtilModule } from "./util";

export class I18nModule extends AliasorModule {
    // For compatibility with AliasorModule
    async onload() {
        await this.init();
    }

    async init(options?: InitOptions) {
        await i18next.init({
            lng: UtilModule.getObsidianLanguage(),
            fallbackLng: "en",
            resources: await this.loadResources(),
            ...options,
        });
    }

    async loadResources() {
        // @ts-expect-error: dynamic import of JSON with assertion is not fully supported by TS yet
        const en = await import("../locales/en.json", {
            assert: { type: "json" },
        });
        // @ts-expect-error: dynamic import of JSON with assertion is not fully supported by TS yet
        const zh = await import("../locales/zh.json", {
            assert: { type: "json" },
        });
        return {
            en: en.default || en,
            zh: zh.default || zh,
        } as Resource;
    }

    t(key: string, options?: any): string {
        return i18next.t(key, options) as string;
    }

    changeLanguage(lng: string) {
        return i18next.changeLanguage(lng);
    }
}
