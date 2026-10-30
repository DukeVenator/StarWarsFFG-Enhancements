import { log_msg as log } from "./util.js";
import { applyShopWindowTheme, open_shop_generator, shopConfirm, shopThemeClass } from "./shop.js";

/* The system's V2 actor sheet, taken from the sheet registry under the RUNNING system id (the
 * system may be installed as e.g. starwarsffg_sandbox) instead of a hard-coded import path. Only
 * available once the system has registered its sheets, i.e. from the init hook on. */
function systemSheetBase() {
    const registered = CONFIG.Actor?.sheetClasses?.character ?? {};
    return (
        registered[`${game.system.id}.ActorSheetFFGV2`]?.cls ??
        Object.values(registered).map((s) => s.cls).find((c) => c?.name === "ActorSheetFFGV2")
    );
}

let module_name = "shop_sheet";

const SHOP_LAYOUT_SETTING = "shop_inventory_layout";
const SHOP_LIST_BREAKPOINT = 760;

function shopText(value) {
    const text = value === undefined || value === null ? "" : String(value);
    if (text.startsWith("SWFFG.")) return game.i18n.localize(text);
    return text;
}

function fieldValue(field) {
    if (field == null || field === "") return "";
    if (typeof field !== "object") return shopText(field);
    /* Gear never writes `adjusted`, so the template default of 0 would hide the real value. */
    const adjusted = field.adjusted;
    const value = field.value;
    const adjustedUsable = adjusted !== undefined && adjusted !== null && adjusted !== "" && !(Number(adjusted) === 0 && value !== undefined && value !== null && value !== "" && Number(value) !== 0);
    const raw = adjustedUsable ? adjusted : value;
    if (raw !== undefined && raw !== null && raw !== "") return shopText(raw);
    if (typeof field.label === "string") return shopText(field.label);
    return "";
}

function shopRow(icon, labelKey, value, extra = {}) {
    const text = value === undefined || value === null ? "" : String(value);
    if (text === "") return null;
    return {
        icon,
        label: extra.raw ? labelKey : game.i18n.localize(labelKey),
        value: text,
        highlight: Boolean(extra.highlight),
        primary: Boolean(extra.primary),
        restricted: Boolean(extra.restricted),
    };
}

function shopTypeLabel(type) {
    const key = `TYPES.Item.${type}`;
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
    if (type === "armour" || type === "armor") return game.i18n.localize("SWFFG.ItemsArmor");
    return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
}

/* OggDude text-only modifiers have no compendium key. The importer stores them as
 * "Unique Mod N" and puts the real wording in system.description (MiscDesc).
 * Long wording belongs on the item card, not on the compact shop row. */
