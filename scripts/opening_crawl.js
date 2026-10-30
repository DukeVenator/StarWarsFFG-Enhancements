import { log_msg as log } from "./util.js";
import { CrawlEffects } from "./crawl_effects.js";
import {
    PAN_LEAD_DEFAULT,
    NO_IMAGE_PAN_FRACTION,
    clamp,
    css_seconds,
    intro_schedule,
    reveal_distance,
} from "./opening_crawl_timing.js";
import {
    CRAWL_TYPE_IDS,
    crawl_number_html,
    crawl_starjedi_text,
    crawl_title_text,
    crawl_type_choices,
    crawl_type_of,
} from "./opening_crawl_types.js";

const MODULE_ID = "ffg-star-wars-enhancements";
const CRAWL_FLAG = "crawl-type";

/**
 * Order the settings appear in the Opening Crawl configuration window. Keeping
 * the list here (rather than relying on registration order) lets the UI group
 * timing, presentation, and effects without scattering related controls.
 */
const SETTING_ORDER = [
    "opening-crawl-folder",
    "opening-crawl-music",
    "opening-crawl-music-delay",
    "opening-crawl-playlist",
    "opening-crawl-playlist-stop",
    "opening-crawl-logo",
    "opening-crawl-logo-saga",
    "opening-crawl-logo-clone-wars",
    "opening-crawl-logo-criminal-empire",
    "opening-crawl-image-right",
    "opening-crawl-image-bottom",
    "opening-crawl-font-size",
    "opening-crawl-intro-text-delay",
    "opening-crawl-intro-text-duration",
    "opening-crawl-intro-logo-delay",
    "opening-crawl-intro-logo-duration",
    "opening-crawl-intro-crawl-delay",
    "opening-crawl-intro-crawl-duration",
    "opening-crawl-intro-crawl-duration-adjust",
    "opening-crawl-intro-crawl-speed",
    "opening-crawl-intro-pan-lead",
    "opening-crawl-intro-pan-delay",
    "opening-crawl-intro-pan-duration",
    "opening-crawl-intro-close-delay",
    "opening-crawl-effects",
    "opening-crawl-effects-particles",
    "opening-crawl-effects-scanlines",
    "opening-crawl-effects-vignette",
    "opening-crawl-effects-streaks",
    "opening-crawl-effects-intensity",
    "opening-crawl-effects-speed",
    "opening-crawl-effects-density",
];

const SETTING_GROUPS = {
    "opening-crawl-folder": "general",
    "opening-crawl-music": "general",
    "opening-crawl-music-delay": "general",
    "opening-crawl-playlist": "general",
    "opening-crawl-playlist-stop": "general",
    "opening-crawl-logo": "presentation",
    "opening-crawl-logo-saga": "presentation",
    "opening-crawl-logo-clone-wars": "presentation",
    "opening-crawl-logo-criminal-empire": "presentation",
    "opening-crawl-image-right": "presentation",
    "opening-crawl-image-bottom": "presentation",
    "opening-crawl-font-size": "presentation",
    "opening-crawl-intro-text-delay": "timing",
    "opening-crawl-intro-text-duration": "timing",
    "opening-crawl-intro-logo-delay": "timing",
    "opening-crawl-intro-logo-duration": "timing",
    "opening-crawl-intro-crawl-delay": "timing",
    "opening-crawl-intro-crawl-duration": "timing",
    "opening-crawl-intro-crawl-duration-adjust": "timing",
    "opening-crawl-intro-crawl-speed": "timing",
    "opening-crawl-intro-pan-lead": "timing",
    "opening-crawl-intro-pan-delay": "timing",
    "opening-crawl-intro-pan-duration": "timing",
    "opening-crawl-intro-close-delay": "timing",
    "opening-crawl-effects": "effects",
    "opening-crawl-effects-particles": "effects",
    "opening-crawl-effects-scanlines": "effects",
    "opening-crawl-effects-vignette": "effects",
    "opening-crawl-effects-streaks": "effects",
    "opening-crawl-effects-intensity": "effects",
    "opening-crawl-effects-speed": "effects",
    "opening-crawl-effects-density": "effects",
};

const FILE_PICKER_TYPES = {
    "opening-crawl-music": "audio",
    "opening-crawl-logo": "image",
    "opening-crawl-logo-saga": "image",
    "opening-crawl-logo-clone-wars": "image",
    "opening-crawl-logo-criminal-empire": "image",
};

/**
 * Register a world-scoped setting whose name/hint come from the usual
 * `opening-crawl.<key>` localization keys.
 */
function register_crawl_setting(key, config) {
    game.settings.register(MODULE_ID, key, {
        module: MODULE_ID,
        name: game.i18n.localize(`ffg-star-wars-enhancements.opening-crawl.${key}`),
        hint: game.i18n.localize(`ffg-star-wars-enhancements.opening-crawl.${key}-hint`),
        scope: "world",
        config: false,
        ...config,
    });
}

