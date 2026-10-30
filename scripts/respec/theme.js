/**
 * The FFG system swaps between mandar.css and mandar-dark.css instead of
 * setting a body class, so the active stylesheet is the reliable signal.
 */

const THEME_ATTRIBUTE = "data-respec-theme";
const SHARED_THEME_ATTRIBUTE = "data-ffg-theme";

function activeLink(fragment) {
    if (typeof document === "undefined") return null;
    return (
        [...document.querySelectorAll('link[rel="stylesheet"]')].find(
            (link) => link.href.includes(fragment) && !link.disabled
        ) ?? null
    );
}

/** @returns {"light"|"dark"} */
export function detectRespecTheme() {
    if (typeof document === "undefined") return "dark";

    if (activeLink("mandar-dark.css")) return "dark";
    if (activeLink("mandar.css")) return "light";

    // The retired default theme has no separate dark sheet; follow Foundry.
    try {
        for (const key of ["core.theme", "core.colorScheme"]) {
            if (!game.settings?.settings?.has?.(key)) continue;
            const core = game.settings.get("core", key.slice(5));
            if (typeof core !== "string") continue;
            if (core.toLowerCase().includes("light")) return "light";
            if (core.toLowerCase().includes("dark")) return "dark";
        }
    } catch (error) {
        console.warn("ffg-star-wars-enhancements | respec theme setting unavailable", error);
    }

    const body = document.body;
    if (body?.classList.contains("theme-light")) return "light";
    if (body?.classList.contains("theme-dark")) return "dark";

    return "dark";
}

/** Publish the detected theme for respec.css and shared module windows. */
export function applyRespecTheme() {
    if (typeof document === "undefined") return "dark";
    const theme = detectRespecTheme();
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
    document.documentElement.setAttribute(SHARED_THEME_ATTRIBUTE, theme);
    return theme;
}

/** Shared alias for module windows that use data-ffg-theme. */
export const applyFfgTheme = applyRespecTheme;

export function respecTheme() {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.getAttribute(THEME_ATTRIBUTE) ?? "dark";
}
