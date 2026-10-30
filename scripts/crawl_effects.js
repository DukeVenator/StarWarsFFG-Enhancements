/**
 * Canvas atmosphere for the opening crawl.
 *
 * The saga crawl needs nothing; the Clone Wars crawl gets drifting blue dust and
 * the occasional hyperspace streak, and the Criminal Empire crawl gets rising
 * embers. The controller draws on one canvas behind the crawl text, caps the
 * device pixel ratio so 4K windows stay smooth, pauses when the tab is hidden,
 * and refuses to animate when the user prefers reduced motion.
 */

const TAU = Math.PI * 2;
const DPR_CAP = 1.5;

const DEFAULTS = Object.freeze({
    enabled: true,
    particles: true,
    streaks: true,
    kind: "dust",
    density: 80,
    intensity: 0.6,
    speed: 1,
    particleColor: "#8fd8ff",
    streakColor: "#d6f2ff",
});

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function hex_to_rgb(hex, fallback = "143, 216, 255") {
    const value = String(hex ?? "").trim();
    const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
    if (short) {
        return short
            .slice(1)
            .map((part) => parseInt(part + part, 16))
            .join(", ");
    }
    const long = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
    if (long) {
        return long
            .slice(1)
            .map((part) => parseInt(part, 16))
            .join(", ");
    }
    return fallback;
}

