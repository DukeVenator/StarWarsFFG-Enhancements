import test from "node:test";
import assert from "node:assert/strict";
import { auditParty, radarPoint, radarPolygon, skillScore } from "../../scripts/party_skills/audit.js";

function sheet(id, name, characteristics, skills) {
    return { id, name, characteristics, skills };
}

function skill(label, type, characteristic, rank, career = false) {
    return { label, type, characteristic, rank, career };
}

test("score equals characteristic plus rank and matches yellow-weighted dice", () => {
    const scored = skillScore(3, 2);
    assert.equal(scored.characteristic, 3);
    assert.equal(scored.rank, 2);
    assert.equal(scored.ability, 3);
    assert.equal(scored.proficiency, 2);
    assert.equal(scored.score, 5);
    const yellowWeighted = scored.proficiency * 2 + (scored.ability - scored.proficiency);
    assert.equal(scored.score, yellowWeighted);

    const untrained = skillScore(4, 0);
    assert.equal(untrained.ability, 4);
    assert.equal(untrained.proficiency, 0);
    assert.equal(untrained.score, 4);

    assert.deepEqual(skillScore(-2, "nope"), {
        characteristic: 0,
        rank: 0,
        ability: 0,
        proficiency: 0,
        score: 0,
    });
});

test("missing skill or characteristic counts as 0", () => {
    const audit = auditParty([
        sheet("a", "Hoot Hoot", { Agility: 4 }, {
            Stealth: skill("Stealth", "General", "Agility", 2, true),
        }),
        sheet("b", "IG-0M", { Agility: 1 }, {}),
        sheet("c", "Curlos Smur", {}, {
            Athletics: skill("Athletics", "General", "Brawn", 2),
        }),
    ]);

    const stealth = audit.sections[0].skills.find((entry) => entry.key === "Stealth");
    const missing = stealth.cells.find((cell) => cell.id === "b");
    assert.equal(missing.rank, 0);
    assert.equal(missing.characteristic, 1);
    assert.equal(missing.score, 1);
    assert.equal(missing.career, false);
    assert.equal(stealth.cells.find((cell) => cell.id === "a").career, true);
    assert.equal(stealth.tag, "specialist");

    const athletics = audit.sections[0].skills.find((entry) => entry.key === "Athletics");
    const noCharacteristic = athletics.cells.find((cell) => cell.id === "c");
    assert.equal(noCharacteristic.rank, 2);
    assert.equal(noCharacteristic.characteristic, 0);
    assert.equal(noCharacteristic.score, 2);
});

test("overlap, gap, strength, and weakness use the party thresholds", () => {
    const audit = auditParty([
        sheet("a", "Hoot Hoot", { Agility: 4, Cunning: 2, Brawn: 5 }, {
            Stealth: skill("Stealth", "General", "Agility", 2),
            Deception: skill("Deception", "General", "Cunning", 1),
            Athletics: skill("Athletics", "General", "Brawn", 0),
            Cool: skill("Cool", "Social", "Presence", 0),
        }),
        sheet("b", "Verner Locke", { Agility: 2, Cunning: 1, Brawn: 2, Presence: 1 }, {
            Stealth: skill("Stealth", "General", "Agility", 1),
            Deception: skill("Deception", "General", "Cunning", 1),
            Athletics: skill("Athletics", "General", "Brawn", 0),
            Cool: skill("Cool", "Social", "Presence", 1),
        }),
    ]);

    const byKey = Object.fromEntries(audit.sections.flatMap((section) => section.skills).map((entry) => [entry.key, entry]));
    assert.equal(byKey.Stealth.strength, true);
    assert.equal(byKey.Stealth.bestScore, 6);
    assert.equal(byKey.Stealth.overlap, true);
    assert.equal(byKey.Stealth.tag, "overlap");
    assert.deepEqual(
        byKey.Stealth.trained.map((entry) => entry.rank),
        [2, 1]
    );

    assert.equal(byKey.Deception.strength, false);
    assert.equal(byKey.Deception.weakness, true);
    assert.equal(byKey.Deception.bestScore, 3);
    assert.equal(byKey.Deception.overlap, true);

    assert.equal(byKey.Athletics.gap, true);
    assert.equal(byKey.Athletics.overlap, false);
    assert.equal(byKey.Athletics.weakness, false);
    assert.equal(byKey.Athletics.bestScore, 5);

    assert.equal(byKey.Cool.gap, false);
    assert.equal(byKey.Cool.weakness, true);
    assert.equal(byKey.Cool.bestScore, 2);
    assert.equal(byKey.Cool.trainedCount, 1);

    assert.deepEqual(
        audit.strengths.map((entry) => entry.key),
        ["Stealth"]
    );
    assert.deepEqual(
        audit.weaknesses.map((entry) => entry.key),
        ["Cool", "Deception"]
    );
    assert.deepEqual(
        audit.overlaps.map((entry) => entry.key),
        ["Deception", "Stealth"]
    );
    assert.equal(audit.summary.trained, 3);
    assert.equal(audit.summary.overlap, 2);
    assert.equal(audit.summary.gaps, 1);
});

