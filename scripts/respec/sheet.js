import { log_msg as log } from "../util.js";
import { learnedConflictTalents } from "./presence.js";
import { addConflict, characterRow, cyclePresencePoint, markPullSpent, refreshPullDie } from "./session.js";
import { masterOn, optionOn, presenceOn, RESPEC } from "./settings.js";
import { canEdit, rootOf, t } from "./ui.js";

const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

const TEMPLATE = "modules/ffg-star-wars-enhancements/templates/respec/sheet.html";

export function hooks() {
    for (const name of ["renderActorSheetFFG", "renderActorSheetFFGV2"]) {
        Hooks.on(name, (app, html) => {
            inject(app, html).catch((error) => log("respec", "sheet inject failed: " + error));
        });
    }
}

async function inject(app, html) {
    if (!masterOn()) return;
    const actor = app.actor ?? app.document;
    if (!actor || actor.type !== "character") return;
    const showPresence = presenceOn();
    const showPull = optionOn(RESPEC.pull);
    const showConflict = optionOn(RESPEC.conflictUse);
    if (!showPresence && !showPull && !showConflict) return;

    const root = rootOf(html);
    const tab =
        root?.querySelector(".tab.obligation") ??
        root?.querySelector('.tab[data-tab="description"]') ??
        root?.querySelector(".sheet-body");
    if (!tab || tab.querySelector(".respec-sheet") || tab.dataset.respecInjecting === "true") return;
    tab.dataset.respecInjecting = "true";
    try {
        const row = characterRow(actor);
        const talents = learnedConflictTalents(actor.items).map((name) => ({ name }));
        const htmlString = await renderTemplate(TEMPLATE, {
            ...row,
            showPresence,
            showPull,
            showConflict,
            hasTalents: talents.length > 0,
            talents,
            editable: canEdit(actor),
        });
        if (!tab.isConnected) return;
        const holder = document.createElement("div");
        holder.innerHTML = htmlString;
        const block = holder.firstElementChild;
        if (!block) return;
        const conflictBlock = tab.querySelector('input[name="data.conflict.value"]')?.closest(".resource");
        const moralityBlock = tab.querySelector('input[name="data.morality.value"]')?.closest(".resource");
        const anchor = conflictBlock ?? moralityBlock;
        if (anchor) anchor.after(block);
        else tab.append(block);
        block.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            onSheetClick(actor.id, button).catch((error) => log("respec", error));
        });
        tab.dataset.respecInjected = "true";
    } finally {
        delete tab.dataset.respecInjecting;
    }
}

async function onSheetClick(actorId, button) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const action = button.dataset.action;
    if (action === "cycle") await cyclePresencePoint(actor, button.dataset.index);
    else if (action === "spend") await markPullSpent(actor);
    else if (action === "refresh-die") await refreshPullDie(actor);
    else if (action === "conflict") await addConflict(actor, button.dataset.talent || "");
    else if (action === "toggle") {
        const block = button.closest(".respec-sheet");
        const collapsed = block?.classList.toggle("is-collapsed");
        button.querySelector("i")?.classList.toggle("fa-chevron-up", !collapsed);
        button.querySelector("i")?.classList.toggle("fa-chevron-down", Boolean(collapsed));
        button.setAttribute("title", t(collapsed ? "expand" : "collapse"));
        button.setAttribute("aria-expanded", String(!collapsed));
    }
}
