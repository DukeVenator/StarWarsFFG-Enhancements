import { log_msg as log } from "../util.js";
import * as actions from "./session.js";
import { characterRow } from "./session.js";
import {
    encounterNumber,
    fearOn,
    masterOn,
    optionOn,
    presenceOn,
    pullRollValue,
    RESPEC,
} from "./settings.js";
import {
    addableCharacters,
    addSessionCharacter,
    removeSessionCharacter,
    sessionCharacters,
    t,
} from "./ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "modules/ffg-star-wars-enhancements/templates/respec/session.html";

let sessionApp = null;

class RespecSessionApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    #collapsed = new Set();
    #scrollTop = 0;
    #initialized = false;

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "ffg-star-wars-enhancements-respec",
            classes: ["respec-window", "respec-tracker-window"],
            window: {
                title: t("tracker-title"),
                resizable: true,
                icon: "fa-solid fa-scale-balanced",
            },
            position: { width: 880, height: 840 },
        }, { inplace: false });
    }

    static PARTS = {
        content: { template: TEMPLATE, scrollable: [".respec-tracker"] },
    };

    _prepareContext() {
        const pull = optionOn(RESPEC.pull);
        const presence = presenceOn();
        const fear = fearOn();
        const unified = optionOn(RESPEC.unified);
        const careers = optionOn(RESPEC.careers);
        const conflictUse = optionOn(RESPEC.conflictUse);
        const roll = pullRollValue();
        const characters = sessionCharacters().map(({ actor, players, extra }) => ({
            ...characterRow(actor, players, extra),
            expanded: !this.#collapsed.has(actor.id),
        }));
        const added = characters
            .filter((character) => character.added)
            .map((character) => ({
                id: character.id,
                name: character.name,
                img: character.img,
            }));
        const addable = addableCharacters().map((actor) => ({
            id: actor.id,
            name: actor.name,
            img: actor.img || "icons/svg/mystery-man.svg",
        }));
        if (!this.#initialized) {
            this.#initialized = true;
            if (characters.length > 2) {
                for (const character of characters) this.#collapsed.add(character.id);
                for (const character of characters) character.expanded = false;
            }
        }
        const ready = characters.filter((character) => !character.pullSpent).length;
        const used = characters.filter((character) => character.pullSpent).length;
        return {
            roll,
            hasRoll: roll > 0,
            encounter: encounterNumber(),
            pull,
            presence,
            fear,
            unified,
            careers,
            conflictUse,
            characters,
            hasCharacters: characters.length > 0,
            added,
            addedCount: added.length,
            addable,
            hasAddable: addable.length > 0,
            ready,
            used,
            anyEnabled: pull || presence || unified || careers || fear || conflictUse,
            unifiedBlocked: presence,
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (root && root.dataset.respecChangeBound !== "true") {
            root.dataset.respecChangeBound = "true";
            root.addEventListener("change", (event) => {
                const add = event.target.closest("[data-add-character]");
                if (add) {
                    const select = add;
                    addSessionCharacter(select.value)
                        .catch((error) => log("respec", error))
                        .finally(() => {
                            select.value = "";
                        });
                    return;
                }
                const input = event.target.closest("[data-edit]");
                if (!input) return;
                this.#onEdit(input).catch((error) => log("respec", error));
            });
        }
        const scroller = root?.querySelector(".respec-tracker");
        if (scroller) scroller.scrollTop = this.#scrollTop;
    }

    async #onEdit(input) {
        if (!game.user.isGM || !masterOn()) return;
        const kind = input.dataset.edit;
        const actor = input.dataset.actorId ? game.actors.get(input.dataset.actorId) : null;
        if (kind === "pull") await actions.setPullRoll(input.value);
        else if (kind === "morality") await actions.setMorality(actor, input.value);
        else if (kind === "conflict") await actions.setConflict(actor, input.value);
        else if (kind === "tranquility") await actions.setTranquility(actor, input.value);
    }

    _onClickAction(event, target) {
        const action = target?.dataset?.action;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        this.#onAction(action, target.dataset).catch((error) => log("respec", error));
    }

    async #onAction(action, dataset) {
        if (!game.user.isGM || !masterOn()) return;
        const actor = dataset.actorId ? game.actors.get(dataset.actorId) : null;
        switch (action) {
            case "toggle-card":
                this.#toggleCard(dataset.actorId);
                return;
            case "remove-character":
                await removeSessionCharacter(dataset.actorId);
                return;
            case "roll-pull":
                await actions.rollPull();
                return;
            case "share-pull":
                await actions.postPullSummary({ intro: t("chat-pull-shared", { roll: pullRollValue() }) });
                return;
            case "new-encounter":
                await actions.newEncounter();
                return;
            case "cycle-pip":
                await actions.cyclePresencePoint(actor, dataset.index);
                return;
            case "adjust":
                await actions.adjustStat(actor, dataset.stat, Number(dataset.delta));
                return;
            case "mark-spent":
                await actions.markPullSpent(actor);
                return;
            case "refresh-die":
                await actions.refreshPullDie(actor);
                return;
            case "fear":
                await actions.recordFear(actor, dataset.fear);
                return;
            case "apply":
                await actions.applyThresholds(actor);
                return;
            case "apply-all":
                for (const character of sessionCharacters()) await actions.applyThresholds(character.actor);
                return;
            case "end-session":
                await actions.endSession();
                return;
            case "unified":
                await actions.unifiedRoll();
                return;
            case "tranquility-table": {
                const { openAwardDialog } = await import("./award-app.js");
                openAwardDialog("tranquility", actor?.id ?? "");
                return;
            }
            case "conflict-table": {
                const { openAwardDialog } = await import("./award-app.js");
                openAwardDialog("conflict", actor?.id ?? "");
                return;
            }
            case "careers": {
                const { openCareerDialog } = await import("./careers-app.js");
                openCareerDialog();
                return;
            }
            case "open-settings": {
                const { openRespecSettings } = await import("./settings-app.js");
                openRespecSettings();
                return;
            }
            case "roll-morality":
                await actions.rollMoralityCheck(actor);
                return;
            case "roll-conflict":
                await actions.rollConflictGain(actor);
                return;
            case "roll-tranquility":
                await actions.rollTranquilityGain(actor);
                return;
            default:
                return;
        }
    }

    #toggleCard(actorId) {
        if (!actorId) return;
        const scroller = this.element?.querySelector(".respec-tracker");
        this.#scrollTop = scroller?.scrollTop ?? 0;
        if (this.#collapsed.has(actorId)) this.#collapsed.delete(actorId);
        else this.#collapsed.add(actorId);
        this.render();
    }

    refresh() {
        const scroller = this.element?.querySelector(".respec-tracker");
        this.#scrollTop = scroller?.scrollTop ?? 0;
        if (this.rendered) this.render();
    }
}

export function openRespecSession() {
    if (!game.user.isGM) {
        ui.notifications.warn(t("no-permission"));
        return null;
    }
    if (!masterOn()) {
        import("./settings-app.js")
            .then((module) => module.openRespecSettings())
            .catch((error) => log("respec", error));
        return null;
    }
    sessionApp ??= new RespecSessionApplication();
    sessionApp.render(true);
    return sessionApp;
}

export function hooks() {
    Hooks.on("ffgRespecRefresh", () => {
        if (sessionApp?.rendered) sessionApp.refresh();
    });
}
