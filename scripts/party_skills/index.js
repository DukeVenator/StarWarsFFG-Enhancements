import { log_msg as log } from "../util.js";
import { applyFfgTheme } from "../respec/theme.js";
import { auditParty, characterPalette } from "./audit.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "ffg-star-wars-enhancements";
const KEY = `${MODULE_ID}.party-skills`;
const STYLE_ID = "ffg-star-wars-enhancements-party-skills-style";
const STYLE_PATH = `modules/${MODULE_ID}/styles/party_skills.css`;
// Bump when the stylesheet changes so the injected link defeats the browser cache.
const STYLE_REVISION = "20261030";
const CHARACTERISTIC_SHORT = {
    Brawn: "BR",
    Agility: "AG",
    Intellect: "INT",
    Cunning: "CUN",
    Willpower: "WIL",
    Presence: "PR",
};

let app = null;

function t(suffix, data) {
    const key = `${KEY}.${suffix}`;
    return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

/*
 * The world keeps its package manifest in memory, so a stylesheet added to
 * module.json after the world started is not loaded until the world restarts.
 * Inject the window stylesheet ourselves so the window is never unstyled.
 */
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const loaded = [...document.querySelectorAll('link[rel="stylesheet"]')].some((link) =>
        String(link.href).includes(STYLE_PATH)
    );
    if (loaded) return;
    let href = STYLE_PATH;
    try {
        if (typeof foundry.utils?.getRoute === "function") href = foundry.utils.getRoute(STYLE_PATH);
    } catch (error) {
        log("party_skills", error);
    }
    const version = game.modules?.get?.(MODULE_ID)?.version ?? "0";
    href = `${href}?v=${encodeURIComponent(version)}-${STYLE_REVISION}`;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("error", () => log("party_skills", `Could not load ${href}`), { once: true });
    document.head.append(link);
}

function numberFrom(value) {
    if (value && typeof value === "object" && "value" in value) return numberFrom(value.value);
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return number;
}

function localizeMaybe(value) {
    if (typeof value !== "string" || !value) return "";
    if (!value.includes(".")) return value;
    try {
        const localized = game.i18n.localize(value);
        if (localized && localized !== value) return localized;
    } catch (error) {
        log("party_skills", error);
    }
    return value;
}

function skillLabel(key, skill) {
    return localizeMaybe(skill.label) || localizeMaybe(skill.name) || key;
}

function rawText(value) {
    return typeof value === "string" ? value : "";
}

function displayName(value) {
    return localizeMaybe(value) || value || "";
}

function characteristicShort(name) {
    return CHARACTERISTIC_SHORT[name] ?? String(name || "").slice(0, 3).toUpperCase();
}

function diceIcon(kind) {
    const key = kind === "yellow" ? "PROFICIENCY_ICON" : "ABILITY_ICON";
    const configured = globalThis.CONFIG?.FFG?.[key];
    if (typeof configured === "string" && configured) return configured;
    const systemId = game.system?.id ?? "starwarsffg";
    const theme = globalThis.CONFIG?.FFG?.theme ?? "starwars";
    return `systems/${systemId}/images/dice/${theme}/${kind}.png`;
}

function diceChips(proficiency, ability) {
    const yellow = Math.max(0, Math.trunc(numberFrom(proficiency)));
    const green = Math.max(0, Math.trunc(numberFrom(ability) - yellow));
    const chips = [];
    if (yellow > 0) {
        chips.push({
            kind: "yellow",
            count: yellow,
            icon: diceIcon("yellow"),
            title: t("dice-yellow", { count: yellow }),
        });
    }
    if (green > 0) {
        chips.push({
            kind: "green",
            count: green,
            icon: diceIcon("green"),
            title: t("dice-green", { count: green }),
        });
    }
    return chips;
}

function diceTitle(proficiency, ability) {
    const chips = diceChips(proficiency, ability);
    return chips.length ? chips.map((chip) => chip.title).join(", ") : t("dice-none");
}

