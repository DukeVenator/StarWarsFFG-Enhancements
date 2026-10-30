import test from "node:test";
import assert from "node:assert/strict";
import {
    applyThresholdToFlag,
    blankPoints,
    counts,
    cyclePoint,
    learnedConflictTalents,
    moralityDelta,
    murderFlip,
    presenceScore,
    pullDice,
    pullScore,
    readFlag,
    resolvePresence,
    stepTowardDark,
    stepTowardLight,
    thresholdChanges,
    thresholdEffectData,
} from "../../scripts/respec/presence.js";
import {
    CAREERS,
    CONFLICT_ROWS,
    TRANQUILITY_ROWS,
    UNASSIGNED_SPECIALIZATIONS,
    UNIVERSAL_SPECIALIZATIONS,
    clampAward,
    findRow,
    rangeLabel,
} from "../../scripts/respec/tables.js";

test("new presence is ten neutral points and cycles neutral, light, dark", () => {
    const points = blankPoints();
    assert.equal(points.length, 10);
    assert.deepEqual(counts(points), { light: 0, neutral: 10, dark: 0 });
    assert.equal(cyclePoint("neutral"), "light");
    assert.equal(cyclePoint("light"), "dark");
    assert.equal(cyclePoint("dark"), "neutral");
});

test("balance points move neutrals first", () => {
    const towardLight = stepTowardLight(blankPoints());
    assert.equal(towardLight[0], "light");
    assert.equal(counts(towardLight).light, 1);

    const allDark = Array(10).fill("dark");
    const redeemed = stepTowardLight(allDark);
    assert.equal(redeemed[0], "neutral");
    assert.equal(counts(redeemed).dark, 9);

    const towardDark = stepTowardDark(blankPoints());
    assert.equal(towardDark[0], "dark");

    const allLight = Array(10).fill("light");
    const fallen = stepTowardDark(allLight);
    assert.equal(fallen[0], "dark");
    assert.equal(counts(fallen).light, 9);
});

test("equal tranquility and conflict leave the points and reset both counters", () => {
    const points = stepTowardLight(blankPoints());
    const resolved = resolvePresence(points, 3, 3);
    assert.equal(resolved.moved, "none");
    assert.deepEqual(resolved.points, points);
    assert.equal(resolved.tranquility, 0);
    assert.equal(resolved.conflict, 0);
});

test("the greater session total moves one point and then both counters reset", () => {
    const calm = resolvePresence(blankPoints(), 5, 3);
    assert.equal(calm.moved, "light");
    assert.equal(counts(calm.points).light, 1);
    assert.equal(calm.tranquility, 0);
    assert.equal(calm.conflict, 0);

    const turmoil = resolvePresence(blankPoints(), 1, 4);
    assert.equal(turmoil.moved, "dark");
    assert.equal(counts(turmoil.points).dark, 1);
});

test("murder flips five points to dark, light points first", () => {
    const points = ["light", "light", "light", "neutral", "neutral", "neutral", "neutral", "neutral", "dark", "dark"];
    const flipped = murderFlip(points);
    assert.deepEqual(flipped.slice(0, 5), ["dark", "dark", "dark", "dark", "dark"]);
    assert.equal(flipped[5], "neutral");
    assert.equal(counts(flipped).dark, 7);
});