test("custom skill types become their own section after the standard ones", () => {
    const audit = auditParty([
        sheet("a", "A", { Brawn: 2, Intellect: 2 }, {
            A: skill("Alpha", "Zebra", "Brawn", 1),
            B: skill("Bravo", "Alpha", "Brawn", 1),
            C: skill("Cool", "Social", "Intellect", 1),
            D: skill("Brawl", "Combat", "Brawn", 3),
            E: skill("Aaa", "Combat", "Brawn", 0),
        }),
    ]);

    assert.deepEqual(
        audit.sections.map((section) => section.type),
        ["Combat", "Social", "Alpha", "Zebra"]
    );
    const combat = audit.sections[0];
    assert.deepEqual(
        combat.skills.map((entry) => entry.label),
        ["Aaa", "Brawl"]
    );
    assert.deepEqual(
        combat.rows.map((entry) => entry.label),
        ["Brawl", "Aaa"]
    );
    assert.equal(combat.rows[0].bestScore, 5);
    assert.equal(combat.verdict, "mixed");
    assert.equal(audit.summary.strongest.type, "Combat");
    assert.equal(audit.summary.thinnest.type, "Alpha");
    assert.equal(audit.summary.even, false);
});

test("section verdicts name the strongest and thinnest sections", () => {
    const audit = auditParty([
        sheet("a", "A", { Agility: 4, Presence: 4, Brawn: 2 }, {
            Athletics: skill("Athletics", "General", "Agility", 2),
            Cool: skill("Cool", "General", "Presence", 0),
            Brawl: skill("Brawl", "Combat", "Brawn", 0),
        }),
    ]);
    const general = audit.sections.find((section) => section.type === "General");
    const combat = audit.sections.find((section) => section.type === "Combat");
    assert.equal(general.verdict, "strong");
    assert.equal(general.average, 5);
    assert.equal(combat.verdict, "thin");
    assert.equal(combat.average, 2);
    assert.equal(audit.summary.strongest.type, "General");
    assert.equal(audit.summary.thinnest.type, "Combat");
});

test("character profiles expose trained counts, top pools, and section facts", () => {
    const audit = auditParty([
        sheet("a", "Curlos Smur", { Brawn: 3, Agility: 4 }, {
            Athletics: skill("Athletics", "General", "Brawn", 2),
            Stealth: skill("Stealth", "General", "Agility", 2, true),
            Brawl: skill("Brawl", "Combat", "Brawn", 1),
        }),
        sheet("b", "Hoot Hoot", { Brawn: 1, Agility: 5 }, {
            Stealth: skill("Stealth", "General", "Agility", 3),
        }),
    ]);

    const curlos = audit.characters.find((character) => character.id === "a");
    assert.equal(curlos.trainedCount, 3);
    assert.equal(curlos.bestScore, 6);
    assert.deepEqual(
        curlos.top.map((entry) => entry.key),
        ["Stealth", "Athletics", "Brawl"]
    );
    assert.equal(curlos.top[0].rank, 2);
    assert.equal(curlos.top[0].proficiency, 2);
    assert.equal(curlos.top[0].ability, 4);
    assert.equal(curlos.top[0].score, 6);
    assert.deepEqual(
        curlos.characteristics.map((entry) => [entry.name, entry.value]),
        [
            ["Brawn", 3],
            ["Agility", 4],
        ]
    );

    const general = audit.sections.find((section) => section.type === "General");
    assert.equal(general.skillCount, 2);
    assert.equal(general.trainedCount, 2);
    assert.equal(general.overlapCount, 1);
    assert.equal(general.gapCount, 0);
});