function describePool(detail) {
    const dice = diceTitle(detail.proficiency, detail.ability);
    if (detail.characteristicName) {
        return t("pool", {
            rank: detail.rank,
            characteristic: displayName(detail.characteristicName),
            value: detail.characteristicValue,
            dice,
        });
    }
    return t("pool-plain", { rank: detail.rank, dice });
}

function diceSummary(skill) {
    if (!skill.holders.length) return t("dice-none");
    return skill.holders
        .map((holder) => diceTitle(holder.proficiency, holder.ability))
        .join(" / ");
}

/* Every character sheet assigned to a non-GM user, with the players who own it. */
function assignedCharacters() {
    const byActor = new Map();
    for (const user of game.users?.contents ?? []) {
        if (user.isGM || !user.character || user.character.type !== "character") continue;
        const actor = game.actors?.get(user.character.id) ?? user.character;
        if (!actor || actor.type !== "character") continue;
        const entry = byActor.get(actor.id) ?? { actor, players: [] };
        entry.players.push(user.name);
        byActor.set(actor.id, entry);
    }
    return [...byActor.values()].sort((left, right) => left.actor.name.localeCompare(right.actor.name));
}

function extraCharacter(id, knownIds) {
    const actor = game.actors?.get(id);
    if (!actor || actor.type !== "character" || knownIds.has(actor.id)) return null;
    return { actor, players: [], extra: true };
}

function addableCharacters(knownIds) {
    return (game.actors?.contents ?? [])
        .filter((actor) => actor?.type === "character" && !knownIds.has(actor.id))
        .sort((left, right) => left.name.localeCompare(right.name));
}

function snapshotActor(actor, color, players = "") {
    const characteristics = {};
    for (const [key, data] of Object.entries(actor.system?.characteristics ?? {})) {
        characteristics[key] = numberFrom(data?.value ?? data);
    }
    const skills = {};
    for (const [key, skill] of Object.entries(actor.system?.skills ?? {})) {
        if (!skill || typeof skill !== "object") continue;
        skills[key] = {
            label: skillLabel(key, skill),
            type: rawText(skill.type) || "General",
            characteristic: rawText(skill.characteristic),
            rank: numberFrom(skill.rank),
            career: Boolean(skill.careerskill ?? skill.career),
        };
    }
    return {
        id: actor.id,
        name: actor.name ?? "",
        img: actor.img || "",
        color,
        players,
        characteristics,
        skills,
    };
}

function formatAverage(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
}

function summaryText(summary) {
    let sections = "";
    if (summary.sectionCount === 1) sections = t("sections-one", { name: displayName(summary.strongest.type) });
    else if (summary.even) sections = t("sections-even");
    else if (summary.sectionCount > 1) {
        sections = t("sections-named", {
            strongest: displayName(summary.strongest.type),
            thinnest: displayName(summary.thinnest.type),
        });
    }
    return t("summary", {
        trained: summary.trained,
        overlap: summary.overlap,
        gaps: summary.gaps,
        sections,
    }).trim();
}

function addTitles(audit) {
    for (const section of audit.sections) {
        for (const series of section.chart.series) {
            for (const vertex of series.vertices) {
                vertex.title = t("vertex", {
                    name: vertex.detail.characterName,
                    skill: vertex.detail.skillLabel,
                    pool: describePool(vertex.detail),
                });
            }
        }
        for (const vertex of section.chart.best.vertices) {
            const holders = vertex.detail.holders
                .map((holder) => `${holder.name} — ${describePool(holder)}`)
                .join("; ");
            vertex.title = t("best-vertex", { skill: vertex.detail.skillLabel, holders });
        }
    }
}

