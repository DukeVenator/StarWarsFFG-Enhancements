import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
    PAN_LEAD_DEFAULT,
    clamp,
    crawl_scroll_seconds,
    css_seconds,
    intro_schedule,
    pan_lead_for,
    pan_start_seconds,
    reveal_distance,
    window_close_seconds,
} from "../../scripts/opening_crawl_timing.js";
import {
    CRAWL_TYPE_IDS,
    CRAWL_TYPES,
    DEFAULT_CRAWL_TYPE,
    crawl_number_html,
    crawl_starjedi_text,
    crawl_title_text,
    crawl_type_choices,
    crawl_type_of,
    escape_html,
} from "../../scripts/opening_crawl_types.js";
import { CrawlEffects } from "../../scripts/crawl_effects.js";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

/* -------------------------------------------------------------------------- */
/* Timing                                                                     */
/* -------------------------------------------------------------------------- */

test("crawl scroll matches the CSS duration and speed multiplier", () => {
    assert.equal(crawl_scroll_seconds({ duration: 73, adjust: 0, speed: 1 }), 73);
    assert.equal(crawl_scroll_seconds({ duration: 73, adjust: 2, speed: 1.5 }), 50);
    assert.equal(crawl_scroll_seconds({ duration: 60, adjust: -10, speed: 1 }), 50);
    // A zero/negative speed must not divide by zero or run backwards.
    assert.equal(crawl_scroll_seconds({ duration: 73, speed: 0 }), 73);
    assert.equal(crawl_scroll_seconds({ duration: 73, speed: -2 }), 73);
});

test("pan lead is clamped to half the crawl", () => {
    assert.equal(pan_lead_for(73, 5), 5);
    assert.equal(pan_lead_for(10, 8), 5);
    assert.equal(pan_lead_for(73, -3), 0);
    assert.equal(pan_lead_for(0, 5), 0);
    assert.equal(pan_lead_for(73, PAN_LEAD_DEFAULT), 10);
});

test("the pan starts before the crawl text leaves the screen", () => {
    const start = pan_start_seconds({ crawl_start: 13, crawl_duration: 73, pan_lead: 5, pan_delay: 0 });
    assert.equal(start, 81);
    assert.ok(start < 13 + 73, "pan must overlap the final seconds of the crawl");
});

test("window close keeps the old total when the pan moves earlier", () => {
    const schedule = intro_schedule({
        textDelay: 1,
        textDuration: 6,
        crawlDelay: 6,
        crawlDuration: 73,
        crawlAdjust: 0,
        crawlSpeed: 1,
        panLead: 5,
        panDelay: 0,
        panDuration: 7,
        closeDelay: 3,
    });

    assert.equal(schedule.crawlStart, 13);
    assert.equal(schedule.crawlEnd, 86);
    assert.equal(schedule.panStart, 81);
    assert.equal(schedule.panEnd, 88);
    assert.equal(schedule.windowClose, 96);
    // The lead is absorbed by the hold, so the ending is not shortened.
    assert.equal(schedule.hold, 8);
    assert.equal(
        schedule.windowClose,
        window_close_seconds({
            crawl_start: 13,
            crawl_duration: 73,
            pan_delay: 0,
            pan_duration: 7,
            close_delay: 3,
        })
    );
    assert.equal(schedule.autoClose, true);
});

test("a close delay of zero means the window never auto-closes", () => {
    const schedule = intro_schedule({ closeDelay: 0, panLead: 5, panDuration: 7 });
    assert.equal(schedule.autoClose, false);
    assert.equal(schedule.windowClose, schedule.panEnd + schedule.panLead);
});

test("reveal distance centres the image at the target fraction of the viewport", () => {
    assert.equal(
        reveal_distance({
            container_height: 4200,
            image_bottom: 1300,
            image_height: 400,
            viewport_height: 1000,
        }),
        2140
    );
    // No image: a visible fallback travel instead of an enormous jump.
    assert.equal(reveal_distance({ viewport_height: 1000 }), 550);
    // Never scroll backwards.
    assert.equal(
        reveal_distance({
            container_height: 4200,
            image_bottom: 3800,
            image_height: 400,
            viewport_height: 1000,
        }),
        0
    );
});

test("CSS second formatting is stable", () => {
    assert.equal(css_seconds(7), "7s");
    assert.equal(css_seconds(7.5), "7.5s");
    assert.equal(css_seconds(1 / 3), "0.333s");
    assert.equal(css_seconds(0), "0s");
    assert.equal(css_seconds(-4), "0s");
    assert.equal(clamp(12, 0, 10), 10);
});

/* -------------------------------------------------------------------------- */
/* Crawl types                                                                */
/* -------------------------------------------------------------------------- */

test("the three crawl types are registered in order and unknown ids fall back", () => {
    assert.deepEqual(CRAWL_TYPE_IDS, ["saga", "clone-wars", "criminal-empire"]);
    assert.equal(crawl_type_of("clone-wars").id, "clone-wars");
    assert.equal(crawl_type_of("criminal-empire").wordmark.join(" "), "CRIMINAL EMPIRE");
    assert.equal(crawl_type_of("not-a-type").id, "saga");
    assert.equal(crawl_type_of(undefined).id, "saga");
});

