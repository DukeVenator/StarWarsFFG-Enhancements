import { log_msg as log } from "../util.js";
import {
    RESPEC,
    TOGGLE_DEFS,
    clearThresholdEffects,
    masterOn,
    presenceOn,
    settingValue,
} from "./settings.js";
import { confirmHtml, t } from "./ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "modules/ffg-star-wars-enhancements/templates/respec/settings.html";

const GROUPS = [
    { id: "session", label: "settings-group-session", hint: "settings-group-session-hint", icon: "fa-solid fa-dice-d10" },
    { id: "presence", label: "settings-group-presence", hint: "settings-group-presence-hint", icon: "fa-solid fa-scale-balanced" },
    { id: "pull", label: "settings-group-pull", hint: "settings-group-pull-hint", icon: "fa-solid fa-dice-d20" },
    { id: "reference", label: "settings-group-reference", hint: "settings-group-reference-hint", icon: "fa-solid fa-book-open" },
];

let settingsApp = null;

export class RespecSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #bound = false;

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "ffg-star-wars-enhancements-respec-settings",
            classes: ["respec-window", "respec-settings-window"],
            window: {
                title: t("settings-title"),
                resizable: true,
                icon: "fa-solid fa-sliders",
            },
            position: { width: 700, height: 780 },
        }, { inplace: false });
    }

    static PARTS = {
        content: { template: TEMPLATE, scrollable: [".respec-settings"] },
    };

    _prepareContext() {
        const master = masterOn();
        const presence = presenceOn();
        const rows = Object.entries(TOGGLE_DEFS)
            .filter(([id]) => id !== "enable")
            .map(([id, definition]) => {
                const requires = definition.requires;
                const requiresMet =
                    !requires ||
                    requires === "enable" ||
                    (requires === "presence" && presence) ||
                    (requires === "pull" && settingValue(RESPEC.pull, false));
                const disabled = !master || !requiresMet;
                return {
                    id,
                    key: definition.key,
                    name: t(definition.name),
                    hint: t(definition.hint),
                    icon: definition.icon,
                    group: definition.group,
                    value: settingValue(definition.key, false) === true,
                    disabled,
                    locked: disabled && master,
                };
            });
        const groups = GROUPS.map((group) => ({
            ...group,
            label: t(group.label),
            hint: t(group.hint),
            rows: rows.filter((row) => row.group === group.id),
        }));
        return {
            master,
            masterKey: RESPEC.enable,
            masterName: t("settings-master"),
            masterHint: t("settings-master-hint"),
            groups,
            unifiedWarning: master && settingValue(RESPEC.unified, false) && presence,
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        if (this.#bound) return;
        this.#bound = true;
        this.element?.addEventListener("change", (event) => {
            const input = event.target.closest("[data-setting]");
            if (!input) return;
            this.#save(input.dataset.setting, input.checked).catch((error) => log("respec", error));
        });
    }

    async #save(key, value) {
        await game.settings.set(RESPEC.module, key, value);
        this.render();
    }

    _onClickAction(event, target) {
        const action = target?.dataset?.action;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        this.#onAction(action).catch((error) => log("respec", error));
    }

    async #onAction(action) {
        switch (action) {
            case "open-tracker": {
                const { openRespecSession } = await import("./session-app.js");
                openRespecSession();
                return;
            }
            case "clear-effects": {
                const confirmed = await confirmHtml(
                    t("settings-clear-effects"),
                    `<p>${t("settings-clear-effects-confirm")}</p>`,
                    t("settings-clear-effects")
                );
                if (!confirmed) return;
                const removed = await clearThresholdEffects();
                ui.notifications.info(t("settings-clear-effects-done", { count: removed }));
                this.render();
                return;
            }
            case "close":
                this.close();
                return;
            default:
                return;
        }
    }
}

export function registerSettingsMenu() {
    game.settings.registerMenu(RESPEC.module, "respec_UISettings", {
        name: t("settings-title"),
        hint: t("settings-subtitle"),
        label: t("settings-open"),
        icon: "fa-solid fa-scale-balanced",
        type: RespecSettingsApp,
        restricted: true,
    });
}

export function openRespecSettings() {
    if (!game.user.isGM) {
        ui.notifications.warn(t("no-permission"));
        return null;
    }
    settingsApp ??= new RespecSettingsApp();
    settingsApp.render(true);
    return settingsApp;
}