function summaryTiles(summary) {
    const tiles = [
        {
            key: "trained",
            label: t("summary-trained"),
            value: String(summary.trained),
            meta: t("summary-trained-meta", { count: summary.skillCount }),
            tone: "is-good",
        },
        {
            key: "overlap",
            label: t("summary-overlap"),
            value: String(summary.overlap),
            meta: t("summary-overlap-meta"),
            tone: "is-gold",
        },
        {
            key: "gaps",
            label: t("summary-gaps"),
            value: String(summary.gaps),
            meta: t("summary-gaps-meta"),
            tone: "is-bad",
        },
    ];
    if (summary.even) {
        tiles.push({
            key: "even",
            label: t("summary-sections"),
            value: t("summary-even"),
            meta: t("summary-sections-meta", { count: summary.sectionCount }),
            tone: "is-gold",
        });
    } else if (summary.strongest) {
        tiles.push({
            key: "strongest",
            label: t("summary-strongest"),
            value: displayName(summary.strongest.type),
            meta: t("summary-average", { average: formatAverage(summary.strongest.average) }),
            tone: "is-strong",
        });
        if (summary.sectionCount > 1 && summary.thinnest) {
            tiles.push({
                key: "thinnest",
                label: t("summary-thinnest"),
                value: displayName(summary.thinnest.type),
                meta: t("summary-average", { average: formatAverage(summary.thinnest.average) }),
                tone: "is-thin",
            });
        }
    }
    return tiles;
}