test("chart labels drop the section prefix but keep the full skill label", () => {
    const audit = auditParty([
        sheet("a", "A", { Intellect: 3 }, {
            core: skill("Knowledge: Core Worlds", "Knowledge", "Intellect", 1),
        }),
    ]);
    const knowledge = audit.sections.find((section) => section.type === "Knowledge");
    assert.equal(knowledge.skills[0].label, "Knowledge: Core Worlds");
    assert.equal(knowledge.skills[0].chartLabel, "Core Worlds");
    assert.equal(knowledge.chart.spokes[0].label, "Core Worlds");
});

test("radar ring labels mark the major rings", () => {
    const audit = auditParty([
        sheet("a", "A", { Brawn: 6 }, {
            Athletics: skill("Athletics", "General", "Brawn", 5),
        }),
    ]);
    const rings = audit.sections[0].chart.rings;
    assert.deepEqual(
        rings.map((ring) => [ring.score, ring.major]),
        [
            [2, false],
            [4, true],
            [6, false],
            [8, true],
            [11, false],
        ]
    );
});

test("an empty party has no sections", () => {
    const audit = auditParty([]);
    assert.equal(audit.sections.length, 0);
    assert.equal(audit.summary.skillCount, 0);
    assert.equal(audit.summary.strongest, null);
    assert.equal(audit.summary.thinnest, null);
    assert.equal(audit.summary.even, false);
});

test("radar points sit on the correct spoke and scale", () => {
    assert.equal(radarPolygon([8, 8], 8, 100, 100, 50), "100,50 100,150");
    assert.equal(radarPolygon([8, 0], 8, 100, 100, 50), "100,50 100,100");

    const up = radarPoint(0, 4, 8, 8, 100, 100, 40);
    const right = radarPoint(1, 4, 8, 8, 100, 100, 40);
    const down = radarPoint(2, 4, 8, 8, 100, 100, 40);
    const left = radarPoint(3, 4, 8, 8, 100, 100, 40);
    assert.deepEqual(up, { x: 100, y: 60 });
    assert.deepEqual(right, { x: 140, y: 100 });
    assert.deepEqual(down, { x: 100, y: 140 });
    assert.deepEqual(left, { x: 60, y: 100 });

    const clamped = radarPoint(0, 4, 100, 8, 0, 0, 10);
    const rim = radarPoint(0, 4, 8, 8, 0, 0, 10);
    assert.deepEqual(clamped, rim);

    const audit = auditParty([
        sheet("a", "A", { Brawn: 3 }, {
            Athletics: skill("Athletics", "General", "Brawn", 1),
        }),
        sheet("b", "B", { Brawn: 6 }, {
            Athletics: skill("Athletics", "General", "Brawn", 5),
        }),
    ]);
    const chart = audit.sections[0].chart;
    assert.equal(chart.scale, 11);
    assert.deepEqual(
        chart.rings.map((ring) => ring.score),
        [2, 4, 6, 8, 11]
    );
    const low = chart.series[0].vertices[0];
    const expected = radarPoint(0, 1, 4, chart.scale, chart.cx, chart.cy, chart.radius);
    assert.equal(low.x, expected.x);
    assert.equal(low.y, expected.y);
    const best = chart.best.vertices[0];
    const bestExpected = radarPoint(0, 1, 11, chart.scale, chart.cx, chart.cy, chart.radius);
    assert.equal(best.x, bestExpected.x);
    assert.equal(best.y, bestExpected.y);
    assert.notEqual(chart.best.points, chart.series[0].points);
});