function reduced_motion() {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export class CrawlEffects {
    /**
     * @param {HTMLCanvasElement} canvas Canvas in the crawl template.
     * @param {HTMLElement} root The `.ffg-star-wars-enhancements-opening-crawl` element.
     * @param {object} [options] Effect settings, already filtered by crawl type.
     */
    constructor(canvas, root, options = {}) {
        this.canvas = canvas;
        this.root = root;
        this.ctx = canvas?.getContext?.("2d") ?? null;
        this.options = { ...DEFAULTS, ...options };
        this.particles = [];
        this.streaks = [];
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.running = false;
        this.last = 0;
        this.raf = 0;
        this.streak_clock = 0;
        this.particle_rgb = hex_to_rgb(this.options.particleColor);
        this.streak_rgb = hex_to_rgb(this.options.streakColor ?? this.options.particleColor, "214, 242, 255");
        this._on_resize = () => this.resize();
        this._on_visibility = () => {
            if (!document.hidden) this.last = performance.now();
        };
    }

    /** Start animating. Returns false when the effects are disabled or unwanted. */
    start() {
        if (this.running || !this.ctx || !this.options.enabled) return false;
        if (reduced_motion()) return false;

        this.running = true;
        this.resize();
        this._reset_particles();
        this._add_listeners();
        this.last = performance.now();
        this.raf = requestAnimationFrame(this._tick);
        return true;
    }

    /** Stop the loop, drop particles, and clear the canvas. */
    stop() {
        this.running = false;
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
        this._remove_listeners();
        this.particles = [];
        this.streaks = [];
        if (this.ctx && this.width > 0 && this.height > 0) {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }
    }

    /** Alias used by the application when the window closes. */
    destroy() {
        this.stop();
        this.ctx = null;
        this.canvas = null;
        this.root = null;
    }

    resize() {
        if (!this.canvas || !this.ctx || !this.root) return;
        const rect = this.root.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(number(globalThis.devicePixelRatio, 1), DPR_CAP);

        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._reset_particles();
    }

    _add_listeners() {
        if (typeof window !== "undefined") window.addEventListener("resize", this._on_resize);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", this._on_visibility);
        if (typeof ResizeObserver === "function" && this.root) {
            this._observer = new ResizeObserver(this._on_resize);
            this._observer.observe(this.root);
        }
    }

    _remove_listeners() {
        if (typeof window !== "undefined") window.removeEventListener("resize", this._on_resize);
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this._on_visibility);
        this._observer?.disconnect?.();
        this._observer = null;
    }

    _particle_count() {
        if (!this.options.particles) return 0;
        const base = Math.max(20, number(this.options.density, 80));
        const area = (this.width * this.height) / (1920 * 1080);
        return Math.round(base * clamp(area, 0.35, 1.6));
    }

    _reset_particles() {
        const count = this._particle_count();
        this.particles = Array.from({ length: count }, () => this._make_particle(true));
        this.streaks = [];
        this.streak_clock = 0;
    }

    _make_particle(anywhere) {
        const ember = this.options.kind === "ember";
        const depth = 0.25 + Math.random() * 0.75;
        return {
            x: Math.random() * this.width,
            y: anywhere ? Math.random() * this.height : this.height + 8,
            depth,
            speed: (ember ? 18 : 7) + Math.random() * (ember ? 30 : 16),
            drift: (Math.random() - 0.5) * (ember ? 10 : 5),
            size: (ember ? 0.9 : 0.6) + depth * (ember ? 2.4 : 1.8),
            phase: Math.random() * TAU,
            flicker: 0.6 + Math.random() * 1.8,
        };
    }

    _make_streak() {
        const angle = Math.random() * TAU;
        return {
            x: this.width * 0.5 + (Math.random() - 0.5) * this.width * 0.18,
            y: this.height * 0.44 + (Math.random() - 0.5) * this.height * 0.16,
            angle,
            length: 0,
            speed: 520 + Math.random() * 1100,
            life: 0.35 + Math.random() * 0.55,
            age: 0,
            width: 0.8 + Math.random() * 1.7,
        };
    }

    _tick = (now) => {
        if (!this.running) return;
        this.raf = requestAnimationFrame(this._tick);
        if (typeof document !== "undefined" && document.hidden) {
            this.last = now;
            return;
        }

        const delta = clamp((now - this.last) / 1000, 0, 0.05);
        this.last = now;
        this._update(delta);
        this._draw();
    };

    _update(delta) {
        const speed = clamp(number(this.options.speed, 1), 0.05, 4);
        const intensity = clamp(number(this.options.intensity, 0.6), 0, 1);
        const ember = this.options.kind === "ember";

        for (const particle of this.particles) {
            particle.y -= particle.speed * speed * delta;
            particle.x += particle.drift * speed * delta * (ember ? 1.6 : 1);
            if (ember) {
                particle.x += Math.sin(particle.phase + particle.y * 0.01) * 6 * delta * speed;
            }
            if (particle.y < -8 || particle.x < -12 || particle.x > this.width + 12) {
                Object.assign(particle, this._make_particle(false));
            }
        }

        if (this.options.streaks && this.streak_rgb) {
            this.streak_clock += delta;
            const interval = (1.9 - intensity) / Math.max(speed, 0.2);
            if (this.streak_clock >= interval) {
                this.streak_clock = 0;
                this.streaks.push(this._make_streak());
            }
            for (const streak of this.streaks) {
                streak.age += delta;
                streak.length += streak.speed * speed * delta;
            }
            this.streaks = this.streaks.filter((streak) => streak.age < streak.life);
        } else {
            this.streaks = [];
        }
    }

    _draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.globalCompositeOperation = "lighter";

        const intensity = clamp(number(this.options.intensity, 0.6), 0, 1);
        for (const particle of this.particles) {
            const flicker =
                this.options.kind === "ember"
                    ? 0.65 + 0.35 * Math.sin(performance.now() * 0.004 * particle.flicker + particle.phase)
                    : 1;
            const alpha = clamp((0.08 + particle.depth * 0.55) * intensity * flicker, 0, 1);
            ctx.beginPath();
            ctx.fillStyle = `rgba(${this.particle_rgb}, ${alpha})`;
            ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
            ctx.fill();
        }

        for (const streak of this.streaks) {
            const life = 1 - streak.age / streak.life;
            const alpha = clamp(life * intensity, 0, 1);
            const head_x = streak.x + Math.cos(streak.angle) * streak.length;
            const head_y = streak.y + Math.sin(streak.angle) * streak.length;
            const tail = Math.min(streak.length, 260);
            const tail_x = head_x - Math.cos(streak.angle) * tail;
            const tail_y = head_y - Math.sin(streak.angle) * tail;
            const gradient = ctx.createLinearGradient(tail_x, tail_y, head_x, head_y);
            gradient.addColorStop(0, `rgba(${this.streak_rgb}, 0)`);
            gradient.addColorStop(1, `rgba(${this.streak_rgb}, ${alpha})`);
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = streak.width;
            ctx.lineCap = "round";
            ctx.moveTo(tail_x, tail_y);
            ctx.lineTo(head_x, head_y);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = "source-over";
    }
}