function present(audit, activeSection = 0) {
    addTitles(audit);
    const sectionCount = audit.sections.length;
    const activeIndex = sectionCount > 0 ? Math.min(Math.max(0, activeSection), sectionCount - 1) : 0;
    const diceLegend = [
        { kind: "yellow", label: t("dice-proficiency"), icon: diceIcon("yellow") },
        { kind: "green", label: t("dice-ability"), icon: diceIcon("green") },
    ];
    const characters = audit.characters.map((character) => ({
        ...character,
        players: character.players || t("no-player"),
        top: character.top.map((skill) => ({
            ...skill,
            characteristicLabel: displayName(skill.characteristicName),
            dice: diceChips(skill.proficiency, skill.ability),
            diceTitle: diceTitle(skill.proficiency, skill.ability),
            title: describePool({
                rank: skill.rank,
                characteristicName: skill.characteristicName,
                characteristicValue: skill.characteristic,
                proficiency: skill.proficiency,
                ability: skill.ability,
            }),
        })),
        hasTop: character.top.length > 0,
        characteristics: character.characteristics.map((characteristic) => ({
            ...characteristic,
            label: displayName(characteristic.name),
            short: characteristicShort(characteristic.name),
        })),
    }));
    const sections = audit.sections.map((section, index) => ({
        index,
        type: displayName(section.type),
        verdict: section.verdict,
        verdictLabel: t(section.verdict),
        average: formatAverage(section.average),
        active: index === activeIndex,
        chart: section.chart,
        skillCount: section.skillCount,
        trainedCount: section.trainedCount,
        gapCount: section.gapCount,
        overlapCount: section.overlapCount,
        meta: t("section-meta", {
            count: section.skillCount,
            trained: section.trainedCount,
            gaps: section.gapCount,
        }),
        topSkills: section.rows.slice(0, 4).map((skill) => ({
            label: skill.chartLabel || skill.label,
            bestScore: skill.bestScore,
            dice: diceChips(skill.holders[0]?.proficiency ?? 0, skill.holders[0]?.ability ?? 0),
            title: t("best-holders", {
                score: skill.bestScore,
                names: skill.holders.map((holder) => holder.name).join(", "),
                dice: diceSummary(skill),
            }),
        })),
    }));
    const strengths = audit.strengths.map((skill) => ({
        label: skill.label,
        bestScore: skill.bestScore,
        holders: skill.holders.map((holder) => ({
            name: holder.name,
            rank: holder.rank,
            dice: diceChips(holder.proficiency, holder.ability),
            diceTitle: diceTitle(holder.proficiency, holder.ability),
        })),
    }));
    const weaknesses = audit.weaknesses.map((skill) => ({
        label: skill.label,
        bestScore: skill.bestScore,
        gap: skill.gap,
        tagLabel: skill.gap ? t("gap") : t("thin"),
        holders: skill.holders.map((holder) => ({
            name: holder.name,
            rank: holder.rank,
            dice: diceChips(holder.proficiency, holder.ability),
            diceTitle: diceTitle(holder.proficiency, holder.ability),
        })),
    }));
    const overlaps = audit.overlaps.map((skill) => ({
        label: skill.label,
        holders: skill.trained
            .slice()
            .sort((left, right) => right.rank - left.rank || left.name.localeCompare(right.name))
            .map((holder) => ({
                name: holder.name,
                rank: holder.rank,
                career: holder.career,
                dice: diceChips(holder.proficiency, holder.ability),
                diceTitle: diceTitle(holder.proficiency, holder.ability),
            })),
    }));
    const table = audit.sections.map((section) => ({
        type: displayName(section.type),
        verdictLabel: t(section.verdict),
        average: formatAverage(section.average),
        colspan: audit.characters.length + 4,
        rows: section.rows.map((skill) => ({
            label: skill.label,
            characteristic: skill.mixedCharacteristic
                ? t("mixed-characteristic")
                : displayName(skill.characteristic),
            tag: skill.tag,
            tagLabel: t(skill.tag === "overlap" ? "overlap-tag" : skill.tag),
            strength: skill.strength,
            weakness: skill.weakness,
            gap: skill.gap,
            best: {
                score: skill.bestScore,
                dice: diceChips(
                    skill.holders[0]?.proficiency ?? 0,
                    skill.holders[0]?.ability ?? 0
                ),
                title: t("best-holders", {
                    score: skill.bestScore,
                    names: skill.holders.map((holder) => holder.name).join(", "),
                    dice: diceSummary(skill),
                }),
            },
            cells: skill.cells.map((cell) => ({
                rank: cell.rank,
                rankLabel: cell.rank ? `R${cell.rank}` : "0",
                trained: cell.trained,
                career: cell.career,
                careerLabel: t("career"),
                dice: diceChips(cell.proficiency, cell.ability),
                diceTitle: diceTitle(cell.proficiency, cell.ability),
            })),
        })),
    }));
    return {
        summaryLine: summaryText(audit.summary),
        summaryTiles: summaryTiles(audit.summary),
        characters,
        hasSections: sections.length > 0,
        sections,
        strengthsHeading: t("strengths"),
        strengthsHint: t("strengths-hint"),
        weaknessesHeading: t("weaknesses"),
        weaknessesHint: t("weaknesses-hint"),
        overlapsHeading: t("overlaps"),
        overlapsHint: t("overlaps-hint"),
        breakdownHeading: t("breakdown"),
        breakdownHint: t("breakdown-hint"),
        breakdownCount: t("breakdown-count", { count: audit.summary.skillCount }),
        noStrengths: t("no-strengths"),
        noWeaknesses: t("no-weaknesses"),
        noOverlaps: t("no-overlaps"),
        skillHeading: t("skill"),
        characteristicHeading: t("characteristic"),
        bestHeading: t("best"),
        coverageHeading: t("coverage"),
        hasStrengths: strengths.length > 0,
        hasWeaknesses: weaknesses.length > 0,
        hasOverlaps: overlaps.length > 0,
        strengths,
        weaknesses,
        overlaps,
        table,
        partyBest: t("party-best"),
        diceLegend,
        chartHint: t("chart-hint"),
        whoHeading: t("who-heading"),
        whoHint: t("who-hint"),
        chartsHeading: t("charts-heading"),
        chartsHint: t("charts-hint"),
        topInSection: t("top-in-section"),
        rosterHeading: t("roster-heading"),
        removeLabel: t("remove-sheet"),
        openLabel: t("open-sheet"),
        trainedLabel: t("trained-label"),
        trainedWord: t("trained"),
        noTrainedSkills: t("no-trained-skills"),
        overlapTag: t("overlap-tag"),
        gapTag: t("gap-tag"),
        scoreLabel: t("score-label"),
        careerLabel: t("career"),
        noRanks: audit.summary.trained === 0 && audit.summary.skillCount > 0 ? t("no-ranks") : "",
        noSkills: audit.summary.skillCount === 0 ? t("no-skills") : "",
    };
}

function elementOf(application) {
    const element = application.element;
    if (!element) return null;
    if (typeof element.querySelector === "function") return element;
    if (element[0] && typeof element[0].querySelector === "function") return element[0];
    return null;
}

class PartySkillsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor() {
        super();
        this.excluded = new Set();
        this.extraIds = new Set();
        this.rosterIds = new Set();
        this.activeSection = 0;
        this.scrollTop = 0;
        this.onContentScroll = null;
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(
            super.DEFAULT_OPTIONS,
            {
                id: "ffg-star-wars-enhancements-party-skills",
                classes: ["party-skills-window"],
                window: { title: t("title"), resizable: true, minimizable: true },
                position: { width: 1160, height: 860 },
            },
            { inplace: false }
        );
    }

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/party_skills/audit.html` },
    };

    tracks(actorId) {
        return this.rosterIds.has(actorId);
    }

    eachRosterEntry() {
        const assigned = assignedCharacters();
        const known = new Set(assigned.map((entry) => entry.actor.id));
        for (const id of [...this.extraIds]) {
            if (!game.actors?.get(id)) this.extraIds.delete(id);
        }
        const extras = [];
        for (const id of [...this.extraIds].sort()) {
            const entry = extraCharacter(id, known);
            if (!entry) continue;
            extras.push(entry);
            known.add(entry.actor.id);
        }
        return [...assigned, ...extras].sort((left, right) => left.actor.name.localeCompare(right.actor.name));
    }

    _prepareContext() {
        const theme = applyFfgTheme();
        const palette = characterPalette(theme);
        const entries = this.eachRosterEntry();
        this.rosterIds = new Set(entries.map((entry) => entry.actor.id));
        const roster = entries.map((entry, index) => {
            const source = entry.extra ? t("added-sheet") : entry.players.join(", ");
            const snapshot = snapshotActor(entry.actor, palette[index % palette.length], source);
            return {
                ...snapshot,
                checked: !this.excluded.has(snapshot.id),
                extra: Boolean(entry.extra),
                source,
                sourceTitle: entry.extra ? t("added-sheet-hint") : entry.players.join(", "),
            };
        });
        const selected = roster.filter((entry) => entry.checked);
        const audit = auditParty(selected);
        const addable = addableCharacters(this.rosterIds);
        return {
            title: t("title"),
            empty: t("empty"),
            noneSelected: t("none-selected"),
            noPlayerSheets: t("no-player-sheets"),
            hasRoster: roster.length > 0,
            hasSelection: selected.length > 0,
            selectedCount: selected.length,
            rosterCount: roster.length,
            allSelected: roster.length > 0 && selected.length === roster.length,
            roster: roster.map((entry) => ({
                id: entry.id,
                name: entry.name,
                img: entry.img,
                color: entry.color,
                checked: entry.checked,
                extra: entry.extra,
                source: entry.source,
                sourceTitle: entry.sourceTitle,
            })),
            addableSheets: addable.map((actor) => ({
                id: actor.id,
                name: actor.name,
                img: actor.img || "",
            })),
            hasAddable: addable.length > 0,
            addableCount: addable.length,
            addSheetLabel: t("add-sheet"),
            addSheetHint: t("add-sheet-hint"),
            selectAllLabel: t("select-all"),
            selectNoneLabel: t("select-none"),
            refreshLabel: t("refresh"),
            sheetCountLabel: t("sheet-count", {
                selected: selected.length,
                total: roster.length,
            }),
            ...present(audit, this.activeSection),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        ensureStyles();
        const root = elementOf(this);
        const content = root?.querySelector(".window-content");
        if (content) {
            content.style.setProperty("overflow-x", "hidden", "important");
            content.style.setProperty("overflow-y", "auto", "important");
            content.style.setProperty("min-height", "0", "important");
            content.style.setProperty("padding", "0", "important");
            if (this.scrollTop) content.scrollTop = this.scrollTop;
            if (this.onContentScroll) content.removeEventListener("scroll", this.onContentScroll);
            this.onContentScroll = () => {
                this.scrollTop = content.scrollTop;
            };
            content.addEventListener("scroll", this.onContentScroll);
        }
        const section = root?.querySelector("[data-party-skills]");
        if (!section) return;
        section.addEventListener("change", (event) => this.onChange(event));
        section.addEventListener("click", (event) => this.onClick(event));
        this.applySection(this.activeSection);
    }

    onChange(event) {
        const add = event.target.closest("[data-add-sheet]");
        if (add) {
            this.addSheet(add.value);
            return;
        }
        const input = event.target.closest("input[data-actor]");
        if (!input) return;
        if (input.checked) this.excluded.delete(input.dataset.actor);
        else this.excluded.add(input.dataset.actor);
        this.render().catch((error) => log("party_skills", error));
    }

    onClick(event) {
        if (this.selectTab(event)) return;
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        if (action === "remove-sheet") {
            event.preventDefault();
            this.extraIds.delete(button.dataset.actor);
            this.excluded.delete(button.dataset.actor);
            this.render().catch((error) => log("party_skills", error));
        } else if (action === "select-all") {
            event.preventDefault();
            this.excluded.clear();
            this.render().catch((error) => log("party_skills", error));
        } else if (action === "select-none") {
            event.preventDefault();
            this.excluded = new Set(this.rosterIds);
            this.render().catch((error) => log("party_skills", error));
        } else if (action === "refresh") {
            event.preventDefault();
            this.render().catch((error) => log("party_skills", error));
        } else if (action === "open-sheet") {
            event.preventDefault();
            game.actors?.get(button.dataset.actor)?.sheet?.render(true);
        }
    }

    addSheet(actorId) {
        if (!actorId) return;
        const actor = game.actors?.get(actorId);
        if (!actor || actor.type !== "character") return;
        this.extraIds.add(actor.id);
        this.excluded.delete(actor.id);
        this.render().catch((error) => log("party_skills", error));
    }

    selectTab(event) {
        const tab = event.target.closest("[data-section-tab]");
        if (!tab) return false;
        event.preventDefault();
        this.applySection(Number(tab.dataset.sectionTab));
        return true;
    }

    applySection(index) {
        const root = elementOf(this);
        const section = root?.querySelector("[data-party-skills]");
        if (!section) return;
        const panels = [...section.querySelectorAll("[data-section-panel]")];
        if (!panels.length) return;
        const next = Math.min(Math.max(0, Number(index) || 0), panels.length - 1);
        this.activeSection = next;
        for (const tab of section.querySelectorAll("[data-section-tab]")) {
            const active = Number(tab.dataset.sectionTab) === next;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", String(active));
        }
        for (const panel of panels) {
            const active = Number(panel.dataset.sectionPanel) === next;
            panel.classList.toggle("is-active", active);
        }
    }
}

function onActorUpdate(actor) {
    if (!app?.rendered || !actor?.id) return;
    if (!app.tracks(actor.id)) return;
    app.render().catch((error) => log("party_skills", error));
}

function onUserUpdate(user, changes) {
    if (!app?.rendered) return;
    if (changes && !("character" in changes)) return;
    app.render().catch((error) => log("party_skills", error));
}

function onRosterChange() {
    if (!app?.rendered) return;
    app.render().catch((error) => log("party_skills", error));
}

function ensureHook() {
    Hooks.off("updateActor", onActorUpdate);
    Hooks.off("updateUser", onUserUpdate);
    Hooks.off("deleteActor", onRosterChange);
    Hooks.off("deleteUser", onRosterChange);
    Hooks.off("createActor", onRosterChange);
    Hooks.off("createUser", onRosterChange);
    Hooks.on("updateActor", onActorUpdate);
    Hooks.on("updateUser", onUserUpdate);
    Hooks.on("deleteActor", onRosterChange);
    Hooks.on("deleteUser", onRosterChange);
    Hooks.on("createActor", onRosterChange);
    Hooks.on("createUser", onRosterChange);
}

export function openPartySkills() {
    if (!game.user?.isGM) return;
    applyFfgTheme();
    ensureStyles();
    ensureHook();
    app ??= new PartySkillsApplication();
    app.render(true).catch((error) => log("party_skills", error));
}
