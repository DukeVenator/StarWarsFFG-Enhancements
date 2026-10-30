import { log_msg as log } from "../util.js";
import { awardRow, characterRow } from "./session.js";
import { presenceOn } from "./settings.js";
import { CONFLICT_ROWS, TRANQUILITY_ROWS, findRow, rangeLabel } from "./tables.js";
import { confirmHtml, escapeHtml, sessionCharacters, t } from "./ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "modules/ffg-star-wars-enhancements/templates/respec/table.html";

const awardApps = new Map();

export function openAwardDialog(track, actorId = "") {
    const resolved = track === "conflict" ? "conflict" : "tranquility";
    let app = awardApps.get(resolved);
    if (!app) {
        app = new AwardDialog(resolved, actorId);
        awardApps.set(resolved, app);
    } else if (actorId) {
        app.actorId = actorId;
    }
    app.render(true);
    return app;
}

export class AwardDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(track, actorId = "") {
        const resolved = track === "conflict" ? "conflict" : "tranquility";
        super({
            id: `ffg-respec-award-${resolved}`,
            window: {
                title: t(resolved === "conflict" ? "table-conflict-title" : "table-tranquility-title"),
                resizable: true,
                icon: resolved === "conflict" ? "fa-solid fa-bolt" : "fa-solid fa-feather",
            },
        });
        this.track = resolved;
        this.actorId = actorId || sessionCharacters()[0]?.actor.id || "";
        this.#bound = false;
    }

    #bound;

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            classes: ["respec-window", "respec-award-window"],
            position: { width: 620, height: 760 },
        }, { inplace: false });
    }

    static PARTS = {
        content: { template: TEMPLATE, scrollable: [".respec-award"] },
    };

    _prepareContext() {
        const rows = this.track === "conflict" ? CONFLICT_ROWS : TRANQUILITY_ROWS;
        const characters = sessionCharacters().map(({ actor, players, extra }) => {
            const row = characterRow(actor, players, extra);
            return {
                id: row.id,
                name: row.name,
                img: row.img,
                players: row.players,
                conflict: row.conflict,
                tranquility: row.tranquility,
                morality: row.morality,
                selected: actor.id === this.actorId,
            };
        });
        const current = characters.find((character) => character.selected) ?? characters[0] ?? null;
        return {
            track: this.track,
            title: t(this.track === "conflict" ? "table-conflict-title" : "table-tranquility-title"),
            subtitle: t(this.track === "conflict" ? "table-conflict-subtitle" : "table-tranquility-subtitle"),
            presence: presenceOn(),
            hasCharacters: characters.length > 0,
            characters,
            current,
            rows: rows.map((entry) => ({
                id: entry.id,
                label: game.i18n.localize(entry.label),
                range: rangeLabel(entry),
                ranged: !entry.murder && entry.min !== entry.max,
                open: Boolean(entry.open),
                min: entry.min,
                max: entry.max,
                murder: entry.murder,
            })),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (!root) return;
        if (!this.#bound) {
            this.#bound = true;
            root.addEventListener("change", (event) => {
                const select = event.target.closest("[data-actor-select]");
                if (!select) return;
                this.actorId = select.value;
                this.render();
            });
        }
    }

    _onClickAction(event, target) {
        const action = target?.dataset?.action;
        if (action !== "award") return;
        event.preventDefault();
        event.stopPropagation();
        this.#award(target).catch((error) => log("respec", error));
    }

    async #award(button) {
        if (!game.user.isGM) return;
        const rows = this.track === "conflict" ? CONFLICT_ROWS : TRANQUILITY_ROWS;
        const entry = findRow(rows, button.dataset.row);
        const actor = game.actors.get(this.actorId);
        if (!entry || !actor) return;
        if (entry.murder) {
            const confirmed = await confirmHtml(
                t("table-conflict-title"),
                `<p>${escapeHtml(t("award-murder-confirm", { name: actor.name }))}</p>`,
                t("table-flip")
            );
            if (!confirmed) return;
        }
        const container = button.closest(".respec-award-row");
        const requested = container?.querySelector("[data-amount]")?.value ?? entry.min;
        await awardRow(actor, entry, requested, this.track);
        this.render();
    }
}
