/**
 * Force Presence, Pull of the Force, and Unified Conflict rules from the
 * Force and Destiny Primer v3.1. No Foundry globals: the session window and
 * the sheet apply these results to actor flags and system fields.
 */

export const POINT_COUNT = 10;

const POINT_STATES = new Set(["light", "neutral", "dark"]);

export const FEAR_AWARDS = Object.freeze({
    threat: { conflict: 1, tranquility: 0 },
    despair: { conflict: 2, tranquility: 0 },
    advantage: { conflict: 0, tranquility: 1 },
    triumph: { conflict: 0, tranquility: 2 },
});

export function blankPoints() {
    return Array(POINT_COUNT).fill("neutral");
}

export function normalizePoints(points) {
    const source = Array.isArray(points) ? points.slice(0, POINT_COUNT) : [];
    while (source.length < POINT_COUNT) source.push("neutral");
    return source.map((point) => (POINT_STATES.has(point) ? point : "neutral"));
}

export function cyclePoint(state) {
    if (state === "neutral") return "light";
    if (state === "light") return "dark";
    return "neutral";
}

export function counts(points) {
    const normalized = normalizePoints(points);
    return {
        light: normalized.filter((point) => point === "light").length,
        neutral: normalized.filter((point) => point === "neutral").length,
        dark: normalized.filter((point) => point === "dark").length,
    };
}

function replaceFirst(points, from, to) {
    const next = normalizePoints(points);
    const index = next.indexOf(from);
    if (index >= 0) next[index] = to;
    return next;
}

/** Neutrals become light first. If none remain, a dark point becomes neutral. */
export function stepTowardLight(points) {
    const normalized = normalizePoints(points);
    if (normalized.includes("neutral")) return replaceFirst(normalized, "neutral", "light");
    return replaceFirst(normalized, "dark", "neutral");
}

/** Neutrals become dark first. If none remain, a light point becomes dark. */
export function stepTowardDark(points) {
    const normalized = normalizePoints(points);
    if (normalized.includes("neutral")) return replaceFirst(normalized, "neutral", "dark");
    return replaceFirst(normalized, "light", "dark");
}

/**
 * Murder flips five points to dark. Light points convert first, then neutrals.
 * @returns {string[]}
 */
export function murderFlip(points) {
    const next = normalizePoints(points);
    let remaining = 5;
    for (let i = 0; i < next.length && remaining > 0; i++) {
        if (next[i] === "light") {
            next[i] = "dark";
            remaining -= 1;
        }
    }
    for (let i = 0; i < next.length && remaining > 0; i++) {
        if (next[i] === "neutral") {
            next[i] = "dark";
            remaining -= 1;
        }
    }
    return next;
}

function whole(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.trunc(number));
}

/**
 * Compare session Tranquility with Conflict and move one balance point.
 * Equal totals do not move a point. Both counters come back as zero either way.
 * @returns {{ points: string[], tranquility: number, conflict: number, moved: "light"|"dark"|"none" }}
 */
export function resolvePresence(points, tranquility, conflict) {
    const calm = whole(tranquility);
    const turmoil = whole(conflict);
    if (calm === turmoil) {
        return { points: normalizePoints(points), tranquility: 0, conflict: 0, moved: "none" };
    }
    if (calm > turmoil) {
        return { points: stepTowardLight(points), tranquility: 0, conflict: 0, moved: "light" };
    }
    return { points: stepTowardDark(points), tranquility: 0, conflict: 0, moved: "dark" };
}

/** 50, plus 5 per light point, minus 5 per dark point, clamped to 1–100. */
export function presenceScore(points) {
    const { light, dark } = counts(points);
    return Math.min(100, Math.max(1, 50 + 5 * light - 5 * dark));
}

/** Official Morality, or the derived Presence score while that rule is on. */
export function pullScore(points, morality, presenceOn) {
    if (presenceOn) return presenceScore(points);
    const score = Number(morality);
    return Number.isFinite(score) ? score : 0;
}

