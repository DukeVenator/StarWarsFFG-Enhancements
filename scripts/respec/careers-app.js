import {
    CAREERS,
    UNASSIGNED_SPECIALIZATIONS,
    UNIVERSAL_SPECIALIZATIONS,
} from "./tables.js";
import { t } from "./ui.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "modules/ffg-star-wars-enhancements/templates/respec/careers.html";

let careerApp = null;

export function openCareerDialog() {
    careerApp ??= new CareerDialog();
    careerApp.render(true);
    return careerApp;
}

export class CareerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "ffg-star-wars-enhancements-respec-careers",
            classes: ["respec-window", "respec-career-window"],
            window: {
                title: t("career-title"),
                resizable: true,
                icon: "fa-solid fa-book-open",
            },
            position: { width: 680, height: 760 },
        }, { inplace: false });
    }

    static PARTS = {
        content: { template: TEMPLATE, scrollable: [".respec-career"] },
    };

    _prepareContext() {
        const powers = (list) => list.join(", ");
        return {
            unassigned: UNASSIGNED_SPECIALIZATIONS.join(", "),
            universal: UNIVERSAL_SPECIALIZATIONS.map((entry) => ({
                name: entry.name,
                powers: powers(entry.powers),
                search: `${entry.name} ${powers(entry.powers)}`.toLowerCase(),
            })),
            careers: CAREERS.map((career) => ({
                name: career.name,
                powers: powers(career.powers),
                powerList: career.powers,
                search: `${career.name} ${powers(career.powers)}`.toLowerCase(),
                specializations: career.specializations.map((entry) => ({
                    name: entry.name,
                    powers: powers(entry.powers),
                    note: entry.note ? game.i18n.localize(entry.note) : "",
                    search: `${entry.name} ${powers(entry.powers)}`.toLowerCase(),
                })),
            })),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const input = this.element?.querySelector("[data-career-search]");
        if (!input || input.dataset.bound === "true") return;
        input.dataset.bound = "true";
        input.addEventListener("input", () => {
            const query = input.value.trim().toLowerCase();
            for (const node of this.element.querySelectorAll("[data-search]")) {
                node.classList.toggle("is-hidden", Boolean(query) && !node.dataset.search.includes(query));
            }
            for (const section of this.element.querySelectorAll(".respec-career-group")) {
                const visible = [...section.querySelectorAll("[data-search]")].some(
                    (node) => !node.classList.contains("is-hidden")
                );
                section.classList.toggle("is-hidden", !visible);
            }
            const anyVisible = [...this.element.querySelectorAll("[data-search]")].some(
                (node) => !node.classList.contains("is-hidden")
            );
            this.element
                .querySelector("[data-career-empty]")
                ?.classList.toggle("is-hidden", !query || anyVisible);
        });
    }
}
