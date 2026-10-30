import {
    FEAR_AWARDS,
    applyThresholdToFlag,
    counts,
    cyclePoint,
    learnedConflictTalents,
    murderFlip,
    pullScore,
    readFlag,
    resolvePresence,
    thresholdChanges,
} from "./presence.js";
import {
    encounterNumber,
    fearOn,
    optionOn,
    presenceOn,
    pullRollValue,
    RESPEC,
    syncThresholdEffect,
    thresholdEffect,
} from "./settings.js";
import { clampAward } from "./tables.js";
import {
    asNumber,
    canEdit,
    characterActors,
    confirmHtml,
    dieOutcome,
    dieMarkup,
    escapeHtml,
    forceRating,
    postChat,
    refreshSurfaces,
    sessionCharacters,
    t,
    wholeCount,
} from "./ui.js";

function flagOf(actor) {
    return readFlag(actor?.getFlag?.(RESPEC.module, RESPEC.flag));
}

async function writeFlag(actor, flag) {
    await actor.setFlag(RESPEC.module, RESPEC.flag, flag);
}

async function rollTotal(formula) {
    const roll = new Roll(formula);
    await roll.evaluate();
    return asNumber(roll.total);
}

function thresholdAppliedKey(actor) {
    const changes = thresholdEffect(actor)?.changes ?? [];
    const strain = asNumber(changes.find((change) => change.key === "system.stats.strain.max")?.value);
    const wounds = asNumber(changes.find((change) => change.key === "system.stats.wounds.max")?.value);
    if (strain === -2 && wounds === 2) return "dark";
    if (strain === 2 && wounds === 0) return "light";
    return "none";
}

export function thresholdView(payload) {
    if (payload.darkUser) {
        return {
            kind: "dark",
            label: t("threshold-dark"),
            detail: t("threshold-dark-detail"),
            destiny: payload.destiny ? t("threshold-destiny-dark") : "",
            consumed: payload.consumed ? t("threshold-consumed") : "",
        };
    }
    if (payload.redeem) {
        return {
            kind: "light",
            label: t("threshold-light"),
            detail: t("threshold-light-detail"),
            destiny: payload.destiny ? t("threshold-destiny-light") : "",
            consumed: "",
        };
    }
    return {
        kind: "none",
        label: t("threshold-balanced"),
        detail: t("threshold-none-detail"),
        destiny: "",
        consumed: "",
    };
}

function statusText(flag, dark) {
    const parts = [];
    if (flag.generatesFromDarkPips) parts.push(t("status-dark-pips"));
    if (flag.redeemed && !flag.generatesFromDarkPips) parts.push(t("status-redeemed"));
    if (dark >= 10) parts.push(t("status-consumed"));
    return parts.join(" ");
}

/** Everything a character card or sheet needs, derived from the actor flag and settings. */
export function characterRow(actor, players = [], extra = false) {
    const flag = flagOf(actor);
    const tally = counts(flag.points);
    const presence = presenceOn();
    const pull = optionOn(RESPEC.pull);
    const morality = asNumber(actor.system?.morality?.value);
    const roll = pullRollValue();
    const score = pullScore(flag.points, morality, presence);
    const die = dieOutcome(score, roll);
    const payload = thresholdChanges(flag.points);
    const view = thresholdView(payload);
    const applied = thresholdAppliedKey(actor);
    const thresholdKey = view.kind;
    const dirty = thresholdKey !== applied;
    const talents = learnedConflictTalents(actor.items).map((name) => ({ name }));
    return {
        id: actor.id,
        name: actor.name,
        img: actor.img || "icons/svg/mystery-man.svg",
        players: players.length ? players.join(", ") : extra ? t("added-manually") : "",
        added: extra,
        morality,
        conflict: asNumber(actor.system?.conflict?.value),
        tranquility: flag.tranquility,
        score,
        light: tally.light,
        neutral: tally.neutral,
        dark: tally.dark,
        meter: [
            ...Array.from({ length: tally.light }, () => "light"),
            ...Array.from({ length: tally.neutral }, () => "neutral"),
            ...Array.from({ length: tally.dark }, () => "dark"),
        ],
        points: flag.points.map((state, index) => ({
            state,
            index,
            label: t(`point-${state}`),
        })),
        pullSpent: flag.pullSpent,
        die,
        hasRoll: roll > 0,
        status: statusText(flag, tally.dark),
        forceRating: forceRating(actor),
        talents,
        hasTalents: talents.length > 0,
        threshold: {
            ...view,
            applied,
            dirty,
            applyLabel: dirty ? (thresholdKey === "none" ? t("remove-effect") : t("apply")) : t("up-to-date"),
            canApply: dirty,
        },
    };
}