/**
 * Above the d100: one Boost. Below: one Setback. Equal: both.
 * @returns {{ boost: number, setback: number }}
 */
export function pullDice(score, roll) {
    if (score > roll) return { boost: 1, setback: 0 };
    if (score < roll) return { boost: 0, setback: 1 };
    return { boost: 1, setback: 1 };
}

/** Positive when the d10 is higher than Conflict. */
export function moralityDelta(conflict, roll) {
    return Number(roll) - Number(conflict);
}

/**
 * Strain and wound modifiers for the current balance points.
 * Seven or more dark takes priority over light, which ten points cannot reach anyway.
 */
export function thresholdChanges(points) {
    const { light, dark } = counts(points);
    if (dark >= 7) {
        return {
            strain: -2,
            wounds: 2,
            darkUser: true,
            redeem: false,
            destiny: dark >= 9 ? "flip-dark" : null,
            consumed: dark >= 10,
        };
    }
    if (light >= 7) {
        return {
            strain: 2,
            wounds: 0,
            darkUser: false,
            redeem: true,
            destiny: light >= 9 ? "add-light" : null,
            consumed: false,
        };
    }
    return {
        strain: 0,
        wounds: 0,
        darkUser: false,
        redeem: false,
        destiny: null,
        consumed: false,
    };
}

/** ActiveEffect changes. A zero modifier is omitted so the effect can be removed. */
export function thresholdEffectData(payload) {
    const changes = [];
    if (payload.strain) {
        changes.push({ key: "system.stats.strain.max", mode: 2, type: "add", value: payload.strain });
    }
    if (payload.wounds) {
        changes.push({ key: "system.stats.wounds.max", mode: 2, type: "add", value: payload.wounds });
    }
    return changes;
}

export function readFlag(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const applied = source.destinyApplied === "dark" || source.destinyApplied === "light" ? source.destinyApplied : "";
    return {
        points: normalizePoints(source.points),
        tranquility: whole(source.tranquility),
        pullSpent: Boolean(source.pullSpent),
        generatesFromDarkPips: Boolean(source.generatesFromDarkPips),
        redeemed: Boolean(source.redeemed),
        destinyApplied: applied,
    };
}

/**
 * Update the visible dark-pip status and decide whether this Apply grants Destiny.
 * A second Apply in the same 9+ band does not grant again. Leaving that band clears it.
 * Redemption is recorded only for someone already marked as a dark-side user.
 * @returns {{ flag: object, grant: "flip-dark"|"add-light"|null }}
 */
export function applyThresholdToFlag(flag, payload) {
    const next = readFlag(flag);
    if (payload.darkUser) {
        next.generatesFromDarkPips = true;
        next.redeemed = false;
    } else if (payload.redeem && next.generatesFromDarkPips) {
        next.generatesFromDarkPips = false;
        next.redeemed = true;
    }
    if (!payload.destiny) {
        next.destinyApplied = "";
        return { flag: next, grant: null };
    }
    const band = payload.destiny === "flip-dark" ? "dark" : "light";
    if (next.destinyApplied === band) return { flag: next, grant: null };
    next.destinyApplied = band;
    return { flag: next, grant: payload.destiny };
}

/**
 * Learned conflict talents. Specialization nodes count only when purchased.
 * Force power items are ignored.
 * @param {Array<{ type?: string, name?: string, system?: object }>} items
 * @returns {string[]}
 */
export function learnedConflictTalents(items) {
    const names = [];
    const seen = new Set();
    const add = (name) => {
        if (!name || seen.has(name)) return;
        seen.add(name);
        names.push(name);
    };
    const list = Array.isArray(items) ? items : items ? Array.from(items) : [];
    for (const item of list) {
        if (item?.type === "specialization") {
            const talents = item.system?.talents ?? {};
            for (const talent of Object.values(talents)) {
                if (talent?.islearned && talent?.isConflictTalent) add(talent.name);
            }
        } else if (item?.type === "talent" && item.system?.isConflictTalent) {
            add(item.name);
        }
    }
    return names.sort((a, b) => a.localeCompare(b));
}
