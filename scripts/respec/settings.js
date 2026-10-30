import { log_msg as log } from "../util.js";
import { thresholdEffectData } from "./presence.js";
import { MODULE_ID, refreshSurfaces, t } from "./ui.js";

const FLAG_KEY = "respec";
const EFFECT_FLAG = "respecThreshold";

export const RESPEC = Object.freeze({
    module: MODULE_ID,
    flag: FLAG_KEY,
    effect: EFFECT_FLAG,
    enable: "respec-opt-enable",
    pull: "respec-opt-pull",
    unified: "respec-opt-unified",
    presence: "respec-opt-presence",
    fear: "respec-opt-fear",
    conflictUse: "respec-opt-conflict-use",
    careers: "respec-opt-careers",
    pullRoll: "respec-state-pull-roll",
    encounter: "respec-state-encounter",
});

/** Toggle metadata shared by the settings app and registration. */
export const TOGGLE_DEFS = Object.freeze({
    enable: {
        key: RESPEC.enable,
        name: "settings-master",
        hint: "settings-master-hint",
        group: "master",
        icon: "fa-solid fa-toggle-on",
        requires: null,
    },
    unified: {
        key: RESPEC.unified,
        name: "unified",
        hint: "unified-hint",
        group: "session",
        icon: "fa-solid fa-dice-d10",
        requires: "enable",
    },
    conflictUse: {
        key: RESPEC.conflictUse,
        name: "conflict-use",
        hint: "conflict-use-hint",
        group: "session",
        icon: "fa-solid fa-bolt",
        requires: "enable",
    },
    presence: {
        key: RESPEC.presence,
        name: "presence",
        hint: "presence-hint",
        group: "presence",
        icon: "fa-solid fa-scale-balanced",
        requires: "enable",
    },
    fear: {
        key: RESPEC.fear,
        name: "fear",
        hint: "fear-hint",
        group: "presence",
        icon: "fa-solid fa-hand-fist",
        requires: "presence",
    },
    pull: {
        key: RESPEC.pull,
        name: "pull",
        hint: "pull-hint",
        group: "pull",
        icon: "fa-solid fa-dice-d20",
        requires: "enable",
    },
    careers: {
        key: RESPEC.careers,
        name: "careers",
        hint: "careers-hint",
        group: "reference",
        icon: "fa-solid fa-book-open",
        requires: "enable",
    },
});

export function settingValue(key, fallback = false) {
    try {
        return game.settings.get(RESPEC.module, key);
    } catch {
        return fallback;
    }
}

export function masterOn() {
    return settingValue(RESPEC.enable, false) === true;
}

export function optionOn(key) {
    return masterOn() && settingValue(key, false) === true;
}

export function presenceOn() {
    return optionOn(RESPEC.presence);
}

export function fearOn() {
    return presenceOn() && settingValue(RESPEC.fear, false) === true;
}

export function encounterNumber() {
    return Math.max(1, Math.trunc(Number(settingValue(RESPEC.encounter, 1))) || 1);
}

export function pullRollValue() {
    const value = Number(settingValue(RESPEC.pullRoll, 0));
    return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.trunc(value))) : 0;
}

export function thresholdEffect(actor) {
    return actor?.effects?.find((effect) => effect.getFlag?.(RESPEC.module, RESPEC.effect));
}

export async function syncThresholdEffect(actor, payload) {
    const changes = thresholdEffectData(payload);
    const existing = thresholdEffect(actor);
    if (!changes.length) {
        if (existing) await existing.delete();
        return;
    }
    if (existing) {
        await existing.update({ changes });
        return;
    }
    await actor.createEmbeddedDocuments("ActiveEffect", [
        {
            name: t("effect-name"),
            img: "icons/svg/aura.svg",
            changes,
            flags: { [RESPEC.module]: { [RESPEC.effect]: true } },
        },
    ]);
}

export async function clearThresholdEffects() {
    if (!game.user?.isGM) return 0;
    let removed = 0;
    const actors = game.actors?.filter?.((actor) => actor.type === "character") ?? [];
    for (const actor of actors) {
        const existing = thresholdEffect(actor);
        if (existing) {
            await existing.delete();
            removed += 1;
        }
    }
    return removed;
}

async function onMasterChanged(value) {
    if (value === false) await clearThresholdEffects();
    refreshSurfaces({ controls: true });
}

async function onPresenceChanged(value) {
    if (value === false) await clearThresholdEffects();
    refreshSurfaces({ controls: true });
}

function registerToggle(definition) {
    const { key, name, hint } = definition;
    const onChange = key === RESPEC.enable ? onMasterChanged : key === RESPEC.presence ? onPresenceChanged : () => refreshSurfaces();
    game.settings.register(RESPEC.module, key, {
        name: t(name),
        hint: t(hint),
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: (value) => {
            Promise.resolve(onChange(value)).catch((error) => log("respec", error));
        },
    });
}

export function registerSettings() {
    log("respec", "Registering REspec settings");
    for (const definition of Object.values(TOGGLE_DEFS)) registerToggle(definition);
    game.settings.register(RESPEC.module, RESPEC.pullRoll, {
        scope: "world",
        config: false,
        type: Number,
        default: 0,
        onChange: () => refreshSurfaces(),
    });
    game.settings.register(RESPEC.module, RESPEC.encounter, {
        scope: "world",
        config: false,
        type: Number,
        default: 1,
        onChange: () => refreshSurfaces(),
    });
}