export function getCharacters() {
    return sessionCharacters().map(({ actor, players, extra }) => characterRow(actor, players, extra));
}

export function pullSummary() {
    const characters = getCharacters();
    const roll = pullRollValue();
    return {
        roll,
        hasRoll: roll > 0,
        characters,
        ready: characters.filter((character) => !character.pullSpent).length,
        used: characters.filter((character) => character.pullSpent).length,
    };
}

export async function cyclePresencePoint(actor, index) {
    if (!presenceOn() || !canEdit(actor)) return;
    const flag = flagOf(actor);
    const point = Number(index);
    if (!Number.isInteger(point) || point < 0 || point >= flag.points.length) return;
    const points = flag.points.slice();
    points[point] = cyclePoint(points[point]);
    await writeFlag(actor, { ...flag, points });
    refreshSurfaces();
}

export async function markPullSpent(actor) {
    if (!optionOn(RESPEC.pull) || !canEdit(actor) || !actor) return;
    const flag = flagOf(actor);
    if (flag.pullSpent) return;
    await writeFlag(actor, { ...flag, pullSpent: true });
    const row = characterRow(actor);
    if (row.hasRoll) {
        await postChat(
            `<p class="respec-chat-line"><span class="respec-chat-die">${dieMarkup(row.die)}<em>${escapeHtml(row.die.label)}</em></span>` +
                `<strong>${escapeHtml(actor.name)}</strong> ${escapeHtml(t("chat-pull-spent"))}</p>`
        );
    }
    refreshSurfaces();
}

export async function refreshPullDie(actor) {
    if (!optionOn(RESPEC.pull) || !canEdit(actor) || !actor) return;
    const flag = flagOf(actor);
    if (!flag.pullSpent) return;
    await writeFlag(actor, { ...flag, pullSpent: false });
    refreshSurfaces();
}

export async function addConflict(actor, talentName = "") {
    if (!optionOn(RESPEC.conflictUse) || !canEdit(actor) || !actor) return;
    const next = asNumber(actor.system?.conflict?.value) + 1;
    await actor.update({ "system.conflict.value": next });
    await postChat(
        `<p>${escapeHtml(t("chat-conflict", { name: actor.name, talent: talentName || t("conflict-talent") }))}</p>`
    );
    ui.notifications.info(t("notify-award-conflict", { name: actor.name, amount: 1 }));
    refreshSurfaces();
}

async function addTranquility(actor, amount) {
    const flag = flagOf(actor);
    await writeFlag(actor, { ...flag, tranquility: Math.max(0, flag.tranquility + amount) });
}

async function addConflictValue(actor, amount) {
    await actor.update({ "system.conflict.value": Math.max(0, asNumber(actor.system?.conflict?.value) + amount) });
}

export async function awardRow(actor, entry, requested, track) {
    if (!game.user.isGM || !entry) return null;
    if (!actor) {
        ui.notifications.warn(t("no-characters"));
        return null;
    }
    if (entry.murder) {
        if (!presenceOn()) {
            ui.notifications.warn(t("murder-needs-presence"));
            return null;
        }
        const flag = flagOf(actor);
        await writeFlag(actor, { ...flag, points: murderFlip(flag.points) });
        const message = t("chat-murder", { name: actor.name });
        ui.notifications.info(message);
        await postChat(`<p>${escapeHtml(message)}</p>`);
        refreshSurfaces();
        return { amount: null, murder: true };
    }
    const amount = clampAward(entry, requested);
    if (track === "tranquility") await addTranquility(actor, amount);
    else await addConflictValue(actor, amount);
    ui.notifications.info(
        t(track === "tranquility" ? "notify-award-tranquility" : "notify-award-conflict", {
            name: actor.name,
            amount,
        })
    );
    await postChat(
        `<p>${escapeHtml(
            t(track === "tranquility" ? "chat-award-tranquility" : "chat-award-conflict", {
                name: actor.name,
                amount,
            })
        )}</p>`
    );
    refreshSurfaces();
    return { amount, murder: false };
}

