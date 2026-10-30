/**
 * Primer table rows and the career-power list. Labels are localization keys.
 * Choosing a row does not grant powers or change XP; the session dialog applies points.
 */

export const UNASSIGNED_SPECIALIZATIONS = Object.freeze([
    "Force-Sensitive Exile",
    "Force-Sensitive Emergent",
    "Force-Sensitive Outcast",
    "Nightsister",
    "Padawan Survivor",
]);

export const UNIVERSAL_SPECIALIZATIONS = Object.freeze([
    { name: "Ataru Striker", powers: ["Enhance", "Seek"] },
    { name: "Juyo Berserker", powers: ["Enhance", "Valor/Horrify"] },
    { name: "Makashi Duelist", powers: ["Influence", "Insight"] },
    { name: "Niman Disciple", powers: ["Move", "Influence"] },
    { name: "Shien Expert", powers: ["Misdirect", "Sense"] },
    { name: "Shii-Cho Knight", powers: ["Enhance", "Endure"] },
    { name: "Soresu Defender", powers: ["Endure", "Sense"] },
]);

const spec = (name, powers, note = "") => Object.freeze({ name, powers: Object.freeze(powers), note });

export const CAREERS = Object.freeze([
    {
        name: "Jedi",
        powers: ["Enhance", "Sense"],
        specializations: [
            spec("Padawan", [], "ffg-star-wars-enhancements.respec.career.padawan"),
            spec("General", ["Endure", "Battle Meditation"]),
            spec("Knight", ["Influence", "Move"]),
            spec("Master", [], "ffg-star-wars-enhancements.respec.career.master"),
            spec("Temple Guardian", ["Bind", "Suppress"]),
            spec("Wayseeker", ["Ebb/Flow", "Foresee"]),
        ],
    },
    {
        name: "Consular",
        powers: ["Influence", "Move"],
        specializations: [
            spec("Arbiter", ["Bind", "Insight"]),
            spec("Archivist", ["Manipulate", "Psychometry"]),
            spec("Ascetic", ["Ebb/Flow", "Endure"]),
            spec("Healer", ["Heal/Harm", "Protect/Unleash"]),
            spec("Sage", ["Foresee", "Sense"]),
            spec("Teacher", ["Valor/Horrify", "Imbue/Exhaust"]),
        ],
    },
    {
        name: "Guardian",
        powers: ["Enhance", "Protect/Unleash"],
        specializations: [
            spec("Armorer", ["Manipulate", "Endure"]),
            spec("Lancer", ["Manipulate", "Commune"]),
            spec("Peacekeeper", ["Battle Meditation", "Influence"]),
            spec("Protector", ["Heal/Harm", "Move"]),
            spec("Warden", ["Bind", "Valor/Horrify"]),
            spec("Warleader", ["Alter", "Foresee"]),
        ],
    },
    {
        name: "Mystic",
        powers: ["Foresee", "Sense"],
        specializations: [
            spec("Advisor", ["Imbue/Exhaust", "Influence"]),
            spec("Alchemist", ["Heal/Harm", "Conjure"]),
            spec("Magus", ["Heal/Harm", "Protect/Unleash"]),
            spec("Prophet", ["Influence", "Valor/Horrify"]),
            spec("Seer", ["Ebb/Flow", "Seek"]),
            spec("Shaman", ["Alter", "Psychometry"]),
        ],
    },
    {
        name: "Seeker",
        powers: ["Farsight", "Seek"],
        specializations: [
            spec("Executioner", ["Bind", "Enhance"]),
            spec("Hermit", ["Alter", "Commune"]),
            spec("Hunter", ["Alter", "Insight"]),
            spec("Navigator", ["Ebb/Flow", "Foresee"]),
            spec("Pathfinder", ["Commune", "Endure"]),
            spec("Reclaimer", ["Manipulate", "Psychometry"]),
        ],
    },
    {
        name: "Sentinel",
        powers: ["Misdirect", "Move"],
        specializations: [
            spec("Artisan", ["Manipulate", "Psychometry"]),
            spec("Investigator", ["Psychometry", "Sense"]),
            spec("Racer", ["Enhance", "Foresee"]),
            spec("Sentry", ["Enhance", "Insight"]),
            spec("Shadow", ["Farsight", "Suppress"]),
            spec("Trickster", ["Influence", "Sense"]),
        ],
    },
    {
        name: "Warrior",
        powers: ["Enhance", "Sense"],
        specializations: [
            spec("Aggressor", ["Endure", "Valor/Horrify"]),
            spec("Champion", ["Influence", "Valor/Horrify"]),
            spec("Colossus", ["Bind", "Endure"]),
            spec("Slayer", ["Farsight", "Seek"]),
            spec("Starfighter Ace", ["Manipulate", "Seek"]),
            spec("Steel Hand Adept", ["Move", "Suppress"]),
        ],
    },
]);