function crawl_text(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function is_remote_audio(src) {
    return /^https?:\/\//i.test(String(src ?? "").trim());
}

function journal_crawl_type(journal) {
    return crawl_type_of(journal?.getFlag?.(MODULE_ID, CRAWL_FLAG)).id;
}

/**
 * Register settings used by the opening crawl.
 */
export function init() {
    log("opening-crawl", "Initializing");
    game.settings.registerMenu(MODULE_ID, "opening-crawl_UISettings", {
        name: game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.ui.name"),
        hint: game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.ui.hint"),
        label: game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.ui.label"),
        icon: "fas fa-cut",
        type: opening_crawl_UISettings,
        restricted: true,
    });

    register_crawl_setting("opening-crawl-folder", { type: String, default: "Opening Crawls" });
    register_crawl_setting("opening-crawl-music", { type: String, filePicker: "audio", default: "" });
    register_crawl_setting("opening-crawl-music-delay", { type: Number, default: 0.0 });
    register_crawl_setting("opening-crawl-playlist", { type: String, default: "" });
    register_crawl_setting("opening-crawl-playlist-stop", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-logo", { type: String, filePicker: "image", default: "" });
    for (const type of CRAWL_TYPE_IDS) {
        register_crawl_setting(`opening-crawl-logo-${type}`, { type: String, filePicker: "image", default: "" });
    }
    register_crawl_setting("opening-crawl-image-right", { type: Number, default: 0 });
    register_crawl_setting("opening-crawl-image-bottom", { type: Number, default: 1300 });
    register_crawl_setting("opening-crawl-font-size", { type: Number, default: 350 });
    register_crawl_setting("opening-crawl-intro-text-delay", { type: Number, default: 1 });
    register_crawl_setting("opening-crawl-intro-text-duration", { type: Number, default: 6 });
    register_crawl_setting("opening-crawl-intro-logo-delay", { type: Number, default: 2 });
    register_crawl_setting("opening-crawl-intro-logo-duration", { type: Number, default: 11 });
    register_crawl_setting("opening-crawl-intro-crawl-delay", { type: Number, default: 6 });
    register_crawl_setting("opening-crawl-intro-crawl-duration", { type: Number, default: 73 });
    register_crawl_setting("opening-crawl-intro-crawl-duration-adjust", { type: Number, default: 0 });
    register_crawl_setting("opening-crawl-intro-crawl-speed", {
        type: Number,
        range: { min: 0.1, max: 5.0, step: 0.1 },
        default: 1.0,
    });
    register_crawl_setting("opening-crawl-intro-pan-lead", {
        type: Number,
        range: { min: 0, max: 15, step: 0.5 },
        default: PAN_LEAD_DEFAULT,
    });
    register_crawl_setting("opening-crawl-intro-pan-delay", { type: Number, default: 0 });
    register_crawl_setting("opening-crawl-intro-pan-duration", { type: Number, default: 7 });
    register_crawl_setting("opening-crawl-intro-close-delay", { type: Number, default: 3 });

    register_crawl_setting("opening-crawl-effects", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-effects-particles", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-effects-scanlines", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-effects-vignette", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-effects-streaks", { type: Boolean, default: true });
    register_crawl_setting("opening-crawl-effects-intensity", {
        type: Number,
        range: { min: 0, max: 100, step: 1 },
        default: 60,
    });
    register_crawl_setting("opening-crawl-effects-speed", {
        type: Number,
        range: { min: 0.2, max: 2, step: 0.1 },
        default: 1,
    });
    register_crawl_setting("opening-crawl-effects-density", {
        type: Number,
        range: { min: 20, max: 200, step: 5 },
        default: 80,
    });

    log("opening-crawl", "Initialized");
}

/**
 * Application that displays the Opening Crawl.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class OpeningCrawlApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} data object to provide the opening crawl template
     * @param {object} options additional options for the application
     */
    constructor(data, options) {
        super(options);
        this.data = data;
    }

    /**
     * Configure a "full" screen with minimal controls that will display the
     * Opening Crawl.
     */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "ffg-star-wars-enhancements-opening-crawl",
            window: {
                title: game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.title"),
                minimizable: false,
                resizable: true,
            },
            position: {
                // Open at the client's viewport instead of a fixed 4096x2160.
                // A large window is resized down after its first paint, and the
                // intro/logo layers promoted with `will-change` could keep their
                // pre-resize texture: the intro line and wordmark then stayed
                // painted over the crawl on some GPU drivers. Sizing it correctly
                // up front avoids that first, stale rasterization.
                width: globalThis.innerWidth || 4096,
                height: globalThis.innerHeight || 2160,
            },
        });
    }

    /**
     * Define the template parts for Handlebars rendering.
     * Using 'content' as the main part name which is the default for ApplicationV2.
     */
    static PARTS = {
        content: { template: "modules/ffg-star-wars-enhancements/templates/opening_crawl.html" },
    };

    /**
     * Provide the data object for the template.
     * @returns object provided to the constructor
     */
    _prepareContext(options) {
        const data = this.data;
        const type = crawl_type_of(data.crawlType);
        const globalLogo = game.settings.get(MODULE_ID, "opening-crawl-logo") || "";
        const typeLogo = game.settings.get(MODULE_ID, `opening-crawl-logo-${type.id}`) || "";

        data.img = {
            bottom: opening_crawl_setting("opening-crawl-image-bottom"),
            right: opening_crawl_setting("opening-crawl-image-right"),
        };
        data.size = opening_crawl_setting("opening-crawl-font-size");
        data.intro_text_delay = opening_crawl_setting("opening-crawl-intro-text-delay");
        data.intro_text_duration = opening_crawl_setting("opening-crawl-intro-text-duration");
        data.intro_logo_delay = opening_crawl_setting("opening-crawl-intro-logo-delay");
        data.intro_logo_duration = opening_crawl_setting("opening-crawl-intro-logo-duration");
        data.intro_crawl_delay = opening_crawl_setting("opening-crawl-intro-crawl-delay");
        data.intro_crawl_duration = opening_crawl_setting("opening-crawl-intro-crawl-duration");
        data.intro_crawl_duration_adjust = opening_crawl_setting("opening-crawl-intro-crawl-duration-adjust");
        data.intro_crawl_speed = opening_crawl_setting("opening-crawl-intro-crawl-speed");
        data.intro_pan_delay = opening_crawl_setting("opening-crawl-intro-pan-delay");
        data.intro_pan_duration = opening_crawl_setting("opening-crawl-intro-pan-duration");
        data.intro_pan_lead = opening_crawl_setting("opening-crawl-intro-pan-lead");
        data.crawlType = type.id;
        data.crawlTypeLabel = game.i18n.localize(type.label);
        data.intro = type.intro.map((key) => game.i18n.localize(key));
        // The Criminal Empire wordmark uses SWCrawlTitle, so it needs the same
        // S/L glyph substitution as the episode and title. StarJedi wordmarks
        // need their own O->0 substitution; News Cycle needs neither.
        data.wordmark = type.wordmark.map((line) => {
            if (type.wordmarkUsesTitleFont) return crawl_title_text(line);
            if (type.wordmarkStarJedi) return crawl_starjedi_text(line);
            return line;
        });
        // SWCrawlTitle renders a capital S as the STAR WARS logo; use its
        // normal lowercase-s glyph and uppercase the title in JS instead.
        data.episode = crawl_title_text(data.episode);
        data.title = crawl_title_text(data.title, { uppercase: true });
        // SWCrawlTitle gives "1" a very wide advance (it is designed for film
        // numerals), which prints SESSION 10 as SESSION 1 0. Tighten only the
        // digit runs; crawl_number_html escapes the rest of the text.
        data.episode_html = crawl_number_html(data.episode);
        data.title_html = crawl_number_html(data.title);
        // A per-type logo wins; the global logo is the fallback for existing worlds.
        // Older builds used a folder picker here, so ignore a stored directory path.
        const logo_path = (value) => {
            const path = String(value ?? "").trim();
            return path && !path.endsWith("/") ? path : "";
        };
        data.logo = logo_path(typeLogo) || logo_path(globalLogo);
        data.effects = this._effect_settings(type);
        data.effectsClass = [
            data.effects.enabled ? "crawl-effects-active" : "",
            data.effects.particles ? "crawl-effects-particles" : "",
            data.effects.scanlines ? "crawl-effects-scanlines-on" : "",
            data.effects.vignette ? "crawl-effects-vignette-on" : "",
            data.effects.streaks ? "crawl-effects-streaks" : "",
        ]
            .filter(Boolean)
            .join(" ");
        return data;
    }

    /**
     * Filter the user's effect settings through what this crawl type supports.
     * Saga returns a disabled object; Clone Wars and Criminal Empire disagree on
     * scanlines and streaks.
     */
    _effect_settings(type) {
        const support = type.effects;
        const master = Boolean(game.settings.get(MODULE_ID, "opening-crawl-effects"));
        const enabled = master && Boolean(support);
        const toggle = (key) => Boolean(game.settings.get(MODULE_ID, `opening-crawl-effects-${key}`));
        const intensity = clamp(opening_crawl_setting("opening-crawl-effects-intensity") / 100, 0, 1);
        const speed = opening_crawl_setting("opening-crawl-effects-speed");
        const density = opening_crawl_setting("opening-crawl-effects-density");

        return {
            enabled,
            particles: enabled && toggle("particles") && Boolean(support?.kind),
            scanlines: enabled && toggle("scanlines") && Boolean(support?.scanlines),
            vignette: enabled && toggle("vignette") && Boolean(support?.vignette),
            streaks: enabled && toggle("streaks") && Boolean(support?.streaks),
            kind: support?.kind ?? "dust",
            intensity,
            speed: speed > 0 ? speed : 1,
            density: density > 0 ? density : 80,
            particleColor: support?.particle ?? "#8fd8ff",
            streakColor: support?.streak ?? "#d6f2ff",
        };
    }

    /**
     * Play this.data.music using the Playlist volume.
     * Remote URLs use a plain audio element: Foundry's Sound preload fetches the
     * whole track through the CORS-enabled buffer pipeline, which can stall or be
     * rejected by hosts such as archive.org. The element streams immediately and
     * keeps the crawl independent of the audio transport.
     */
    async play_music() {
        const music = this.data.music;
        const volume = clamp(
            Number(game.settings.get("core", "globalPlaylistVolume")) || 0,
            0,
            1
        );
        const delay = game.settings.get("ffg-star-wars-enhancements", "opening-crawl-music-delay") * 1000;

        // Start buffering remote tracks immediately so the music is ready when
        // the configured delay ends. Streamed audio does not block the crawl.
        if (is_remote_audio(music)) {
            this.remote_audio = new Audio(music);
            this.remote_audio.volume = volume;
            this.remote_audio.preload = "auto";
            this.remote_audio.load();
        }

        await sleep(delay);
        if (this.closing) return;

        if (is_remote_audio(music)) {
            await this.play_remote_music(music, volume);
            return;
        }

        let sound = this.data.sound;
        if (!sound && this.audioReady) {
            try {
                sound = await this.audioReady;
            } catch (error) {
                log("opening-crawl", "music preload failed: " + error);
            }
        }
        if (!sound || this.closing) {
            log("opening-crawl", "no sound available to play");
            return;
        }

        try {
            await sound.play({ volume: volume });
            this.sound = sound;
        } catch (error) {
            log("opening-crawl", "music playback failed: " + error);
        }
    }

    /** Stream a remote music URL without waiting for Foundry's audio buffer cache. */
    async play_remote_music(src, volume) {
        const audio = this.remote_audio ?? new Audio(src);
        audio.volume = volume;
        try {
            await audio.play();
            if (this.closing) {
                audio.pause();
                return;
            }
            this.remote_audio = audio;
            log("opening-crawl", "remote music started");
        } catch (error) {
            log("opening-crawl", "remote music playback failed: " + error);
        }
    }

    /**
     * Start the configured playlist after the music delay. Only the client that launched the
     * crawl does this: a playlist is a world document, and Foundry's own playlist sync then
     * plays it on every connected client, so no socket traffic is needed.
     */
    async start_playlist() {
        const playlist = game.playlists.get(this.data.playlist);
        if (!playlist) {
            log("opening-crawl", "configured playlist not found: " + this.data.playlist);
            ui.notifications.warn(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.playlist-missing"));
            return;
        }
        if (!playlist.canUserModify(game.user, "update")) {
            log("opening-crawl", "user may not control the playlist " + playlist.name);
            return;
        }
        const delay = game.settings.get("ffg-star-wars-enhancements", "opening-crawl-music-delay") * 1000;
        await sleep(delay);
        // the crawl may have been closed during the delay
        if (this.closing) return;
        this.playlist = playlist;
        await playlist.playAll();
        log("opening-crawl", "playlist started: " + playlist.name);
    }

    /**
     * Listener that times the audio playing the audio with the opening crawl.
     * @param {object} context the rendered context
     * @param {object} options render options
     */
    _onRender(context, options) {
        log("opening-crawl", "active listeners");
        super._onRender(context, options);

        this._timeCrawl();
        this._start_effects();

        // Music is preloaded in the background (or streamed for remote URLs),
        // so start the delayed playback even before the sound object exists.
        if (this.data.music) {
            this.play_music();
        }
        // When a playlist is configured, the launching client starts it for everyone
        if (this.data.playlist && this.data.launcher === game.user.id) {
            this.start_playlist();
        }
    }

    close(options) {
        this.closing = true;
        this._clear_timers();
        this.effects?.destroy();
        this.effects = null;
        if (this.remote_audio) {
            this.remote_audio.pause();
            this.remote_audio.removeAttribute("src");
            this.remote_audio.load?.();
            this.remote_audio = null;
        }
        if (this.sound) {
            this.sound.stop();
            this.sound = null;
        }
        if (this.playlist) {
            if (game.settings.get("ffg-star-wars-enhancements", "opening-crawl-playlist-stop")) {
                this.playlist.stopAll();
                log("opening-crawl", "playlist stopped: " + this.playlist.name);
            }
            this.playlist = null;
        }
        return super.close(options);
    }

    _root() {
        const host = this.element?.jquery ? this.element[0] : this.element;
        if (host?.classList?.contains("ffg-star-wars-enhancements-opening-crawl")) return host;
        return host?.querySelector?.(".ffg-star-wars-enhancements-opening-crawl");
    }

    /**
     * The configured duration is how long the original window-sized crawl took.
     * Longer text keeps that same pace, so the scroll is extended instead of sped up.
     * Once the text is measured, the whole reveal schedule is built from that fitted
     * scroll: the pan starts while the last lines are still on screen.
     */
    _timeCrawl() {
        const root = this._root();
        this.root = root;
        const titles = root?.querySelector?.(".titles");
        const content = titles?.querySelector?.(":scope > div");
        const configured = crawl_scroll_seconds();
        let seconds = configured;
        if (titles && content && titles.clientHeight > 0) {
            const travel = titles.clientHeight + content.offsetHeight;
            const reference = titles.clientHeight * 1.181524;
            seconds = configured * Math.max(1, travel / reference);
        }
        this.fittedCrawlSeconds = seconds;

        const schedule = intro_schedule({ ...intro_timing_settings(), crawlScroll: seconds });
        this.schedule = schedule;
        if (!root) return;

        root.style.setProperty("--intro-crawl-duration", css_seconds(seconds));
        root.style.setProperty("--intro-ending-delay", css_seconds(schedule.panStart));
        root.style.setProperty("--intro-ending-duration", css_seconds(schedule.panDuration));
        // Keep the wordmark from sitting over the first crawl lines: if the
        // configured fly-away is longer than the gap between logo and text, trim
        // it so the logo animation finishes exactly when the crawl begins.
        const logo_start =
            schedule.textDelay +
            schedule.textDuration +
            opening_crawl_setting("opening-crawl-intro-logo-delay");
        const logo_gap = Math.max(0, schedule.crawlStart - logo_start);
        const logo_duration = Math.min(
            opening_crawl_setting("opening-crawl-intro-logo-duration"),
            logo_gap
        );
        root.style.setProperty("--intro-logo-duration", css_seconds(logo_duration));
        // A safe fallback until the planet has been measured.
        const viewport = root.clientHeight || globalThis.innerHeight || 0;
        root.style.setProperty("--crawl-pan-distance", `${Math.round(viewport * NO_IMAGE_PAN_FRACTION)}px`);
        root.style.setProperty("--crawl-effects-intensity", String(this.data.effects?.intensity ?? 0.6));
        root.classList.add("crawl-timed");
        this._schedule_timers(root, schedule);
        this._measure_pan(root).catch((error) => log("opening-crawl", "could not measure pan: " + error));
    }

    _clear_timers() {
        if (this._pan_timer) clearTimeout(this._pan_timer);
        if (this._close_timer) clearTimeout(this._close_timer);
        if (this._intro_timer) clearTimeout(this._intro_timer);
        if (this._logo_timer) clearTimeout(this._logo_timer);
        if (this._crawl_timer) clearTimeout(this._crawl_timer);
        this._pan_timer = null;
        this._close_timer = null;
        this._intro_timer = null;
        this._logo_timer = null;
        this._crawl_timer = null;
    }

    _schedule_timers(root, schedule) {
        this._clear_timers();
        // Remove each finished stage from the document. A completed CSS animation
        // keeps its element (and its compositor layer) around at opacity 0; on
        // some clients the stale layer stayed painted over the crawl, so the
        // intro line and wordmark appeared again among the crawl text. Taking the
        // elements out of the document guarantees they cannot be painted again.
        const logo_start =
            schedule.textDelay +
            schedule.textDuration +
            opening_crawl_setting("opening-crawl-intro-logo-delay");
        this._intro_timer = setTimeout(() => {
            const intro = root.querySelector(".introBackground");
            if (intro) intro.style.display = "none";
        }, Math.max(0, logo_start) * 1000);
        this._logo_timer = setTimeout(() => {
            const logo = root.querySelector(".logo");
            if (logo) logo.style.display = "none";
        }, Math.max(0, schedule.crawlStart) * 1000);
        this._crawl_timer = setTimeout(() => {
            const titles = root.querySelector(".titles");
            if (titles) titles.style.display = "none";
        }, Math.max(0, schedule.crawlEnd + 0.25) * 1000);
        this._pan_timer = setTimeout(() => {
            this._pan_started = true;
            root.classList.add("is-panning");
        }, Math.max(0, schedule.panStart) * 1000);

        this.closeScheduled = schedule.autoClose;
        if (schedule.autoClose) {
            this._close_timer = setTimeout(() => {
                if (!this.closing) this.close();
            }, schedule.windowClose * 1000);
        }
    }

    /**
     * Measure the planet after it decodes and scroll the starfield just far enough
     * for its centre to land at 56% of the viewport. Skipped once the pan has begun,
     * so a slow image load never makes the pan jump.
     */
    async _measure_pan(root) {
        const image = root.querySelector(".backgroundSpace img");
        if (this.closing) return;
        if (!image) {
            // No planet: use the same readable fraction of the settled viewport.
            await new Promise((resolve) => requestAnimationFrame(resolve));
            if (this.closing || this._pan_started) return;
            const viewport = root.getBoundingClientRect().height;
            if (viewport > 0) {
                root.style.setProperty(
                    "--crawl-pan-distance",
                    `${Math.round(viewport * NO_IMAGE_PAN_FRACTION)}px`
                );
            }
            return;
        }
        if (typeof image.decode === "function") {
            try {
                await image.decode();
            } catch {
                /* decode can reject for a broken image; the fallback distance is fine */
            }
        }
        if (this._pan_started || this.closing || !root.isConnected) return;

        const space = root.querySelector(".backgroundSpace");
        const viewport = root.getBoundingClientRect().height;
        const image_box = image.getBoundingClientRect();
        const bottom = Number.parseFloat(globalThis.getComputedStyle?.(image)?.bottom ?? "");
        if (!(viewport > 0) || !(image_box.height > 0)) return;

        const distance = reveal_distance({
            container_height: space?.offsetHeight ?? 4200,
            image_bottom: Number.isFinite(bottom) ? bottom : 0,
            image_height: image_box.height,
            viewport_height: viewport,
        });
        root.style.setProperty("--crawl-pan-distance", `${Math.round(distance)}px`);
        log("opening-crawl", `pan distance ${Math.round(distance)}px`);
    }

    _start_effects() {
        const root = this.root ?? this._root();
        const effects = this.data.effects;
        if (!root || !effects?.enabled || (!effects.particles && !effects.streaks)) return;
        const canvas = root.querySelector(".crawl-effects-canvas");
        if (!canvas) return;
        this.effects?.destroy();
        this.effects = new CrawlEffects(canvas, root, effects);
        this.effects.start();
    }

    totalIntroSeconds() {
        const settings = intro_timing_settings();
        if (this.fittedCrawlSeconds !== undefined) settings.crawlScroll = this.fittedCrawlSeconds;
        return intro_schedule(settings).windowClose;
    }
}