async function flipLightToDark() {
    const systemId = game.system.id;
    const light = asNumber(game.settings.get(systemId, "dPoolLight"));
    const dark = asNumber(game.settings.get(systemId, "dPoolDark"));
    if (light <= 0) {
        ui.notifications.warn(t("notify-no-light"));
        return false;
    }
    await game.settings.set(systemId, "dPoolLight", light - 1);
    await game.settings.set(systemId, "dPoolDark", dark + 1);
    return true;
}

async function addLightDestiny() {
    const systemId = game.system.id;
    const light = asNumber(game.settings.get(systemId, "dPoolLight"));
    await game.settings.set(systemId, "dPoolLight", light + 1);
}

export async function applyThresholds(actor) {
    if (!game.user.isGM || !presenceOn() || !actor) return;
    const flag = flagOf(actor);
    const payload = thresholdChanges(flag.points);
    let { flag: next, grant } = applyThresholdToFlag(flag, payload);
    if (grant === "flip-dark") {
        const flipped = await flipLightToDark();
        if (!flipped) {
            next = { ...next, destinyApplied: flag.destinyApplied };
            grant = null;
        } else {
            await postChat(`<p>${escapeHtml(t("chat-flip", { name: actor.name }))}</p>`);
        }
    } else if (grant === "add-light") {
        await addLightDestiny();
        await postChat(`<p>${escapeHtml(t("chat-add-light", { name: actor.name }))}</p>`);
    }
    await syncThresholdEffect(actor, payload);
    await writeFlag(actor, next);
    if (payload.consumed) {
        ui.notifications.warn(t("chat-consumed", { name: actor.name }));
        await postChat(`<p>${escapeHtml(t("chat-consumed", { name: actor.name }))}</p>`);
    } else {
        ui.notifications.info(t("notify-threshold-applied", { name: actor.name }));
    }
    refreshSurfaces();
}

export async function rollPull({ post = true } = {}) {
    if (!optionOn(RESPEC.pull) || !game.user.isGM) return null;
    const total = await rollTotal("1d100");
    await game.settings.set(RESPEC.module, RESPEC.pullRoll, total);
    for (const actor of characterActors()) {
        const flag = flagOf(actor);
        if (flag.pullSpent) await writeFlag(actor, { ...flag, pullSpent: false });
    }
    if (post) await postPullSummary({ intro: t("chat-pull-intro", { roll: total }) });
    refreshSurfaces({ controls: true });
    return total;
}

export async function setPullRoll(value) {
    if (!game.user.isGM) return;
    const next = Math.min(100, wholeCount(value));
    await game.settings.set(RESPEC.module, RESPEC.pullRoll, next);
    refreshSurfaces();
}

export async function newEncounter() {
    if (!optionOn(RESPEC.pull) || !game.user.isGM) return null;
    const next = encounterNumber() + 1;
    await game.settings.set(RESPEC.module, RESPEC.encounter, next);
    for (const actor of characterActors()) {
        const flag = flagOf(actor);
        if (flag.pullSpent) await writeFlag(actor, { ...flag, pullSpent: false });
    }
    await postPullSummary({ intro: t("chat-pull-reset", { encounter: next }) });
    ui.notifications.info(t("notify-encounter", { encounter: next }));
    refreshSurfaces({ controls: true });
    return next;
}

