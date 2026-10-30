/**
 * The crawl styles the creator can make and the renderer can play.
 *
 * A new type is an entry here, a `.crawl-type-<id>` block in
 * styles/opening_crawl.css, and the label/description/intro strings in
 * lang/en.json. Everything here is pure data so it can be unit tested without
 * Foundry.
 *
 * `effects` describes what the type *supports*; the user's global effect
 * settings decide whether those supported effects actually run.
 */

const PREFIX = "ffg-star-wars-enhancements.opening-crawl.";

export const CRAWL_TYPES = {
    saga: {
        id: "saga",
        label: `${PREFIX}type-saga`,
        description: `${PREFIX}type-saga-description`,
        intro: [`${PREFIX}intro-1`, `${PREFIX}intro-2`],
        wordmark: ["STAR", "WARS"],
        wordmarkUsesTitleFont: false,
        wordmarkStarJedi: true,
        effects: null,
    },
    "clone-wars": {
        id: "clone-wars",
        label: `${PREFIX}type-clone-wars`,
        description: `${PREFIX}type-clone-wars-description`,
        intro: [`${PREFIX}type-clone-wars-intro-1`, `${PREFIX}type-clone-wars-intro-2`],
        wordmark: ["CLONE", "WARS"],
        wordmarkUsesTitleFont: false,
        wordmarkStarJedi: true,
        effects: {
            kind: "dust",
            particle: "#8fd8ff",
            streak: "#d6f2ff",
            scanlines: true,
            vignette: true,
            streaks: true,
        },
    },
    "criminal-empire": {
        id: "criminal-empire",
        label: `${PREFIX}type-criminal-empire`,
        description: `${PREFIX}type-criminal-empire-description`,
        intro: [`${PREFIX}type-criminal-empire-intro-1`, `${PREFIX}type-criminal-empire-intro-2`],
        wordmark: ["CRIMINAL", "EMPIRE"],
        wordmarkUsesTitleFont: true,
        wordmarkStarJedi: false,
        effects: {
            kind: "ember",
            particle: "#ff9a5a",
            streak: "#ffb27a",
            scanlines: false,
            vignette: true,
            streaks: false,
        },
    },
};

export const CRAWL_TYPE_IDS = Object.freeze(Object.keys(CRAWL_TYPES));

export const DEFAULT_CRAWL_TYPE = "saga";

/** Resolve a type id, falling back to the saga crawl for old journals. */
export function crawl_type_of(id) {
    return Object.prototype.hasOwnProperty.call(CRAWL_TYPES, id) ? CRAWL_TYPES[id] : CRAWL_TYPES[DEFAULT_CRAWL_TYPE];
}

function localize(key, translate) {
    if (typeof translate === "function") return translate(key);
    if (typeof game !== "undefined" && game?.i18n?.localize) return game.i18n.localize(key);
    return key;
}

/**
 * Data for the creator's type cards, in display order.
 *
 * @param {Function} [translate] Localization function; defaults to `game.i18n.localize`.
 * @returns {object[]} `{ id, label, description, checked }`
 */
export function crawl_type_choices(translate) {
    return CRAWL_TYPE_IDS.map((id, index) => {
        const type = CRAWL_TYPES[id];
        return {
            id: type.id,
            label: localize(type.label, translate),
            description: localize(type.description, translate),
            checked: index === 0,
        };
    });
}

/**
 * Prepare episode/title text for the SWCrawlTitle font.
 *
 * That font maps a capital "S" to the full STAR WARS logo and a capital "L" to
 * the phrase "A long time ago in a galaxy far, far away...", so a title such as
 * "TOTALLY LEGAL" would sprout the logo and whole sentences inside the crawl.
 * Its lowercase letters are drawn as normal capitals, so use the lowercase
 * glyphs for S and L. Titles are uppercased here because CSS text-transform
 * would turn the fix back into the special glyphs.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.uppercase] Uppercase the line before the S/L substitution.
 * @returns {string}
 */
export function crawl_title_text(value, { uppercase = false } = {}) {
    let text = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    if (uppercase) text = text.toUpperCase();
    return text.replace(/S/g, "s").replace(/L/g, "l");
}

/**
 * Prepare wordmark text for StarJedi.
 *
 * StarJedi was drawn for "STAR WARS": its capital O glyph reads as an N, so
 * CLONE came out as CLNNE. The font's zero is a proper O in the logo style.
 */
export function crawl_starjedi_text(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/O/g, "0");
}

/** Escape text for the crawl's own innerHTML. */
export function escape_html(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Escape crawl text and wrap the digit "1", because SWCrawlTitle gives that
 * glyph a very wide advance and 10 otherwise reads as "1 0". Only the 1 is
 * wrapped: the other digits have normal widths, so "Episode 4" keeps its
 * spacing. The wrapped glyph is created before escaping, so numeric entities
 * such as `&#39;` are never split apart.
 */
export function crawl_number_html(value) {
    return String(value ?? "")
        .split(/(1)/)
        .map((part) => (part === "1" ? '<span class="crawl-num">1</span>' : escape_html(part)))
        .join("");
}