test("pull score uses morality until Force Presence derives it from the points", () => {
    assert.equal(pullScore(blankPoints(), 62, false), 62);
    assert.equal(presenceScore(blankPoints()), 50);
    assert.equal(presenceScore(Array(10).fill("light")), 100);
    assert.equal(presenceScore(Array(10).fill("dark")), 1);
    const mixed = ["light", "light", "dark", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral", "neutral"];
    assert.equal(presenceScore(mixed), 55);
    assert.equal(pullScore(mixed, 10, true), 55);
});

test("pull dice are a boost, a setback, or both when the score equals the d100", () => {
    assert.deepEqual(pullDice(60, 40), { boost: 1, setback: 0 });
    assert.deepEqual(pullDice(30, 40), { boost: 0, setback: 1 });
    assert.deepEqual(pullDice(40, 40), { boost: 1, setback: 1 });
});

test("unified conflict moves morality by the difference and does not clamp it", () => {
    assert.equal(moralityDelta(3, 8), 5);
    assert.equal(moralityDelta(8, 3), -5);
    assert.equal(moralityDelta(4, 4), 0);
});

test("thresholds change strain and wounds, and destiny only at nine", () => {
    const sevenDark = thresholdChanges(["dark", "dark", "dark", "dark", "dark", "dark", "dark", "neutral", "neutral", "neutral"]);
    assert.deepEqual(thresholdEffectData(sevenDark), [
        { key: "system.stats.strain.max", mode: 2, type: "add", value: -2 },
        { key: "system.stats.wounds.max", mode: 2, type: "add", value: 2 },
    ]);
    assert.equal(sevenDark.destiny, null);
    assert.equal(sevenDark.consumed, false);

    const nineDark = thresholdChanges(Array(9).fill("dark").concat("neutral"));
    assert.equal(nineDark.destiny, "flip-dark");
    assert.equal(thresholdChanges(Array(10).fill("dark")).consumed, true);

    const sevenLight = thresholdChanges(Array(7).fill("light").concat(["neutral", "neutral", "neutral"]));
    assert.equal(sevenLight.strain, 2);
    assert.equal(sevenLight.wounds, 0);
    assert.deepEqual(thresholdEffectData(sevenLight), [
        { key: "system.stats.strain.max", mode: 2, type: "add", value: 2 },
    ]);
    assert.equal(thresholdChanges(Array(9).fill("light").concat("neutral")).destiny, "add-light");
    assert.deepEqual(thresholdEffectData(thresholdChanges(blankPoints())), []);
});

test("dark-pip status sticks until seven light, and destiny does not grant twice in one band", () => {
    const dark = thresholdChanges(Array(9).fill("dark").concat("light"));
    const first = applyThresholdToFlag(readFlag(null), dark);
    assert.equal(first.flag.generatesFromDarkPips, true);
    assert.equal(first.flag.redeemed, false);
    assert.equal(first.grant, "flip-dark");

    const second = applyThresholdToFlag(first.flag, dark);
    assert.equal(second.grant, null);
    assert.equal(second.flag.destinyApplied, "dark");

    const dropped = applyThresholdToFlag(second.flag, thresholdChanges(Array(7).fill("dark").concat(Array(3).fill("neutral"))));
    assert.equal(dropped.flag.generatesFromDarkPips, true);
    assert.equal(dropped.flag.destinyApplied, "");
    assert.equal(dropped.grant, null);

    const light = thresholdChanges(Array(7).fill("light").concat(Array(3).fill("neutral")));
    const redeemed = applyThresholdToFlag(dropped.flag, light);
    assert.equal(redeemed.flag.generatesFromDarkPips, false);
    assert.equal(redeemed.flag.redeemed, true);

    const neverDark = applyThresholdToFlag(readFlag(null), light);
    assert.equal(neverDark.flag.redeemed, false);
    assert.equal(neverDark.flag.generatesFromDarkPips, false);
});

test("conflict talents are learned specialization nodes and talent items, not force powers", () => {
    const names = learnedConflictTalents([
        {
            type: "specialization",
            system: {
                talents: {
                    a: { name: "Intimidating", islearned: true, isConflictTalent: true },
                    b: { name: "Unbought", islearned: false, isConflictTalent: true },
                    c: { name: "Calm", islearned: true, isConflictTalent: false },
                },
            },
        },
        { type: "talent", name: "Terror", system: { isConflictTalent: true } },
        { type: "talent", name: "Terror", system: { isConflictTalent: true } },
        { type: "forcepower", name: "Bind", system: { isConflictTalent: true } },
    ]);
    assert.deepEqual(names, ["Intimidating", "Terror"]);
});

test("award rows clamp to their range and murder is not a number", () => {
    const generosity = findRow(TRANQUILITY_ROWS, "generosity");
    assert.equal(clampAward(generosity, 9), 3);
    assert.equal(clampAward(generosity, 1), 2);
    assert.equal(rangeLabel(generosity), "2–3");
    const murder = findRow(CONFLICT_ROWS, "murder");
    assert.equal(clampAward(murder, 5), null);
    assert.equal(rangeLabel(findRow(TRANQUILITY_ROWS, "justice")), "10+");
    const justice = findRow(TRANQUILITY_ROWS, "justice");
    assert.equal(clampAward(justice, 9), 10);
    assert.equal(clampAward(justice, 250), 250);
});

test("career powers stay a lookup of the primer list", () => {
    const consular = CAREERS.find((career) => career.name === "Consular");
    assert.deepEqual(consular.powers, ["Influence", "Move"]);
    assert.deepEqual(
        consular.specializations.find((entry) => entry.name === "Sage").powers,
        ["Foresee", "Sense"]
    );
    assert.equal(UNIVERSAL_SPECIALIZATIONS.length, 7);
    assert.equal(UNASSIGNED_SPECIALIZATIONS.includes("Nightsister"), true);
    assert.equal(UNASSIGNED_SPECIALIZATIONS.includes("Padawan Survivor"), true);
    assert.equal(CAREERS.find((career) => career.name === "Jedi").specializations[0].note.length > 0, true);
});