export function pullSummaryHtml({ intro = "", footer = "" } = {}) {
    const summary = pullSummary();
    if (!summary.characters.length) {
        return `<header class="respec-chat-head"><div><strong>${escapeHtml(t("pull-title"))}</strong><span>d100 · ${summary.roll || "—"}</span></div></header><p>${escapeHtml(t("no-characters"))}</p>`;
    }
    const rows = summary.characters
        .map((character) => {
            const state = character.pullSpent ? t("used") : t("ready");
            return `<li class="${character.pullSpent ? "is-used" : "is-ready"}">
                <img class="respec-chat-portrait" src="${escapeHtml(character.img)}" alt="">
                <span class="respec-chat-name">${escapeHtml(character.name)}</span>
                <span class="respec-chat-die">${dieMarkup(character.die)}<em>${escapeHtml(character.die.label || t("not-rolled"))}</em></span>
                <span class="respec-chat-state">${escapeHtml(state)}</span>
            </li>`;
        })
        .join("");
    return `<header class="respec-chat-head">
        <div><strong>${escapeHtml(t("pull-title"))}</strong><span>d100 · ${summary.roll || "—"}</span></div>
    </header>
    ${intro ? `<p class="respec-chat-intro">${escapeHtml(intro)}</p>` : ""}
    <ul class="respec-chat-list">${rows}</ul>
    <p class="respec-chat-foot">${escapeHtml(footer || t("chat-pull-foot"))}</p>`;
}

export async function postPullSummary(options = {}) {
    if (!optionOn(RESPEC.pull) || !game.user.isGM) return;
    await postChat(pullSummaryHtml(options));
}

export async function endSessionPreview() {
    const characters = characterActors().map((actor) => {
        const flag = flagOf(actor);
        const conflict = asNumber(actor.system?.conflict?.value);
        const resolved = resolvePresence(flag.points, flag.tranquility, conflict);
        return {
            name: actor.name,
            tranquility: flag.tranquility,
            conflict,
            moved: resolved.moved,
            moveLabel: t(`move-${resolved.moved}`),
        };
    });
    const rows = characters
        .map(
            (entry) =>
                `<li><strong>${escapeHtml(entry.name)}</strong> — ${escapeHtml(
                    t("end-preview-row", {
                        tranquility: entry.tranquility,
                        conflict: entry.conflict,
                        move: entry.moveLabel,
                    })
                )}</li>`
        )
        .join("");
    return { characters, html: rows };
}

export async function endSession() {
    if (!presenceOn() || !game.user.isGM) return;
    const preview = await endSessionPreview();
    if (!preview.characters.length) {
        ui.notifications.warn(t("no-characters"));
        return;
    }
    const content = `<p>${escapeHtml(t("end-preview-intro"))}</p><ul class="respec-dialog-list">${preview.html}</ul>`;
    const confirmed = await confirmHtml(t("end-session"), content, t("end-session-confirm-button"));
    if (!confirmed) return;
    const lines = [];
    for (const actor of characterActors()) {
        const flag = flagOf(actor);
        const resolved = resolvePresence(flag.points, flag.tranquility, asNumber(actor.system?.conflict?.value));
        await actor.update({ "system.conflict.value": 0 });
        await writeFlag(actor, {
            ...flag,
            points: resolved.points,
            tranquility: 0,
            destinyApplied: "",
            pullSpent: false,
        });
        lines.push(`<li>${escapeHtml(t(`moved-${resolved.moved}`, { name: actor.name }))}</li>`);
    }
    await postChat(`<p>${escapeHtml(t("chat-end"))}</p><ul>${lines.join("")}</ul>`);
    refreshSurfaces({ controls: true });
}

export async function unifiedRoll() {
    if (!optionOn(RESPEC.unified) || presenceOn() || !game.user.isGM) return;
    const confirmed = await confirmHtml(t("unified"), `<p>${escapeHtml(t("unified-confirm"))}</p>`);
    if (!confirmed) return;
    const total = await rollTotal("1d10");
    const lines = [];
    for (const actor of characterActors()) {
        const conflict = asNumber(actor.system?.conflict?.value);
        const before = asNumber(actor.system?.morality?.value);
        const after = before + (total - conflict);
        await actor.update({
            "system.morality.value": after,
            "system.conflict.value": 0,
        });
        lines.push(`<li>${escapeHtml(t("chat-unified-row", { name: actor.name, from: before, to: after }))}</li>`);
    }
    await postChat(`<p>${escapeHtml(t("chat-unified", { roll: total }))}</p><ul>${lines.join("")}</ul>`);
    refreshSurfaces({ controls: true });
}

