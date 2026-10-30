/**
 * Pure timing maths for the opening crawl.
 *
 * The Application reads settings and measures the rendered text, then asks this
 * module when each phase starts. Keeping the arithmetic here means the reveal
 * can be unit tested without Foundry or a browser.
 *
 * Timeline (all values in seconds, measured from the moment the crawl opens):
 *
 *   intro text ──► logo ──► crawl starts ──► pan starts ──► crawl ends
 *                                              │
 *                                              └──► pan ends ──► window closes
 *
 * The pan deliberately starts *before* the crawl text has finished scrolling,
 * so the last lines are still on screen while the camera tilts up and the image
 * rises into view.
 */

/** Default number of seconds the pan starts before the crawl text finishes. */
export const PAN_LEAD_DEFAULT = 10;

/** Where the panned-to image should sit in the viewport, as a fraction of its height. */
export const PAN_TARGET_FRACTION = 0.56;

/** Pan distance used when the crawl has no image, as a fraction of the viewport height. */
export const NO_IMAGE_PAN_FRACTION = 0.55;

const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

/** Clamp a value to an inclusive range. */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/** Treat a negative or missing time as zero. */
export function non_negative(value) {
    return Math.max(0, finite(value, 0));
}

/**
 * How long the text itself takes to scroll, after the speed multiplier.
 * Matches the CSS `--intro-crawl-duration`: (duration + adjust) / speed.
 */
export function crawl_scroll_seconds({ duration = 0, adjust = 0, speed = 1 } = {}) {
    const multiplier = finite(speed, 1);
    return (finite(duration, 0) + finite(adjust, 0)) / (multiplier > 0 ? multiplier : 1);
}

/**
 * The lead time cannot be longer than half the scroll, otherwise the pan would
 * start before the crawl is visible at all.
 */
export function pan_lead_for(crawl_duration, lead = PAN_LEAD_DEFAULT) {
    const duration = non_negative(crawl_duration);
    return clamp(finite(lead, 0), 0, duration / 2);
}

/** When the pan begins, relative to the start of the crawl. */
export function pan_start_seconds({ crawl_start = 0, crawl_duration = 0, pan_lead = 0, pan_delay = 0 } = {}) {
    return (
        non_negative(crawl_start) +
        non_negative(crawl_duration) -
        pan_lead_for(crawl_duration, pan_lead) +
        non_negative(pan_delay)
    );
}

/**
 * When the window closes. This is anchored to the old total (crawl end + pan +
 * close delay), so a lead-in pan does not shorten the music or the hold.
 */
export function window_close_seconds({
    crawl_start = 0,
    crawl_duration = 0,
    pan_delay = 0,
    pan_duration = 0,
    close_delay = 0,
} = {}) {
    return (
        non_negative(crawl_start) +
        non_negative(crawl_duration) +
        non_negative(pan_delay) +
        non_negative(pan_duration) +
        non_negative(close_delay)
    );
}

/**
 * Pixels the starfield has to move for the image centre to land at
 * `target_fraction` of the viewport height.
 *
 * The image is positioned from the bottom of a tall (4200px) scrolling plane, so
 * its starting centre is `container_height - bottom - image_height / 2`.
 * With no image (or before it has loaded) fall back to a fixed fraction of the
 * viewport, which keeps the pan readable.
 */
export function reveal_distance({
    container_height = 0,
    image_bottom = 0,
    image_height = 0,
    viewport_height = 0,
    target_fraction = PAN_TARGET_FRACTION,
} = {}) {
    const viewport = non_negative(viewport_height);
    const height = non_negative(image_height);
    if (height <= 0) return viewport * NO_IMAGE_PAN_FRACTION;

    const container = Math.max(non_negative(container_height), height);
    const image_centre = container - non_negative(image_bottom) - height / 2;
    const target = viewport * clamp(finite(target_fraction, PAN_TARGET_FRACTION), 0, 1);
    return Math.max(0, image_centre - target);
}

/**
 * Build the whole reveal schedule from the raw settings.
 *
 * @param {object} [options]
 * @param {number} [options.textDelay]     Intro text delay.
 * @param {number} [options.textDuration]  Intro text duration.
 * @param {number} [options.crawlDelay]    Crawl text delay (after the intro text).
 * @param {number} [options.crawlDuration] Configured crawl duration.
 * @param {number} [options.crawlAdjust]   Seconds added to/removed from the crawl.
 * @param {number} [options.crawlSpeed]    Speed multiplier.
 * @param {number} [options.crawlScroll]   Pre-fitted scroll length; overrides duration/adjust/speed.
 * @param {number} [options.panLead]       Seconds of overlap between crawl and pan.
 * @param {number} [options.panDelay]      Delay after the (adjusted) crawl end.
 * @param {number} [options.panDuration]   Length of the pan.
 * @param {number} [options.closeDelay]    Delay after the pan before closing; 0 = never close.
 * @returns {object} The schedule, including `autoClose`.
 */
export function intro_schedule(options = {}) {
    const text_delay = non_negative(options.textDelay);
    const text_duration = non_negative(options.textDuration);
    const crawl_delay = non_negative(options.crawlDelay);
    const crawl_duration =
        options.crawlScroll === undefined
            ? crawl_scroll_seconds({
                  duration: options.crawlDuration,
                  adjust: options.crawlAdjust,
                  speed: options.crawlSpeed,
              })
            : non_negative(options.crawlScroll);
    const crawl_start = text_delay + text_duration + crawl_delay;
    const pan_delay = non_negative(options.panDelay);
    const pan_duration = non_negative(options.panDuration);
    const close_delay = non_negative(options.closeDelay);
    const pan_lead = pan_lead_for(crawl_duration, options.panLead);
    const pan_start = pan_start_seconds({
        crawl_start,
        crawl_duration,
        pan_lead,
        pan_delay,
    });
    const pan_end = pan_start + pan_duration;
    const window_close = window_close_seconds({
        crawl_start,
        crawl_duration,
        pan_delay,
        pan_duration,
        close_delay,
    });

    return {
        textDelay: text_delay,
        textDuration: text_duration,
        crawlDelay: crawl_delay,
        crawlStart: crawl_start,
        crawlDuration: crawl_duration,
        crawlEnd: crawl_start + crawl_duration,
        panLead: pan_lead,
        panStart: pan_start,
        panDuration: pan_duration,
        panEnd: pan_end,
        hold: Math.max(0, window_close - pan_end),
        windowClose: window_close,
        autoClose: close_delay > 0,
    };
}

/**
 * Format seconds for a CSS custom property, e.g. `7` -> `"7s"`.
 * Keeps the value stable for tests and avoids `10.000s` in the DOM.
 */
export function css_seconds(value) {
    return `${Math.round(non_negative(value) * 1000) / 1000}s`;
}
