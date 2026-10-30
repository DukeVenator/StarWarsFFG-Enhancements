import { pullDice } from "./presence.js";

export const MODULE_ID = "ffg-star-wars-enhancements";
export const KEY = `${MODULE_ID}.respec`;
export const STYLE_PATH = `modules/${MODULE_ID}/styles/respec.css`;

/** Localize a REspec key. */
export function t(suffix, data) {
    const key = `${KEY}.${suffix}`;
    return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function wholeCount(value) {
    const number = Math.trunc(Number(value));
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function rootOf(html) {
    if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    return null;
}

/** Player-owned character actors, grouped by actor with the player names. */
export function assignedCharacters() {
    const byActor = new Map();
    for (const user of game.users) {
        if (user.isGM || !user.character || user.character.type !== "character") continue;
        const names = byActor.get(user.character.id) ?? [];
        names.push(user.name);
        byActor.set(user.character.id, names);
    }
    return [...byActor.entries()]
        .map(([id, players]) => {
            const actor = game.actors.get(id);
            return actor ? { actor, players } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.actor.name.localeCompare(b.actor.name));
}

export function characterActors() {
    return assignedCharacters().map((entry) => entry.actor);
}

export function canEdit(actor) {
    return Boolean(actor) && (game.user.isGM || actor.isOwner);
}

export function avatar(actor) {
    return actor?.img || "icons/svg/mystery-man.svg";
}

export function forceRating(actor) {
    return Math.max(
        asNumber(actor?.system?.stats?.forcePool?.max),
        asNumber(actor?.system?.forcePool?.max),
        asNumber(actor?.system?.attributes?.force?.value)
    );
}

function diceAsset(kind) {
    const file = kind === "boost" ? "blue" : "black";
    return `systems/${game.system.id}/images/dice/starwars/${file}.png`;
}

/**
 * Pull result for display. A roll of zero means the table has not rolled yet.
 * @returns {{hasRoll: boolean, boost: number, setback: number, key: string, label: string, boostImg: string, setbackImg: string}}
 */
export function dieOutcome(score, roll) {
    const rolled = asNumber(roll);
    const result = {
        hasRoll: rolled > 0,
        boost: 0,
        setback: 0,
        key: "none",
        label: "",
        boostImg: diceAsset("boost"),
        setbackImg: diceAsset("setback"),
    };
    if (!result.hasRoll) return result;

    const dice = pullDice(asNumber(score), rolled);
    result.boost = dice.boost;
    result.setback = dice.setback;
    result.key = dice.boost && dice.setback ? "both" : dice.boost ? "boost" : "setback";
    result.label = t(`die-${result.key}`);
    return result;
}

export function dieMarkup(die) {
    if (!die?.hasRoll) return `<span class="respec-die-none">${escapeHtml(t("not-rolled"))}</span>`;
    return [
        die.boost ? `<img class="respec-die-img" src="${die.boostImg}" alt="">` : "",
        die.setback ? `<img class="respec-die-img" src="${die.setbackImg}" alt="">` : "",
    ].join("");
}

export async function postChat(html) {
    return ChatMessage.create({
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content: `<div class="respec-chat respec-app">${html}</div>`,
    });
}

export async function confirmHtml(title, html, confirmLabel = "") {
    const content = `<div class="respec-app respec-dialog">${html}</div>`;
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2?.confirm) {
        const options = { window: { title }, content, modal: true, rejectClose: false };
        if (confirmLabel) options.yes = { label: confirmLabel, icon: "fa-solid fa-check" };
        return DialogV2.confirm(options);
    }
    return Dialog.confirm({ title, content, yes: confirmLabel ? { label: confirmLabel } : undefined });
}

/** Re-render the tracker and any REspec panels on open actor sheets. */
export function refreshSurfaces({ controls = false } = {}) {
    Hooks.callAll("ffgRespecRefresh");
    for (const actor of game.actors?.filter?.((entry) => entry.type === "character") ?? []) {
        if (actor.sheet?.rendered && (game.user.isGM || actor.isOwner)) actor.sheet.render({});
    }
    if (controls) {
        try {
            ui.controls?.render?.({ reset: true });
        } catch (error) {
            console.warn("ffg-star-wars-enhancements | respec control refresh failed", error);
        }
    }
}

export function refreshSession() {
    Hooks.callAll("ffgRespecRefresh");
}

/** Load the stylesheet when a running world predates the manifest entry. */
export function ensureRespecStyles() {
    if (typeof document === "undefined") return;
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].some((link) =>
        link.href.includes("styles/respec.css")
    );
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const version = game.modules?.get(MODULE_ID)?.version ?? "dev";
    link.href = `${STYLE_PATH}?v=${encodeURIComponent(version)}`;
    document.head.append(link);
}