test("type cards expose labels, descriptions, and one default selection", () => {
    const choices = crawl_type_choices((key) => key.replace("ffg-star-wars-enhancements.opening-crawl.", ""));
    assert.equal(choices.length, 3);
    assert.equal(choices[0].checked, true);
    assert.equal(choices[1].checked, false);
    assert.equal(choices[2].id, "criminal-empire");
    assert.equal(choices[2].label, "type-criminal-empire");
    assert.match(choices[2].description, /criminal-empire-description/);
});

test("the title font uses normal glyphs instead of its STAR WARS logo and crawl-text glyphs", () => {
    // SWCrawlTitle's capital S is the full logo and its capital L is the
    // "A long time ago..." phrase; the lowercase glyphs are normal letters.
    assert.equal(crawl_title_text("EPISODE XVI"), "EPIsODE XVI");
    assert.equal(crawl_title_text("HONDO’S TOTALLY LEGAL AUCTION"), "HONDO’s TOTAllY lEGAl AUCTION");
    assert.equal(crawl_title_text("TOTALLY LEGAL"), "TOTAllY lEGAl");
    assert.equal(crawl_title_text("CRIMINAL"), "CRIMINAl");
    assert.equal(crawl_title_text("session 10", { uppercase: true }), "sEssION 10");
});

test("StarJedi wordmarks use its zero glyph for O", () => {
    // StarJedi's O glyph reads as N; its zero is a proper Star Wars O.
    assert.equal(crawl_starjedi_text("CLONE"), "CL0NE");
    assert.equal(crawl_starjedi_text("STAR WARS"), "STAR WARS");
});

test("the wide 1 glyph is wrapped for the font and other digits are untouched", () => {
    assert.equal(
        crawl_number_html(crawl_title_text("SESSION 10", { uppercase: true })),
        'sEssION <span class="crawl-num">1</span>0'
    );
    assert.equal(crawl_number_html("EPISODE 4"), "EPISODE 4");
    assert.equal(crawl_number_html("<10> & 'x'"), '&lt;<span class="crawl-num">1</span>0&gt; &amp; &#39;x&#39;');
    assert.equal(escape_html(`a<b>"c"&`), "a&lt;b&gt;&quot;c&quot;&amp;");
});

test("every type has localized copy, a stylesheet theme, and effect metadata", () => {
    const lang = JSON.parse(read("../../lang/en.json"));
    const css = read("../../styles/opening_crawl.css");
    for (const type of Object.values(CRAWL_TYPES)) {
        assert.ok(lang[type.label], `missing label: ${type.label}`);
        assert.ok(lang[type.description], `missing description: ${type.description}`);
        for (const key of type.intro) {
            assert.ok(lang[key], `missing intro line: ${key}`);
            assert.ok(lang[key].trim().length > 0, `empty intro line: ${key}`);
        }
        // The saga crawl is the base theme, so it has no extra type block.
        if (type.id !== DEFAULT_CRAWL_TYPE) {
            assert.match(css, new RegExp(`\\.crawl-type-${type.id}\\b`), `missing CSS theme for ${type.id}`);
        }
    }
    assert.equal(CRAWL_TYPES.saga.effects, null);
    assert.equal(CRAWL_TYPES["clone-wars"].effects.kind, "dust");
    assert.equal(CRAWL_TYPES["criminal-empire"].effects.kind, "ember");
    assert.equal(CRAWL_TYPES.saga.wordmarkUsesTitleFont, false);
    assert.equal(CRAWL_TYPES["clone-wars"].wordmarkUsesTitleFont, false);
    assert.equal(CRAWL_TYPES["criminal-empire"].wordmarkUsesTitleFont, true);
    assert.equal(CRAWL_TYPES.saga.wordmarkStarJedi, true);
    assert.equal(CRAWL_TYPES["clone-wars"].wordmarkStarJedi, true);
    assert.equal(CRAWL_TYPES["criminal-empire"].wordmarkStarJedi, false);
});

/* -------------------------------------------------------------------------- */
/* Templates and effects                                                      */
/* -------------------------------------------------------------------------- */

test("the creator uses radio cards for the type and the player renders effect layers", () => {
    const select = read("../../templates/opening_crawl_select.html");
    assert.match(select, /name="crawl_type"/);
    assert.match(select, /opening-crawl-type-card/);
    assert.match(select, /type\.description/);

    const crawl = read("../../templates/opening_crawl.html");
    assert.match(crawl, /data-crawl-type/);
    assert.match(crawl, /crawl-effects-canvas/);
    assert.match(crawl, /crawl-effects-scanlines/);
    assert.match(crawl, /crawl-effects-vignette/);
    assert.match(crawl, /--crawl-pan-distance/);
});

test("the effects controller is importable without a browser", () => {
    assert.equal(typeof CrawlEffects, "function");
});