export async function resolveActor(actor) {
    if (!presenceOn() || !actor) return;
    const flag = flagOf(actor);
    const resolved = resolvePresence(flag.points, flag.tranquility, asNumber(actor.system?.conflict?.value));
    await actor.update({ "system.conflict.value": 0 });
    await writeFlag(actor, {
        ...flag,
        points: resolved.points,
        tranquility: 0,
        destinyApplied: "",
    });
    await postChat(`<p>${escapeHtml(t(`moved-${resolved.moved}`, { name: actor.name }))}</p>`);
    refreshSurfaces();
}

export async function setMorality(actor, value) {
    if (!actor || !canEdit(actor)) return;
    await actor.update({ "system.morality.value": Math.trunc(Number(value)) || 0 });
    refreshSurfaces();
}

export async function setConflict(actor, value) {
    if (!actor || !canEdit(actor)) return;
    await actor.update({ "system.conflict.value": wholeCount(value) });
    refreshSurfaces();
}

export async function setTranquility(actor, value) {
    if (!presenceOn() || !actor || !canEdit(actor)) return;
    const flag = flagOf(actor);
    await writeFlag(actor, { ...flag, tranquility: wholeCount(value) });
    refreshSurfaces();
}

export async function adjustStat(actor, stat, delta) {
    if (!actor || !canEdit(actor)) return;
    const amount = Math.trunc(Number(delta)) || 0;
    if (stat === "conflict") await setConflict(actor, asNumber(actor.system?.conflict?.value) + amount);
    else if (stat === "tranquility") await setTranquility(actor, flagOf(actor).tranquility + amount);
    else if (stat === "morality") await setMorality(actor, asNumber(actor.system?.morality?.value) + amount);
}

export async function rollMoralityCheck(actor) {
    if (!actor || !canEdit(actor)) return;
    const die = await rollTotal("1d10");
    const conflict = asNumber(actor.system?.conflict?.value);
    const before = asNumber(actor.system?.morality?.value);
    const after = before + (die - conflict);
    await actor.update({
        "system.morality.value": after,
        "system.conflict.value": 0,
    });
    await postChat(
        `<p>${escapeHtml(
            t("wizard-morality-chat", {
                name: actor.name,
                die,
                conflict,
                from: before,
                to: after,
            })
        )}</p>`
    );
    refreshSurfaces();
}

export async function rollConflictGain(actor) {
    if (!actor || !canEdit(actor)) return;
    const die = await rollTotal("1d10");
    const before = asNumber(actor.system?.conflict?.value);
    const after = before + die;
    await actor.update({ "system.conflict.value": after });
    await postChat(
        `<p>${escapeHtml(t("wizard-conflict-chat", { name: actor.name, die, from: before, to: after }))}</p>`
    );
    refreshSurfaces();
}

export async function rollTranquilityGain(actor) {
    if (!presenceOn() || !actor || !canEdit(actor)) return;
    const die = await rollTotal("1d10");
    const flag = flagOf(actor);
    const before = flag.tranquility;
    const after = before + die;
    await writeFlag(actor, { ...flag, tranquility: after });
    await postChat(
        `<p>${escapeHtml(t("wizard-tranquility-chat", { name: actor.name, die, from: before, to: after }))}</p>`
    );
    refreshSurfaces();
}

export async function recordFear(actor, kind) {
    if (!fearOn() || !canEdit(actor) || !actor) return;
    const award = FEAR_AWARDS[kind];
    if (!award) return;
    if (award.conflict) await addConflictValue(actor, award.conflict);
    if (award.tranquility) await addTranquility(actor, award.tranquility);
    const track = award.conflict ? "conflict" : "tranquility";
    const amount = award.conflict || award.tranquility;
    const label = t(`fear-${kind}-short`);
    await postChat(
        `<p>${escapeHtml(t("chat-fear", { name: actor.name, symbol: label, amount, track: t(`col-${track}`) }))}</p>`
    );
    ui.notifications.info(t("notify-fear", { name: actor.name, symbol: label, amount, track: t(`col-${track}`) }));
    refreshSurfaces();
}

export function openTrackerSettings() {
    return import("./settings-app.js").then((module) => module.openRespecSettings());
}