/**
 * Ready handler that listens on the ffg-star-wars-enhancements socket.
 */
export function ready() {
    log("opening-crawl", "ready");
    game.socket.on("module.ffg-star-wars-enhancements", socket_listener);
}

/**
 * Parse the contents of a journal into the parts of the Opening Crawl into an
 * object.
 * @param {JournalEntry} journal
 * @returns {object|null}
 */
function journal_pages(journal) {
    const pages = journal?.pages;
    if (!pages) return [];
    if (Array.isArray(pages.contents)) return pages.contents;
    if (typeof pages.values === "function") return Array.from(pages.values());
    return [];
}

function parse_journal(journal) {
    const pages = journal_pages(journal).map((page) => page?.text?.content).filter(Boolean);
    // The crawl page is the one with the episode heading. A journal can have other pages first.
    const html = pages.find((page) => /<h1[\s>]/i.test(page)) ?? pages[0];
    if (!html) {
        ui.notifications.warn(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.missing-episode"));
        return null;
    }

    const journal_html = new DOMParser().parseFromString(String(html), "text/html");
    const episode_html = journal_html.querySelector("h1");
    const title_html = journal_html.querySelector("h2");

    if (!episode_html) {
        ui.notifications.warn(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.missing-episode"));
        return null;
    }
    if (!title_html) {
        ui.notifications.warn(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.missing-title"));
        return null;
    }

    const image_html = journal_html.querySelector("img");
    const image = image_html?.getAttribute("src") || null;
    if (image_html) {
        image_html.remove();
    } else {
        log("opening-crawl", "no image to pan to found in journal");
    }

    const body = Array.from(journal_html.querySelectorAll("p"), (paragraph) => crawl_text(paragraph.textContent)).filter((text) => text.length > 0);

    if (body.length == 0) {
        ui.notifications.warn(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.missing-body"));
        return null;
    }

    return {
        episode: crawl_text(episode_html.textContent),
        title: crawl_text(title_html.textContent),
        body: body,
        image: image,
    };
}

/**
 * Launch the opening crawl.
 * @param {object} data
 */
export function launch_opening_crawl(data) {
    log("opening-crawl", "launching");

    const musicSetting = game.settings.get("ffg-star-wars-enhancements", "opening-crawl-music");
    // Only set music if it's a non-empty string
    const music = musicSetting && typeof musicSetting === "string" && musicSetting.trim() !== "" ? musicSetting : null;
    
    if (!music) {
        log("opening-crawl", "no music configured");
    }

    const playlist = game.settings.get("ffg-star-wars-enhancements", "opening-crawl-playlist") || null;
    if (!playlist) {
        log("opening-crawl", "no playlist configured");
    }

    data = foundry.utils.mergeObject(data, {
        type: "opening-crawl",
        music: music,
        playlist: playlist,
        // only the launching client starts and stops the playlist
        launcher: game.user.id,
    });
    
    game.socket.emit("module.ffg-star-wars-enhancements", data);
    socket_listener(data);
    log("opening-crawl", "event emmitted");
}

/**
 * Listener for the ffg-star-wars-enhancements socket that launches the
 * OpeningCrawlApplication if the message type is "opening-crawl"
 *
 * @param {object} data object passed to OpeningCrawlApplication
 */
async function socket_listener(data) {
    log("socket", data);
    if (data.type == "opening-crawl") {
        // ApplicationV2.render() returns a Promise, not the app. Holding the
        // instance is what lets the timer close the window when the crawl ends.
        const crawl = new OpeningCrawlApplication(data);
        // Preload in the background. Foundry waits for a user gesture before it
        // loads audio, and a slow remote track can take many seconds; awaiting it
        // here used to delay the crawl itself (or block it entirely when the
        // audio context was still locked).
        if (data.music && data.music.trim() !== "" && !is_remote_audio(data.music)) {
            log("opening-crawl", "preloading audio in the background");
            crawl.audioReady = Promise.resolve()
                .then(() => game.audio.preload(data.music))
                .catch((error) => {
                    log("opening-crawl", "error preloading audio: " + error);
                    return null;
                });
        }
        await crawl.render(true);
        // The application schedules the reveal and close after it has measured the
        // text. This fallback only runs when that scheduling could not happen, so a
        // crawl never stays on screen forever because of a rendering problem.
        if (!crawl.closeScheduled && opening_crawl_setting("opening-crawl-intro-close-delay") !== 0) {
            await sleep(crawl.totalIntroSeconds() * 1000);
            if (!crawl.closing) crawl.close();
        }
    }
}

export function select_opening_crawl() {
    new OpeningCrawlSelectApplication().render(true);
}

class OpeningCrawlSelectApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "ffg-star-wars-enhancements-opening-crawl-select",
            window: {
                title: game.i18n.localize("ffg-star-wars-enhancements.controls.opening-crawl.title"),
            },
        });
    }

    static PARTS = {
        content: { template: "modules/ffg-star-wars-enhancements/templates/opening_crawl_select.html" },
    };

    async _prepareContext(options) {
        let folder = await get_journal_folder();
        let journals = folder.contents.map((journal) => {
            const type = crawl_type_of(journal.getFlag?.(MODULE_ID, CRAWL_FLAG));
            return {
                id: journal.id ?? journal._id,
                name: journal.name,
                type: type.id,
                typeLabel: game.i18n.localize(type.label),
            };
        });

        return {
            types: crawl_type_choices((key) => game.i18n.localize(key)),
            journals: journals,
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        
        const element = this.element?.jquery ? this.element[0] : this.element;
        const form = element?.querySelector?.("form");
        if (form) {
            form.addEventListener("submit", this._onSubmit.bind(this));
        }
    }

    async _onSubmit(event) {
        event.preventDefault();
        log("opening-crawl", "select | journal selected");

        const form = event.target;
        const formData = new FormData(form);
        const submitter = event.submitter;

        if (submitter?.classList.contains("create")) {
            create_opening_crawl(formData.get("crawl_type"));
            this.close();
            return;
        }

        const journalId = formData.get("journal_id");
        if (!journalId) {
            log("opening-crawl", "select | no journal selected");
            return;
        }

        let journal = game.journal.get(journalId);
        if (!journal) {
            log("opening-crawl", "select | failed to open journal after selection");
            return;
        }

        var data = parse_journal(journal);
        if (!data) {
            log("opening-crawl", "select | failed to parse journal");
            return;
        }
        data.crawlType = journal_crawl_type(journal);

        this.close();
        launch_opening_crawl(data);
        log("opening-crawl", "select | journal selection complete");
    }
}

/**
 * Get the opening crawls journal folder.
 */
async function get_journal_folder() {
    let folder_name = game.settings.get("ffg-star-wars-enhancements", "opening-crawl-folder");

    let folder = game.folders.getName(folder_name);
    if (!folder) {
        let missing_folder = game.i18n.format("ffg-star-wars-enhancements.opening-crawl.create-folder", {
            folder: folder_name,
        });
        const title = game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.title");
        const content = `<p>${missing_folder}</p>`;
        const confirm = foundry.applications?.api?.DialogV2?.confirm;
        let confirmation = confirm
            ? await confirm({ window: { title }, content, modal: true })
            : await Dialog.confirm({ title, content });
        if (confirmation) {
            folder = await Folder.create({
                name: folder_name,
                type: "JournalEntry",
            });
        } else {
            ui.notifications.error(game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.missing-folder"));
            throw "ffg-star-wars-enhancements | opening-crawl | opening crawl folder not configured in settings";
        }
    }
    return folder;
}

export async function create_opening_crawl(typeId) {
    const type = crawl_type_of(typeId);
    let folder = await get_journal_folder();
    let data = {
        name: "Episode X",
        folder: folder.id,
        flags: { [MODULE_ID]: { [CRAWL_FLAG]: type.id } },
        pages: [
            {
                name: "Opening Crawl",
                type: "text",
                text: {
                    content:
                        '<h1>Episode X</h1><h2>Episode Title</h2><p>Replace the h1 and h2 above with your episode and title. Then, replace this block of text with the paragraphs of your opening crawl. Lastly, the opening crawl will pan to the image below. Replace the image with a planet, ship, or simply remove the image entirely to pan to open space.</p><img src="modules/ffg-star-wars-enhancements/artwork/planet.png"/>',
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            },
        ],
    };
    const journal = await JournalEntry.create(data);
    journal.sheet.render(true);
}

function opening_crawl_setting(key) {
    const value = Number(game.settings.get(MODULE_ID, key));
    return Number.isFinite(value) ? value : 0;
}

/** Raw timing settings, shaped for `intro_schedule`. */
function intro_timing_settings() {
    return {
        textDelay: opening_crawl_setting("opening-crawl-intro-text-delay"),
        textDuration: opening_crawl_setting("opening-crawl-intro-text-duration"),
        crawlDelay: opening_crawl_setting("opening-crawl-intro-crawl-delay"),
        crawlDuration: opening_crawl_setting("opening-crawl-intro-crawl-duration"),
        crawlAdjust: opening_crawl_setting("opening-crawl-intro-crawl-duration-adjust"),
        crawlSpeed: game.settings.get(MODULE_ID, "opening-crawl-intro-crawl-speed"),
        panLead: opening_crawl_setting("opening-crawl-intro-pan-lead"),
        panDelay: opening_crawl_setting("opening-crawl-intro-pan-delay"),
        panDuration: opening_crawl_setting("opening-crawl-intro-pan-duration"),
        closeDelay: opening_crawl_setting("opening-crawl-intro-close-delay"),
    };
}

/**
 * Matches the CSS crawl length: (duration + adjust) / speed.
 * The close timer used to add the raw duration, so a speed below 1 closed the window while the text was still moving.
 */
function crawl_scroll_seconds() {
    return intro_schedule(intro_timing_settings()).crawlDuration;
}

/**
 * Helper function to delay code execution by an arbitrary amount
 * @param ms - number of MS to delay by
 * @returns {Promise<unknown>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// noinspection DuplicatedCode
class opening_crawl_UISettings extends FormApplication {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "data-importer",
            classes: [game.system.id, "data-import"],
            title: `${game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.ui.name")}`,
            template: "modules/ffg-star-wars-enhancements/templates/settings.html",
        });
    }

    // noinspection JSDeprecatedSymbols
    getData(options) {
        const gs = game.settings;
        const canConfigure = game.user.can("SETTINGS_MODIFY");
        const settings = [];

        // Classify all settings
        // noinspection JSUnusedLocalSymbols
        for (let setting of gs.settings.values()) {
            // Exclude settings the user cannot change
            if (!setting.key.includes("opening-crawl-") || (!canConfigure && setting.scope !== "client")) continue;

            // Update setting data
            const s = foundry.utils.deepClone(setting);
            s.name = game.i18n.localize(s.name);
            s.hint = game.i18n.localize(s.hint);
            s.value = game.settings.get(s.namespace ?? s.module ?? MODULE_ID, s.key);
            s.type = setting.type instanceof Function ? setting.type.name : "String";
            s.isCheckbox = setting.type === Boolean;
            s.isSelect = s.choices !== undefined;
            s.isRange = Boolean(setting.type === Number && s.range);
            s.filePicker = FILE_PICKER_TYPES[s.key] ?? null;
            s.group = SETTING_GROUPS[s.key] ?? "general";
            if (s.key === "opening-crawl-playlist") {
                s.isSelect = true;
                s.choices = {
                    "": game.i18n.localize("ffg-star-wars-enhancements.opening-crawl.playlist-none"),
                    ...Object.fromEntries(game.playlists.contents.map((p) => [p.id, p.name])),
                };
            }
            settings.push(s);
        }

        settings.sort((a, b) => {
            const a_index = SETTING_ORDER.indexOf(a.key);
            const b_index = SETTING_ORDER.indexOf(b.key);
            return (a_index < 0 ? Number.MAX_SAFE_INTEGER : a_index) - (b_index < 0 ? Number.MAX_SAFE_INTEGER : b_index);
        });

        // Mark the first setting of each group so the template can add a heading.
        let group = null;
        for (const setting of settings) {
            if (setting.group !== group) {
                setting.groupStart = true;
                setting.groupLabel = game.i18n.localize(
                    `ffg-star-wars-enhancements.opening-crawl.group-${setting.group}`
                );
                group = setting.group;
            }
        }

        // Return data
        return {
            user: game.user,
            canConfigure: canConfigure,
            systemTitle: game.system.title,
            data: {
                system: { title: game.system.title, menus: [], settings: settings },
            },
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".submenu button").click(this._onClickSubmenu.bind(this));
        html.find('button[name="reset"]').click(this._onResetDefaults.bind(this));
        html.find("button.file-picker").click(this._onFilePicker.bind(this));
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
        const form = event.currentTarget.form ?? this.form;
        if (!form) return;
        for (const [name, setting] of game.settings.settings.entries()) {
            if (!SETTING_ORDER.includes(setting.key)) continue;
            const input = form.elements.namedItem(name);
            if (!input) continue;
            if (input.type === "checkbox") input.checked = Boolean(setting.default);
            else input.value = setting.default ?? "";
        }
    }

    /* -------------------------------------------- */

    _onFilePicker(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const target = button.dataset.target;
        const input = target ? this.form?.elements.namedItem(target) : button.closest(".form-fields")?.querySelector("input");
        if (!input) return;

        const Picker = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        if (!Picker) {
            ui.notifications.error("The file picker is unavailable in this Foundry version.");
            return;
        }
        const picker = new Picker({
            type: button.dataset.type || "image",
            callback: (path) => {
                input.value = path;
                input.dispatchEvent(new Event("change", { bubbles: true }));
            },
            top: (this.position?.top ?? 0) + 40,
            left: (this.position?.left ?? 0) + 10,
        });
        return picker.browse();
    }

    /* -------------------------------------------- */

    // noinspection JSUnusedGlobalSymbols
    /** @override */
    async _updateObject(event, formData) {
        const form = this.form ?? event.target;
        if (!form) return;
        for (const element of Array.from(form.elements)) {
            if (!element.name) continue;
            const setting = game.settings.settings.get(element.name);
            if (!setting || !SETTING_ORDER.includes(setting.key)) continue;

            let value;
            if (element.type === "checkbox") {
                value = element.checked;
            } else if (setting.type === Number) {
                value = Number(element.value);
                if (!Number.isFinite(value)) continue;
            } else {
                value = element.value;
            }

            const namespace = setting.namespace ?? setting.module ?? MODULE_ID;
            const current = game.settings.get(namespace, setting.key);
            if (value !== current) await game.settings.set(namespace, setting.key, value);
        }
    }
}
