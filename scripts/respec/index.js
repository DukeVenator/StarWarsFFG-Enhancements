import { registerSettings } from "./settings.js";
import { registerSettingsMenu, openRespecSettings } from "./settings-app.js";
import { hooks as registerSession, openRespecSession } from "./session-app.js";
import { hooks as registerSheet } from "./sheet.js";
import {
    endSession,
    getCharacters,
    newEncounter,
    rollPull,
} from "./session.js";
import { applyRespecTheme } from "./theme.js";
import { ensureRespecStyles } from "./ui.js";

export function init() {
    ensureRespecStyles();
    applyRespecTheme();
    Hooks.on("updateSetting", (setting) => {
        if (["core.theme", "starwarsffg.ui-darkmode", "starwarsffg.ui-uitheme"].includes(setting?.key)) {
            applyRespecTheme();
        }
    });
    registerSettings();
    registerSettingsMenu();
    registerSheet();
    registerSession();
}

/** Publish a small macro-friendly API on the module object. */
export function ready() {
    applyRespecTheme();
    const module = game.modules.get("ffg-star-wars-enhancements");
    if (!module) return;
    module.api = foundry.utils.mergeObject(module.api ?? {}, {
        respec: {
            open: openRespecSession,
            settings: openRespecSettings,
            rollPull,
            newEncounter,
            endSession,
            getCharacters,
        },
    });
}

export { openRespecSession, openRespecSettings };