const row = (id, label, min, max, extra = {}) =>
    Object.freeze({ id, label, min, max, murder: false, open: false, ...extra });

export const TRANQUILITY_ROWS = Object.freeze([
    row("kindness", "ffg-star-wars-enhancements.respec.table.kindness", 1, 1),
    row("honesty", "ffg-star-wars-enhancements.respec.table.honesty", 1, 1),
    row("peace", "ffg-star-wars-enhancements.respec.table.peace", 1, 1),
    row("cooperation", "ffg-star-wars-enhancements.respec.table.cooperation", 2, 2),
    row("restraint", "ffg-star-wars-enhancements.respec.table.restraint", 2, 2),
    row("generosity", "ffg-star-wars-enhancements.respec.table.generosity", 2, 3),
    row("prevent-destruction", "ffg-star-wars-enhancements.respec.table.prevent-destruction", 3, 4),
    row("defend-innocent", "ffg-star-wars-enhancements.respec.table.defend-innocent", 4, 5),
    row("care-creatures", "ffg-star-wars-enhancements.respec.table.care-creatures", 6, 7),
    row("comfort", "ffg-star-wars-enhancements.respec.table.comfort", 10, 10),
    row("justice", "ffg-star-wars-enhancements.respec.table.justice", 10, 100, { open: true }),
]);

export const CONFLICT_ROWS = Object.freeze([
    row("inaction", "ffg-star-wars-enhancements.respec.table.inaction", 1, 1),
    row("lie", "ffg-star-wars-enhancements.respec.table.lie", 1, 1),
    row("violence-first", "ffg-star-wars-enhancements.respec.table.violence-first", 1, 1),
    row("coercion", "ffg-star-wars-enhancements.respec.table.coercion", 2, 2),
    row("abuse", "ffg-star-wars-enhancements.respec.table.abuse", 2, 2),
    row("theft", "ffg-star-wars-enhancements.respec.table.theft", 2, 3),
    row("destruction", "ffg-star-wars-enhancements.respec.table.destruction", 3, 4),
    row("assault", "ffg-star-wars-enhancements.respec.table.assault", 4, 5),
    row("cruelty", "ffg-star-wars-enhancements.respec.table.cruelty", 6, 7),
    row("torture", "ffg-star-wars-enhancements.respec.table.torture", 10, 10),
    row("murder", "ffg-star-wars-enhancements.respec.table.murder", 0, 0, { murder: true }),
]);

export function rangeLabel(entry) {
    if (entry.murder) return "";
    if (entry.open) return `${entry.min}+`;
    if (entry.min === entry.max) return String(entry.min);
    return `${entry.min}–${entry.max}`;
}

/** Clamp a requested award into the row's range. Murder has no numeric award. */
export function clampAward(entry, requested) {
    if (!entry || entry.murder) return null;
    const value = Number(requested);
    if (!Number.isFinite(value)) return entry.min;
    const max = entry.open ? Number.MAX_SAFE_INTEGER : entry.max;
    return Math.min(max, Math.max(entry.min, Math.round(value)));
}

export function findRow(rows, id) {
    return rows.find((entry) => entry.id === id) ?? null;
}