function shopQualityLabel(mod) {
    if (!mod) return "";
    if (typeof mod === "string") return mod.length <= 40 ? mod : "";
    const rawName = mod.name ?? mod.system?.name ?? "";
    const description = String(mod.system?.description ?? mod.description ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const rank = Number(mod.system?.rank ?? mod.rank ?? 0);
    const placeholder = /^Unique Mod(?:\s+\d+)?$/i.test(rawName);
    const name = placeholder ? description : rawName;
    if (!name || name.length > 40) return "";
    if (Number.isFinite(rank) && rank > 1) return `${name} ${rank}`;
    return name;
}

function shopStock(item) {
    const raw = item.system?.quantity?.value;
    if (raw === undefined || raw === null || raw === "") return 1;
    const count = Number(raw);
    return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 1;
}

function shopCreditCost(item, flaggedPrice) {
    const flagged = Number(flaggedPrice);
    const fromItem = Number(fieldValue(item.system?.price));
    if (Number.isFinite(flagged) && flagged > 0) return flagged;
    if (Number.isFinite(fromItem) && fromItem > 0) return fromItem;
    if (Number.isFinite(flagged)) return flagged;
    return Number.isFinite(fromItem) ? fromItem : 0;
}

/* Ten pips. A higher rarity lights more of them, and each pip has its own colour. */
function shopRarity(item) {
    const raw = Number(fieldValue(item.system?.rarity));
    const value = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
    const rank = Math.min(10, value);
    return {
        rarityValue: value,
        rarityPips: Array.from({ length: 10 }, (_, index) => ({ on: index < rank })),
        restricted: Boolean(item.system?.rarity?.isrestricted),
    };
}

const CONSUMABLE_TAG = /drug|poison|food|spice|alcohol|beverage|consumable|stim|medpac|ration/;
const SHELF_SKIP = new Set(["gear", "weapon", "armor", "armour", "item", "equipment", "itemattachment"]);

function titleTag(tag) {
    return String(tag).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shopTags(item) {
    return (item.system?.metadata?.tags ?? [])
        .map((tag) => String(tag).toLowerCase().trim())
        .filter((tag) => tag && !SHELF_SKIP.has(tag));
}

/* Used only when the shopper sorts by type. The card itself always names its own kind. */
function shopShelf(item) {
    const type = item.type;
    if (type === "weapon" || type === "shipweapon") {
        return { id: "weapon", label: game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.weapon") };
    }
    if (type === "armour" || type === "armor") {
        return { id: "armour", label: game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.armour") };
    }
    if (type === "itemattachment" || type === "shipattachment") {
        return { id: "attachment", label: game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.attachment") };
    }
    const tags = shopTags(item);
    const specific = tags.length ? titleTag(tags[tags.length - 1]) : "";
    if (tags.some((tag) => CONSUMABLE_TAG.test(tag))) {
        return {
            id: "consumable",
            label: game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.consumable"),
            subtitle: specific || game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.consumable"),
        };
    }
    if (specific) return { id: `gear:${tags[tags.length - 1]}`, label: specific, subtitle: specific };
    const gear = game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.group.gear");
    return { id: "gear", label: gear, subtitle: gear };
}

function shelfRank(id) {
    const rank = { weapon: 0, armour: 1, consumable: 2, attachment: 3, gear: 4 };
    return rank[String(id).split(":")[0]] ?? 5;
}

function shopPlainText(html) {
    return String(html ?? "")
        .replace(/<h3[\s\S]*$/i, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function shopBlurb(item) {
    const text = shopPlainText(item.system?.description);
    if (!text) return "";
    if (text.length <= 140) return text;
    return `${text.slice(0, 137).replace(/\s+\S*$/, "")}…`;
}

function shopShort(value, limit = 42) {
    const text = String(value ?? "").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
}

function shopHardpoints(system) {
    const hp = system.hardpoints;
    if (!hp) return "";
    const cap = fieldValue(hp);
    if (cap === "") return "";
    const current = hp.current;
    if (current !== undefined && current !== null && current !== "" && String(current) !== String(cap)) return `${current} / ${cap}`;
    return String(cap);
}

function shopHasHardpoints(text) {
    if (!text) return false;
    const lead = Number(String(text).split("/")[0]);
    return !(Number.isFinite(lead) && lead === 0 && !String(text).includes("/"));
}

const FIRING_ARCS = {
    fore: "SWFFG.VehicleFiringArcForward",
    aft: "SWFFG.VehicleFiringArcAft",
    port: "SWFFG.VehicleFiringArcPort",
    starboard: "SWFFG.VehicleFiringArcStarboard",
    dorsal: "SWFFG.VehicleFiringArcDorsal",
    ventral: "SWFFG.VehicleFiringArcVentral",
};

function shopArcs(system) {
    const arcs = system.firingarc;
    if (!arcs) return "";
    return Object.entries(FIRING_ARCS)
        .filter(([key]) => arcs[key])
        .map(([, key]) => game.i18n.localize(key))
        .join(", ");
}

function shopFits(system) {
    const raw = String(system.type ?? "all").trim().toLowerCase();
    if (!raw || raw === "all") return game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.fits-any");
    return shopTypeLabel(raw);
}

function shopAttributeRows(system, icon) {
    const attrs = system.attributes;
    if (!attrs || typeof attrs !== "object") return [];
    const rows = [];
    for (const attr of Object.values(attrs)) {
        if (!attr || typeof attr !== "object") continue;
        const value = attr.value;
        if (value === undefined || value === null || value === "" || Number(value) === 0) continue;
        const mod = String(attr.mod || attr.label || "").trim();
        if (!mod) continue;
        const label = mod.startsWith("SWFFG.") ? game.i18n.localize(mod) : titleTag(mod);
        const row = shopRow(icon, label, value, { raw: true, primary: true });
        if (row) rows.push(row);
        if (rows.length === 3) break;
    }
    return rows;
}

function shopNote(value) {
    const text = shopShort(value, 80);
    if (!text || /^(special|none|n\/a|-)$/i.test(text)) return "";
    return text;
}

/* Stat rows follow the system item card. The bracket strip is only the footer
 * (encumbrance, hard points, rarity, price). Range stays on its own row. */
function shopItemFacts(item) {
    const system = item.system ?? {};
    const type = item.type;
    const shelf = shopShelf(item);
    const stats = [];
    const brackets = [];
    const pushStat = (row) => {
        if (row) stats.push(row);
    };
    const pushBracket = (row) => {
        if (row) brackets.push(row);
    };
    const encumbrance = () => pushBracket(shopRow("fa-weight-hanging", "SWFFG.Encumbrance", fieldValue(system.encumbrance)));
    const hardpoints = (labelKey) => {
        const hp = shopHardpoints(system);
        if (shopHasHardpoints(hp)) pushBracket(shopRow("fa-wrench", labelKey, hp));
    };
    let blurb = "";
    let note = "";
    let qualityLimit = 3;
    let footer = false;

    if (type === "weapon" || type === "shipweapon") {
        const damageKey = type === "shipweapon" ? "SWFFG.VehicleTabDamage" : "SWFFG.ItemsDamage";
        pushStat(shopRow("fa-hand-fist", damageKey, fieldValue(system.damage), { highlight: true }));
        pushStat(shopRow("fa-skull", "SWFFG.ItemsCritRating", fieldValue(system.crit)));
        pushStat(shopRow("fa-bullseye", "SWFFG.ItemWeaponRange", fieldValue(system.range), { highlight: true }));
        if (type === "shipweapon") {
            const arcs = shopArcs(system);
            if (arcs) pushStat(shopRow("fa-arrows-up-down-left-right", "SWFFG.VehicleTabFiringArc", arcs));
        }
        note = shopNote(fieldValue(system.special));
        hardpoints(type === "shipweapon" ? "SWFFG.VehicleTabHardPoints" : "SWFFG.Labels.HardPoints");
        encumbrance();
        footer = true;
        qualityLimit = 4;
    } else if (type === "armour" || type === "armor") {
        pushStat(shopRow("fa-shield-halved", "SWFFG.ItemsDefense", fieldValue(system.defence), { highlight: true }));
        pushStat(shopRow("fa-helmet-battle", "SWFFG.ItemsSoak", fieldValue(system.soak)));
        hardpoints("SWFFG.Labels.HardPoints");
        encumbrance();
        footer = true;
        qualityLimit = 4;
    } else if (type === "itemattachment" || type === "shipattachment") {
        const hp = shopHardpoints(system);
        pushStat(shopRow("fa-wrench", type === "shipattachment" ? "SWFFG.VehicleTabHardPoints" : "SWFFG.Labels.RequiredHardPoints", hp === "" ? "0" : hp, { highlight: true }));
        pushStat(shopRow("fa-link", "ffg-star-wars-enhancements.shop.html.inventory.fits", shopFits(system)));
        encumbrance();
        blurb = shopBlurb(item);
        footer = true;
        qualityLimit = 4;
    } else {
        const icon = shelf.id === "consumable" ? "fa-kit-medical" : "fa-sliders";
        for (const row of shopAttributeRows(system, icon)) pushStat(row);
        pushStat(shopRow("fa-weight-hanging", "SWFFG.Encumbrance", fieldValue(system.encumbrance)));
        const mods = Array.isArray(system.itemmodifier) ? system.itemmodifier.length : 0;
        pushStat(shopRow("fa-wrench", "SWFFG.Items.Popout.Tabs.Modifications", String(mods)));
        blurb = shopBlurb(item);
        qualityLimit = shelf.id === "consumable" ? 2 : 3;
    }

    const qualities = (system.itemmodifier ?? []).map(shopQualityLabel).filter(Boolean).slice(0, qualityLimit);
    const skill = fieldValue(system.skill);
    let subtitle = shelf.subtitle || shopTypeLabel(type);
    if ((type === "weapon" || type === "shipweapon") && skill) subtitle = skill;
    return {
        stats,
        brackets,
        footer,
        note,
        qualities,
        subtitle,
        blurb,
        cardKind: String(shelf.id).split(":")[0],
        groupId: shelf.id,
        groupLabel: shelf.label,
        ...shopRarity(item),
    };
}

/* Rarity and the shop price close the footer. Gear keeps them as rows, matching the item card. */
function shopListingStats(facts, price) {
    const stats = facts.stats.slice();
    const brackets = facts.brackets.slice();
    const rarity = shopRow("fa-magnifying-glass", "SWFFG.ItemsRarity", String(facts.rarityValue), { restricted: facts.restricted });
    const cost = shopRow("fa-dollar-sign", "SWFFG.ItemsPrice", String(price));
    if (facts.footer) {
        if (rarity) brackets.push(rarity);
        if (cost) brackets.push(cost);
    } else {
        if (rarity) stats.push(rarity);
        if (cost) stats.push(cost);
    }
    return { stats, brackets };
}

/* The sheet template is read from disk on each render, but module.json styles are fixed when
 * Foundry boots. Pull the shop sheet in here as well so a reload picks it up. */
function ensureShopStyles() {
    const marker = "shop_generator_vendor.css";
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href.includes(marker))) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "modules/ffg-star-wars-enhancements/styles/shop_generator_vendor.css";
    document.head.appendChild(link);
}

/* Register the vendor sheet */
export function init() {
    ensureShopStyles();
    game.settings.register("ffg-star-wars-enhancements", "general_shop_compendiums", {
        name: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.general.name"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.general.hint"),
        scope: "world",
        config: true,
        type: String,
        default:
            "world.oggdudearmor,world.oggdudegear,world.oggdudeweapons,world.oggdudegenericattachments",
    });
    game.settings.register("ffg-star-wars-enhancements", "armor_shop_compendiums", {
        name: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.armor.name"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.armor.hint"),
        scope: "world",
        config: true,
        type: String,
        default: "world.oggdudearmor,world.oggdudearmorattachments",
    });
    game.settings.register("ffg-star-wars-enhancements", "gear_shop_compendiums", {
        name: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.gear.name"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.gear.hint"),
        scope: "world",
        config: true,
        type: String,
        default: "world.oggdudegear,world.oggdudegenericattachments",
    });
    game.settings.register("ffg-star-wars-enhancements", "shop_inventory_layout", {
        name: game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.layout"),
        scope: "client",
        config: false,
        type: String,
        default: "grid",
    });
    game.settings.register("ffg-star-wars-enhancements", "weapon_shop_compendiums", {
        name: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.weapon.name"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.shop.setting.weapon.hint"),
        scope: "world",
        config: true,
        type: String,
        default: "world.oggdudeweapons,world.oggdudeweaponattachments",
    });
}

/*
Configures the socket listener used for purchasing items
 */
export function ready() {
    ensureShopStyles();
    // the system registers ActorSheetFFGV2 late in its own init hook (after awaits), so the vendor
    // sheet, which extends it, is registered here rather than in init
    log(module_name, "Registering sheet");
    foundry.documents.collections.Actors.registerSheet("ffg", defineVendor(), {
        label: "ffg-sw-enhanced-vendor",
        makeDefault: false,
    });
    log(module_name, "Setting up socket listener");
    game.socket.on("module.ffg-star-wars-enhancements", socket_listener);
    /* "auto" was the previous default and opened as a list in a narrow window. */
    try {
        if (game.settings.get("ffg-star-wars-enhancements", SHOP_LAYOUT_SETTING) === "auto") {
            game.settings.set("ffg-star-wars-enhancements", SHOP_LAYOUT_SETTING, "grid");
        }
    } catch (error) {
        /* the setting is registered in init; ignore a world that has not caught up yet */
    }
}

/*
Socket data handler which transfers items to the purchaser
 */
async function socket_listener(data) {
    if (data.type === "buy") {
        log(module_name, "Detected buy request");
        /* is the packet meant for us? */
        if (game.user.id === data.gm_id) {
            log(module_name, "This packet is intended for me, decoding");
            // pull out basic information we'll be referencing a bunch
            let buyer = game.actors.get(data.buyer_id._id);
            let seller = game.actors.get(data.seller_id);
            if (data.compendium_item) {
                var item = await seller.getEmbeddedDocument("Item", data.item_id);
            } else {
                var item = await game.packs.get(data.compendium).getDocument(data.item_id);
            }
            // check to see if the buyer has enough credits to afford the item
            const stock = shopStock(item);
            const quantity = Math.min(stock, Math.max(1, parseInt(data.quantity, 10) || 1));
            const unitPrice = parseInt(data.price, 10) || 0;
            const totalPrice = unitPrice * quantity;
            if (!quantity) return;
            if (buyer.system.stats.credits.value < totalPrice) {
                ChatMessage.create({
                    content:
                        '<a class="content-link" draggable="true" data-type="Actor" data-uuid="' +
                        buyer.uuid +
                        '" data-id="' +
                        data.buyer_id._id +
                        '">' +
                        buyer.name +
                        "</a> tried to buy " +
                        item.name +
                        " from " +
                        '<a class="content-link" draggable="true" data-entity="Actor" data-uuid="' +
                        seller.uuid +
                        '" data-id="' +
                        data.seller_id +
                        '">' +
                        seller.name +
                        "</a> but couldn't afford " +
                        quantity +
                        " for " +
                        totalPrice +
                        " credits!",
                });
            } else {
                const owned = item.toObject();
                owned.system ??= {};
                if (owned.system.quantity && typeof owned.system.quantity === "object") owned.system.quantity.value = quantity;
                else owned.system.quantity = { value: quantity };
                await buyer.createEmbeddedDocuments("Item", [owned]);
                const remaining = stock - quantity;
                if (remaining > 0) await item.update({ "system.quantity.value": remaining });
                else await seller.deleteEmbeddedDocuments("Item", [data.item_id]);
                /* this doesn't seem to actually get reflected on the character sheet */
                buyer.system.stats.credits.value -= totalPrice;
                ChatMessage.create({
                    content:
                        '<a class="content-link" draggable="true" data-entity="Actor" data-uuid="' +
                        buyer.uuid +
                        '" data-id="' +
                        data.buyer_id._id +
                        '">' +
                        buyer.name +
                        "</a> bought " +
                        quantity +
                        " " +
                        item.name +
                        " from " +
                        '<a class="content-link" draggable="true" data-entity="Actor" data-uuid="' +
                        buyer.uuid +
                        '" data-id="' +
                        data.seller_id +
                        '">' +
                        seller.name +
                        "</a> for " +
                        totalPrice +
                        " credits! (make sure to deduct the credits from your sheet)",
                });
            }
        } else {
            log(module_name, "rejected message as it isn't for us");
        }
    } else if (data.type === "display") {
        log(module_name, "Detected display request");
        const actor_uuid = data.actor_uuid;
        const actor = await fromUuid(actor_uuid);
        if (!actor) {
            log(module_name, "No actor to display found!");
            return;
        }
        await actor.sheet.render(true);
    }
}

/*
Helper function to convert an item name to the item ID
 */
async function find_item_id(actor_id, item_name) {
    let vendor = game.actors.get(actor_id);
    let items = vendor.items.filter((item) => item);
    for (let x = 0; x < items.length; x++) {
        if (items[x].name === item_name) {
            return items[x].id;
        }
    }
    return null;
}

/* The system card asks the item sheet for summarized qualities. That sheet walks the live
 * item graph and overflows, and Foundry disables every <button> on a sheet the user does
 * not own. Build the card from a plain copy instead, the same way the item sheet avoids
 * the cycle. */
async function shopItemCardFallback(item) {
    const view = item.toObject(false);
    view.system ??= {};
    if (!Array.isArray(view.system.itemattachment)) view.system.itemattachment = [];
    if (!Array.isArray(view.system.itemmodifier)) view.system.itemmodifier = [];
    let prettyDesc = view.system.description ?? "";
    try {
        const { default: PopoutEditor } = await import(`/systems/${game.system.id}/modules/popout-editor.js`);
        prettyDesc = (await PopoutEditor.renderDiceImages(prettyDesc, item.actor ?? {})) || prettyDesc;
    } catch (error) {
        console.error("ffg-star-wars-enhancements | item card description", error);
    }
    const qualities = view.system.itemmodifier.filter(Boolean).map((mod) => ({
        name: mod.name ?? "",
        img: mod.img ?? "",
        description: mod.system?.description ?? mod.description ?? "",
        totalRanks: mod.system?.rank ?? mod.rank ?? 0,
    }));
    const html = await renderTemplate(`systems/${game.system.id}/templates/chat/item-card.html`, {
        item: view,
        itemDetails: {
            prettyDesc,
            doNotSubmit: { qualities },
            textProperties: [],
            specializations: [],
            signatureAbilities: [],
        },
    });
    return { html, name: item.name };
}

/*
Sets up a sheet for rendering our wonderful shop
 */
export let Vendor = null;

function defineVendor() {
    if (Vendor) return Vendor;
    const Base = systemSheetBase();
    if (!Base) throw new Error("ffg-star-wars-enhancements: the system's ActorSheetFFGV2 sheet is not registered yet");
    Vendor = class Vendor extends Base {
    /* based extensively on https://github.com/jopeek/fvtt-loot-sheet-npc-5e/blob/master/lootsheetnpc5e.js */
    constructor(...args) {
        super(...args);
        const theme = shopThemeClass();
        this.options.classes ??= [];
        if (theme && !this.options.classes.includes(theme)) this.options.classes.push(theme);
    }

    static get defaultOptions() {
        const options = super.defaultOptions;

        foundry.utils.mergeObject(options, {
            classes: [game.system.id, "sheet", "actor", "v2", "ffg-sw-enhanced", "vendor", "sw-shop-window"],
            template: "modules/ffg-star-wars-enhancements/templates/shop/inventory.html",
            width: 780,
            height: 700,
            scrollY: [".sw-shop-stock"],
        });
        return options;
    }

    /**
     * The vendor form carries no actor stat fields, and the system's actor-update helper (which the
     * base sheet delegates to) assumes them; without this, closing the sheet threw. Only the plain
     * fields on the form (the name) are written back.
     * @override
     */
    async _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData ?? {});
        if (expanded.data || expanded.system) return super._updateObject(event, formData);
        if (expanded.name !== undefined && expanded.name !== this.actor.name) return this.actor.update({ name: expanded.name });
    }

    get template() {
        return "modules/ffg-star-wars-enhancements/templates/shop/inventory.html";
    }

    async close(options) {
        this._layoutObserver?.disconnect();
        return super.close(options);
    }

    async getData() {
        const sheetData = await super.getData();
        let vendor_data = this.document.getFlag("ffg-star-wars-enhancements", "vendor-data");
        // validate that we got flag data before trying to index into it
        if (vendor_data === undefined || vendor_data === null) {
            var vendor_meta_data = {
                base_price: 100,
                price_modifier: 1,
            };
            vendor_data = {};
        } else {
            // temporary to avoid having to refactor a bunch of code below
            var vendor_meta_data = vendor_data["meta"];
            vendor_data = vendor_data["items"];
        }
        log(module_name, "Retrieving data for " + this.document.id);

        let inventory_data = [];
        let items = this.document.items.filter((item) => item);
        for (let x = 0; x < items.length; x++) {
            /* merge the flag data with the inventory data so we can render it in the template */
            let item = items[x];
            const facts = shopItemFacts(item);
            const stock = shopStock(item);
            const listed = (price) => shopListingStats(facts, price);
            if (item.name in vendor_data) {
                log(module_name, "Detected item with flag data set");
                log(module_name, JSON.stringify(item));
                log(module_name, JSON.stringify(vendor_data[item.name]));
                const price = shopCreditCost(item, vendor_data[item.name].price);
                const view = listed(price);
                inventory_data.push({
                    name: item.name,
                    id: vendor_data[item.name].flagged_id,
                    embedded: item.id,
                    compendium: vendor_data[item.name].compendium,
                    image: vendor_data[item.name].image,
                    price,
                    msrp: shopCreditCost(item, vendor_data[item.name].msrp),
                    roll: vendor_data[item.name].roll,
                    type: item.type,
                    restricted: vendor_data[item.name].restricted,
                    flagged: true,
                    subtitle: facts.subtitle,
                    stats: view.stats,
                    brackets: view.brackets,
                    note: facts.note,
                    qualities: facts.qualities,
                    blurb: facts.blurb,
                    cardKind: facts.cardKind,
                    groupId: facts.groupId,
                    groupLabel: facts.groupLabel,
                    stock,
                });
            } else {
                log(module_name, "Detected item with NO flag data set");
                log(module_name, JSON.stringify(item));
                // this was a drag-and-dropped item. figure out the price on the fly
                let price = shopCreditCost(
                    item,
                    Number(fieldValue(item.system?.price)) * Number(vendor_meta_data["price_modifier"] ?? 1) * (Number(vendor_meta_data["base_price"] ?? 100) / 100),
                );
                const view = listed(price);
                let id = item.id;
                inventory_data.push({
                    name: item.name,
                    id: id,
                    embedded: item.id,
                    image: item.img,
                    price: price,
                    msrp: item.system.price.value,
                    roll: "Manually Added",
                    type: item.type,
                    restricted: item.system.rarity.isrestricted,
                    flagged: false,
                    subtitle: facts.subtitle,
                    stats: view.stats,
                    brackets: view.brackets,
                    note: facts.note,
                    qualities: facts.qualities,
                    blurb: facts.blurb,
                    cardKind: facts.cardKind,
                    groupId: facts.groupId,
                    groupLabel: facts.groupLabel,
                    stock,
                });
            }
        }
        // thought of adding this stuff later on. could have refactored the code to make it more first-class, but I'm too lazy
        let tmp_sheet_data = {
            items: inventory_data,
            meta: {
                is_gm: game.user.isGM,
            },
        };
        sheetData.inventory = tmp_sheet_data;
        sheetData.themeClass = shopThemeClass();
        return sheetData;
    }

    /**
     * Activate event listeners using the prepared sheet HTML
     * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
     */
    activateListeners(html) {
        /* The shop template is not a character sheet. The system listener builds Tabs,
         * ContextMenu, and DragDrop for skills and inventory rows that this window does
         * not have, and those globals are deprecated in Foundry 13. Keep the core actor
         * sheet listener so the portrait and form still work. */
        const coreSheet = foundry.appv1?.sheets?.ActorSheet;
        if (coreSheet) coreSheet.prototype.activateListeners.call(this, html);
        else super.activateListeners(html);
        ensureShopStyles();
        applyShopWindowTheme(this);
        this._bindInventoryBrowser(html);
        this._bindShopLayout(html);
        // buy item
        html.find(".item-buy").click((ev) => this._buy_item(ev));
        html.find(".sw-shop-stock-qty").on("change", (ev) => this._set_stock(ev));
        html.find(".sw-shop-stock-qty").on("input", (ev) => ev.stopPropagation());
        // remove item from inventory
        html.find(".item-remove").click((ev) => this._remove_item(ev));
        // refresh inventory
        html.find(".refresh").click((ev) => this._refresh_stock(ev));
        // show to players inventory
        html.find(".show-to-players").click((ev) => this._show_to_players(ev));

        // Copied code from the character sheet, because original item-edit
        // handler is only applied if the user is an owner of the actor. Since
        // vendors are assigned as observers, not owners, we need to duplicate
        // the code in this hook.
        html.find(".item-view").click(async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const li = $(ev.currentTarget).parents(".item");
            let itemId = li.data("itemId");
            let item = this.actor.items.get(itemId);
            if (!item) {
                item = game.items.get(itemId);

                if (!item) {
                    const { default: ImportHelpers } = await import(`/systems/${game.system.id}/modules/importer/import-helpers.js`);
                    item = await ImportHelpers.findCompendiumEntityById("Item", itemId);
                }
            }
            if (item?.sheet) {
                item.sheet.render(true);
            }
        });

        html.on("click", ".sw-shop-card-show", (ev) => this._openShopItemCard(ev));
    }

    /**
     * Open the item card without the system's item-sheet lookup.
     * Generated rows store the compendium id on data-item-id, and the system's
     * card builder opens the item sheet, which overflows on these embedded items.
     * @private
     */
    async _openShopItemCard(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const card = ev.target?.closest?.(".sw-shop-card") ?? ev.currentTarget?.closest?.(".sw-shop-card");
        const actor = this.actor ?? this.document;
        try {
            const embeddedId = card?.getAttribute("data-item-embedded") || (await find_item_id(actor?.id, card?.getAttribute("data-item-name")));
            const compendiumId = card?.getAttribute("data-item-id") || "";
            let item = embeddedId ? actor?.items?.get(embeddedId) : null;
            if (!item && compendiumId) {
                item = game.items.get(compendiumId) ?? null;
                if (!item) {
                    const { default: ImportHelpers } = await import(`/systems/${game.system.id}/modules/importer/import-helpers.js`);
                    item = await ImportHelpers.findCompendiumEntityById("Item", compendiumId);
                }
            }
            if (!item) {
                ui.notifications.warn("That item is no longer in the shop.");
                return;
            }
            const built = await shopItemCardFallback(item);
            if (built?.html) this._presentItemCard(built);
        } catch (error) {
            console.error("ffg-star-wars-enhancements | vendor item card", error);
            ui.notifications.error("Could not open that item card.");
        }
    }

    _presentItemCard(card) {
        const DialogV1 = globalThis.Dialog ?? foundry.appv1?.api?.Dialog;
        new DialogV1(
            {
                title: card.name,
                content: card.html,
                buttons: {
                    close: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("SWFFG.Close"),
                    },
                },
            },
            {
                classes: ["dialog", game.system.id, "starwarsffg", "item-card-dialog"],
                width: 480,
                height: 560,
                resizable: true,
            },
        ).render(true);
    }

    /**
     * Handle buy item
     * @private
     */
    async _buy_item(event, all = 0) {
        event.preventDefault();
        log(module_name, "Detected buy item attempt");

        /* validate that the game is set up on a good manner */
        let target_gm = null;
        game.users.forEach((user) => {
            if (user.isGM && user.active) {
                target_gm = user;
            }
        });
        if (!target_gm) {
            return ui.notifications.error("No active GM on your scene, they must be online to purchase an item.");
        }

        if (!game.user.character) {
            return ui.notifications.error(`No active character for user.`);
        }

        // read item data from the HTML
        // VERY secure :p
        let item_name = $(event.currentTarget).parents(".item").attr("data-item-name");
        let item_price = $(event.currentTarget).parents(".item").attr("data-item-price");
        let compendium_item = $(event.currentTarget).parents(".item").attr("data-item-type");
        let compendium = $(event.currentTarget).parents(".item").attr("data-item-compendium");

        let item_id = await find_item_id(this.document.id, item_name);

        let buy_packet = {
            type: "buy",
            buyer_id: game.user.character,
            seller_id: this.document.id,
            price: item_price,
            item_id: item_id,
            quantity: 1,
            gm_id: target_gm.id,
            compendium_item: compendium_item,
            compendium: compendium,
        };
        log(module_name, "Sending buy packet with contents");
        log(module_name, buy_packet);
        game.socket.emit("module.ffg-star-wars-enhancements", buy_packet);
    }

    _shopLayoutPreference() {
        try {
            return game.settings.get("ffg-star-wars-enhancements", SHOP_LAYOUT_SETTING) || "grid";
        } catch (error) {
            return "grid";
        }
    }

    _applyShopLayout(root) {
        const pref = this._shopLayoutPreference();
        const width = root.width() || 0;
        const mode = pref === "auto" ? (width < SHOP_LIST_BREAKPOINT ? "list" : "grid") : pref;
        root.removeClass("is-list is-grid").addClass(mode === "list" ? "is-list" : "is-grid");
        root.find(".sw-shop-layout button").removeClass("is-active").attr("aria-pressed", "false");
        root.find(`.sw-shop-layout button[data-layout="${pref}"]`).addClass("is-active").attr("aria-pressed", "true");
    }

    _bindShopLayout(html) {
        const root = html.hasClass("sw-shop") ? html : html.find(".sw-shop");
        const apply = () => this._applyShopLayout(root);
        apply();
        this._layoutObserver?.disconnect();
        const node = root.get(0);
        if (node && typeof ResizeObserver !== "undefined") {
            this._layoutObserver = new ResizeObserver(() => apply());
            this._layoutObserver.observe(node);
        }
        html.find(".sw-shop-layout button").on("click", async (ev) => {
            ev.preventDefault();
            const layout = ev.currentTarget.dataset.layout;
            await game.settings.set("ffg-star-wars-enhancements", SHOP_LAYOUT_SETTING, layout);
            apply();
        });
    }

    _bindInventoryBrowser(html) {
        const stock = html.find(".sw-shop-stock");
        const search = html.find(".sw-shop-search");
        const emptyFilter = html.find(".sw-shop-no-matches");
        let sortKey = "type";
        let ascending = true;

        const cards = () => stock.find(".sw-shop-card");

        const matches = (node, query) => {
            if (!query) return true;
            const name = (node.dataset.itemName || "").toLowerCase();
            const type = (node.dataset.sortType || "").toLowerCase();
            const shelf = (node.dataset.groupLabel || "").toLowerCase();
            const kind = (node.dataset.cardKind || "").toLowerCase();
            return name.includes(query) || type.includes(query) || shelf.includes(query) || kind.includes(query);
        };

        const compareCards = (a, b) => {
            if (sortKey === "price") {
                const av = parseFloat(a.dataset.itemPrice) || 0;
                const bv = parseFloat(b.dataset.itemPrice) || 0;
                return ascending ? av - bv : bv - av;
            }
            if (sortKey === "type") {
                const ar = shelfRank(a.dataset.groupId);
                const br = shelfRank(b.dataset.groupId);
                if (ar !== br) return ascending ? ar - br : br - ar;
                const shelf = (a.dataset.groupLabel || "").localeCompare(b.dataset.groupLabel || "");
                if (shelf) return ascending ? shelf : -shelf;
            }
            const av = (a.dataset.itemName || "").toLowerCase();
            const bv = (b.dataset.itemName || "").toLowerCase();
            const cmp = av.localeCompare(bv);
            return ascending ? cmp : -cmp;
        };

        const flatten = (held) => {
            stock.find(".sw-shop-group").remove();
            let box = stock.children(".sw-shop-cards");
            if (!box.length) {
                box = $('<div class="sw-shop-cards"></div>');
                const empty = stock.children(".sw-shop-empty");
                if (empty.length) box.insertBefore(empty);
                else stock.append(box);
            }
            box.append(held);
            return box;
        };

        const apply = () => {
            const query = String(search.val() ?? "").trim().toLowerCase();
            const held = cards().get().sort(compareCards);
            let visible = 0;
            if (sortKey === "type") {
                stock.children(".sw-shop-cards").remove();
                stock.find(".sw-shop-group").remove();
                const buckets = new Map();
                for (const node of held) {
                    const id = node.dataset.groupId || "other";
                    if (!buckets.has(id)) buckets.set(id, { label: node.dataset.groupLabel || id, nodes: [] });
                    buckets.get(id).nodes.push(node);
                }
                const empty = stock.children(".sw-shop-empty");
                for (const bucket of buckets.values()) {
                    const title = $("<h3>", { class: "sw-shop-group-title" });
                    title.append(document.createTextNode(bucket.label + " "));
                    const count = $("<span>");
                    title.append(count);
                    const box = $('<div class="sw-shop-cards"></div>');
                    const section = $('<section class="sw-shop-group"></section>').append(title, box);
                    let shown = 0;
                    for (const node of bucket.nodes) {
                        const show = matches(node, query);
                        node.hidden = !show;
                        if (show) {
                            shown += 1;
                            visible += 1;
                        }
                        box.append(node);
                    }
                    count.text(shown);
                    section.toggleClass("is-empty", shown === 0);
                    if (empty.length) section.insertBefore(empty);
                    else stock.append(section);
                }
            } else {
                const box = flatten(held);
                for (const node of held) {
                    const show = matches(node, query);
                    node.hidden = !show;
                    if (show) visible += 1;
                    box.append(node);
                }
            }
            emptyFilter.toggleClass("is-visible", held.length > 0 && visible === 0);
        };

        search.on("input", apply);
        search.on("change", (ev) => ev.stopPropagation());
        search.on("keydown", (ev) => {
            if (ev.key === "Enter") ev.preventDefault();
        });
        html.find(".sw-shop-sort button").on("click", (ev) => {
            ev.preventDefault();
            const key = ev.currentTarget.dataset.sort;
            if (sortKey === key) ascending = !ascending;
            else {
                sortKey = key;
                ascending = true;
            }
            html.find(".sw-shop-sort button").removeClass("is-active").attr("aria-pressed", "false");
            $(ev.currentTarget).addClass("is-active").attr("aria-pressed", "true");
            apply();
        });
        apply();
    }

    /**
     * Handle delete item
     * @private
     */
    async _set_stock(event) {
        event.preventDefault();
        event.stopPropagation();
        const card = $(event.currentTarget).closest(".item");
        const itemName = card.attr("data-item-name");
        const itemId = await find_item_id(this.document.id, itemName);
        if (!itemId) return;
        const stock = Math.max(0, parseInt(event.currentTarget.value, 10) || 0);
        await game.actors.get(this.document.id).updateEmbeddedDocuments("Item", [{ _id: itemId, "system.quantity.value": stock }]);
    }

    async _remove_item(event, all = 0) {
        event.preventDefault();
        let item_name = $(event.currentTarget).parents(".item").attr("data-item-name");
        const confirmed = await shopConfirm(
            game.i18n.localize("ffg-star-wars-enhancements.shop.html.inventory.confirm-delete.title"),
            `<p>${game.i18n.format("ffg-star-wars-enhancements.shop.html.inventory.confirm-delete.content", { name: item_name })}</p>`,
        );
        if (!confirmed) return;
        let item_id = await find_item_id(this.document.id, item_name);
        await game.actors.get(this.document.id).deleteEmbeddedDocuments("Item", [item_id]);
    }

    async _refresh_stock(event, all = 0) {
        log(module_name, "refreshing stock for " + this.document.id);
        open_shop_generator(this.document.id);
    }

    async _show_to_players(event) {
        log(module_name, "Showing players vendor");
        const show_packet = {
            type: "display",
            actor_uuid: this.object.uuid,
        };
        game.socket.emit("module.ffg-star-wars-enhancements", show_packet);
    }
    };
    return Vendor;
}
