import { log_msg as log } from "./util.js";

let module_name = "talent_checker";

export function init() {
    log(module_name, "Initializing");
    game.settings.registerMenu("ffg-star-wars-enhancements", "talent_checker_UISettings", {
        name: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.conf"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.conf-hint"),
        label: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.ui.label"),
        icon: "fas fa-cut",
        type: talent_checker_UISettings,
        restricted: true,
    });
    game.settings.register("ffg-star-wars-enhancements", "talent-checker-enable", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.enable"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.enable-hint"),
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
    game.settings.register("ffg-star-wars-enhancements", "talent-checker-status", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.status"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.talent-checker.status-hint"),
        scope: "world",
        config: false,
        type: String,
        filePicker: "image",
        default: "icons/svg/regen.svg",
    });
    game.settings.register("ffg-star-wars-enhancements", "minionsize-sync-enable", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-enable"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-enable-hint"),
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
    game.settings.register("ffg-star-wars-enhancements", "minionsize-sync-status", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-status"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-status-hint"),
        scope: "world",
        config: false,
        type: String,
        filePicker: "image",
        default: "modules/ffg-star-wars-enhancements/artwork/minionsize.png",
    });
    game.settings.register("ffg-star-wars-enhancements", "minionsize-sync-status-zero", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-status-zero"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.minionsize-sync-status-zero-hint"),
        scope: "world",
        config: false,
        type: String,
        filePicker: "image",
        default: "modules/ffg-star-wars-enhancements/artwork/minionskull.png",
    });
    game.settings.register("ffg-star-wars-enhancements", "stimpack-sync-enable", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.stimpack-sync-enable"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.stimpack-sync-enable-hint"),
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
    });
    game.settings.register("ffg-star-wars-enhancements", "stimpack-sync-status", {
        module: "ffg-star-wars-enhancements",
        name: game.i18n.localize("ffg-star-wars-enhancements.stimpack-sync-status"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.stimpack-sync-status-hint"),
        scope: "world",
        config: false,
        type: String,
        filePicker: "image",
        default: "modules/ffg-star-wars-enhancements/artwork/stimpack.png",
    });
    log(module_name, "Done initializing");
}

export function talent_checker() {
    Hooks.on("canvasReady", async (canvas) => {
        if (game.user.isGM) {
            log(module_name, "Detected scene load.");
            for (let i = 0; i < canvas.tokens.placeables.length; i++) {
                // begin javascript sucks
                let actor = game.actors.get(canvas.tokens.placeables[i].actor?.id);
                if (!actor) {
                    continue;
                }
                let token = canvas.tokens.placeables[i];
                if (game.settings.get("ffg-star-wars-enhancements", "talent-checker-enable")) {
                    log(module_name, "Found token " + actor.name + "; searching for Adversary talent");
                    let ranks = get_ranks(actor);
                    await update_status(
                        token,
                        ranks,
                        game.settings.get("ffg-star-wars-enhancements", "talent-checker-status")
                    );
                }
                if (game.settings.get("ffg-star-wars-enhancements", "stimpack-sync-enable") && window.EffectCounter) {
                    let stimpack_used = get_stimpack_used(actor);
                    if (stimpack_used !== null) {
                        log(module_name, "Actor " + actor.name + " has used " + stimpack_used + "stimpacks");
                        await update_status(
                            token,
                            stimpack_used,
                            game.settings.get("ffg-star-wars-enhancements", "stimpack-sync-status")
                        );
                    }
                }
            }
        }
    });

    Hooks.on("createToken", async (scene, token, ...args) => {
        if (game.user.isGM) {
            let token_id = scene._id;
            // begin javascript sucks
            let actor_data = find_actor(token_id);
            let actor = actor_data[0];
            let token = actor_data[1];
            // end javascript sucks
            if (game.settings.get("ffg-star-wars-enhancements", "talent-checker-enable")) {
                let ranks = get_ranks(actor);
                await update_status(
                    token,
                    ranks,
                    game.settings.get("ffg-star-wars-enhancements", "talent-checker-status")
                );
            }
            if (game.settings.get("ffg-star-wars-enhancements", "stimpack-sync-enable") && window.EffectCounter) {
                let stimpack_used = get_stimpack_used(actor);
                if (stimpack_used !== null && stimpack_used !== undefined) {
                    log(module_name, "Actor " + actor.name + " has used " + stimpack_used + " stimpacks");
                    await update_status(
                        token,
                        stimpack_used,
                        game.settings.get("ffg-star-wars-enhancements", "stimpack-sync-status")
                    );
                }
            }
        }
    });
}

function get_stimpack_used(actor) {
    if (actor.type === "character") {
        log(module_name, "Found actor being added: " + actor.name);
        return actor?.system?.stats?.medical?.uses;
    } else {
        log(module_name, "Found non-actor group being added: " + actor.name);
        return null;
    }
}

function find_actor(token_id) {
    for (let i = 0; i < game.canvas.tokens.placeables.length; i++) {
        if (game.canvas.tokens.placeables[i].id === token_id) {
            return [game.actors.get(game.canvas.tokens.placeables[i].actor.id), game.canvas.tokens.placeables[i]];
        }
    }
}

function get_ranks(actor) {
    let actor_items = actor.items.filter((item) => item);
    let ranks = 0;
    for (let x = 0; x < actor_items.length; x++) {
        let item = actor_items[x];
        if (item.type === "talent" && item.name === "Adversary") {
            ranks += item.system.ranks.current;
        }
    }
    log(module_name, "Found " + ranks + " ranks of Adversary");
    return ranks;
}

export async function update_status(token, ranks, icon_path) {
    // Foundry 14: Token#toggleEffect is gone and statuses live on the actor as ActiveEffects; Status
    // Icon Counters 3 no longer creates counters from a bare icon path, it counts an existing effect.
    const actor = token?.actor ?? token?.document?.actor;
    if (!actor || !icon_path) return;
    const active = ranks !== 0;
    const status = CONFIG.statusEffects.find((s) => (s.img ?? s.icon) === icon_path);
    const statusId = status?.id ?? "ffg-sw-enhanced-" + icon_path.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const findEffect = () =>
        actor.effects.find((e) => e.statuses?.has(statusId)) ??
        actor.effects.find((e) => e.img === icon_path && !e.getFlag("core", "overlay"));
    let effect = findEffect();
    if (!active) {
        if (effect) {
            log(module_name, "Removing status from " + actor.name);
            await effect.delete();
        }
        return;
    }
    const counters = game.modules.get("statuscounter")?.active ? game.modules.get("statuscounter").api : null;
    if (!effect) {
        log(module_name, "Adding status rank " + ranks + " to " + actor.name);
        // let Status Icon Counters seed the count when it sees the effect being created
        counters?.queueCreation?.(token, statusId, ranks);
        if (status) {
            await actor.toggleStatusEffect(statusId, { active: true, overlay: false });
        } else {
            await actor.createEmbeddedDocuments("ActiveEffect", [
                { name: icon_path.split("/").pop().replace(/\.[a-z0-9]+$/i, ""), img: icon_path, statuses: [statusId] },
            ]);
        }
        effect = findEffect();
    }
    // Status Icon Counters 3 attaches a counter to every icon-bearing effect
    const counter = effect?.statusCounter;
    if (counter && counter._sourceValue !== ranks) {
        log(module_name, "Setting status count " + ranks + " on " + actor.name);
        await counter.setValue(ranks);
    }
}

class talent_checker_UISettings extends FormApplication {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "talent-checker",
            classes: [game.system.id, "data-import"],
            title: `${game.i18n.localize("ffg-star-wars-enhancements.talent-checker.title")}`,
            template: "modules/ffg-star-wars-enhancements/templates/settings.html",
        });
    }

    getData(options) {
        const gs = game.settings;
        const canConfigure = game.user.can("SETTINGS_MODIFY");

        const data = {
            system: { title: game.system.title, menus: [], settings: [] },
        };

        // Classify all settings
        for (let setting of gs.settings.values()) {
            // Exclude settings the user cannot change
            if (
                (!setting.key.includes("talent-checker-") &&
                    !setting.key.includes("minionsize-sync-") &&
                    !setting.key.includes("stimpack-sync-")) ||
                (!canConfigure && setting.scope !== "client")
            )
                continue;

            // Update setting data
            const s = foundry.utils.duplicate(setting);
            s.name = game.i18n.localize(s.name);
            s.hint = game.i18n.localize(s.hint);
            s.value = game.settings.get(s.module, s.key);
            s.type = setting.type instanceof Function ? setting.type.name : "String";
            s.isCheckbox = setting.type === Boolean;
            s.isSelect = s.choices !== undefined;
            s.isRange = setting.type === Number && s.range;
            s.isFilePicker = setting.valueType === "FilePicker";

            // Classify setting
            const name = s.module;
            if (
                s.key.includes("talent-checker-") ||
                s.key.includes("minionsize-sync-") ||
                s.key.includes("stimpack-sync-")
            )
                data.system.settings.push(s);
        }

        // Return data
        return {
            user: game.user,
            canConfigure: canConfigure,
            systemTitle: game.system.title,
            data: data,
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".submenu button").click(this._onClickSubmenu.bind(this));
        html.find('button[name="reset"]').click(this._onResetDefaults.bind(this));
        html.find("button.filepicker").click(this._onFilePicker.bind(this));
    }

    /**
     * Handle activating the button to configure User Role permissions
     * @param event {Event}   The initial button click event
     * @private
     */
    _onClickSubmenu(event) {
        event.preventDefault();
        const menu = game.settings.menus.get(event.currentTarget.dataset.key);
        if (!menu) return ui.notifications.error("No submenu found for the provided key");
        const app = new menu.type();
        return app.render(true);
    }

    /* -------------------------------------------- */

    /**
     * Handle button click to reset default settings
     * @param event {Event}   The initial button click event
     * @private
     */
    _onResetDefaults(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const form = button.form;
        for (let [k, v] of game.settings.settings.entries()) {
            if (!v.config) {
                let input = form[k];
                if (input && input.type === "checkbox") {
                    input.checked = v.default;
                } else if (input) {
                    input.value = v.default;
                }
            }
        }
    }

    /* -------------------------------------------- */

    _onFilePicker(event) {
        event.preventDefault();

        const fp = new FilePicker({
            type: "image",
            callback: (path) => {
                $(event.currentTarget).prev().val(path);
                //this._onSubmit(event);
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
        });
        return fp.browse();
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {
        for (let [k, v] of Object.entries(foundry.utils.flattenObject(formData))) {
            let s = game.settings.settings.get(k);
            let current = game.settings.get(s.module, s.key);
            if (v !== current) {
                await game.settings.set(s.module, s.key, v);
            }
        }
    }
}
