/**
 * Party skill audit. No Foundry globals.
 *
 * A skill check rolls max(characteristic, rank) dice, and min(characteristic, rank)
 * of those are proficiency dice. Counting each yellow as two and each green as one
 * equals characteristic + rank, which is the chart length.
 */

export const CHARACTER_COLORS = [
    "#6cb6ff",
    "#ff7b7b",
    "#6ddeb0",
    "#f0c14d",
    "#d7a3f5",
    "#ff9b6a",
    "#8fd3e8",
    "#e7f08a",
];

/* Deeper, saturated marks so lines and dots stay legible on parchment. */
export const CHARACTER_COLORS_LIGHT = [
    "#a82020",
    "#2f6f9f",
    "#2f6f3a",
    "#8a5a12",
    "#6b3fa0",
    "#b45309",
    "#0f6b6b",
    "#5f6b1a",
];

/** @param {"light"|"dark"} theme */
export function characterPalette(theme) {
    return theme === "light" ? CHARACTER_COLORS_LIGHT : CHARACTER_COLORS;
}

const SECTION_ORDER = ["general", "combat", "knowledge", "social"];
const CHART = { size: 520, cx: 260, cy: 260, radius: 168, labelRadius: 206 };
const STRONG_SCORE = 6;
const WEAK_SCORE = 3;
const STRONG_SECTION = 5;
const THIN_SECTION = 3;

function asNonNegative(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return number;
}

function round(value) {
    const rounded = Math.round(value * 100) / 100;
    return rounded === 0 ? 0 : rounded;
}

function sameAverage(left, right) {
    return Math.round(left * 100000) === Math.round(right * 100000);
}

export function skillScore(characteristic, rank) {
    const characteristicValue = asNonNegative(characteristic);
    const rankValue = asNonNegative(rank);
    const ability = Math.max(characteristicValue, rankValue);
    const proficiency = Math.min(characteristicValue, rankValue);
    return {
        characteristic: characteristicValue,
        rank: rankValue,
        ability,
        proficiency,
        score: characteristicValue + rankValue,
    };
}

export function radarPoint(index, count, value, scale, cx, cy, radius) {
    const safeCount = count > 0 ? count : 1;
    const safeScale = scale > 0 ? scale : 1;
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / safeCount;
    const clamped = Math.max(0, Math.min(asNonNegative(value), safeScale));
    const length = (clamped / safeScale) * radius;
    return {
        x: round(cx + Math.cos(angle) * length),
        y: round(cy + Math.sin(angle) * length),
    };
}

export function radarPolygon(values, scale, cx, cy, radius) {
    return values
        .map((value, index) => {
            const point = radarPoint(index, values.length, value, scale, cx, cy, radius);
            return `${point.x},${point.y}`;
        })
        .join(" ");
}

function definedSkill(character, key) {
    const skill = character.skills?.[key];
    if (!skill || typeof skill !== "object") return null;
    return skill;
}

function fallbackSkill(party, key) {
    for (const character of party) {
        const skill = definedSkill(character, key);
        if (skill) return skill;
    }
    return null;
}

function characteristicValue(character, name) {
    if (!name) return 0;
    return asNonNegative(character.characteristics?.[name]);
}

function skillKeys(party) {
    const keys = new Set();
    for (const character of party) {
        for (const key of Object.keys(character.skills ?? {})) {
            if (definedSkill(character, key)) keys.add(key);
        }
    }
    return [...keys];
}

function sectionRank(type) {
    const index = SECTION_ORDER.indexOf(String(type).toLowerCase());
    return index === -1 ? SECTION_ORDER.length : index;
}

function chartScale(scores) {
    const highest = scores.reduce((max, score) => Math.max(max, score), 0);
    return Math.max(8, Math.ceil(highest));
}

function ringScores(scale) {
    const rings = [2, 4, 6, 8];
    if (scale > 8) rings.push(scale);
    return rings
        .filter((score, index) => score <= scale && rings.indexOf(score) === index)
        .map((score) => ({ score, major: score % 4 === 0 }));
}

function labelAnchor(x, cx) {
    if (x < cx - 4) return "end";
    if (x > cx + 4) return "start";
    return "middle";
}

function buildChart(skills, party) {
    const scores = [];
    for (const skill of skills) {
        for (const cell of skill.cells) scores.push(cell.score);
        scores.push(skill.bestScore);
    }
    const scale = chartScale(scores);
    const count = skills.length;
    const { size, cx, cy, radius, labelRadius } = CHART;
    const spokes = skills.map((skill, index) => {
        const rim = radarPoint(index, count, scale, scale, cx, cy, radius);
        const label = radarPoint(index, count, scale, scale, cx, cy, labelRadius);
        return {
            x1: cx,
            y1: cy,
            x2: rim.x,
            y2: rim.y,
            label: skill.chartLabel,
            labelX: label.x,
            labelY: label.y,
            anchor: labelAnchor(label.x, cx),
            fontSize: count > 14 ? 9 : 12,
        };
    });
    const series = party.map((character, characterIndex) => {
        const values = skills.map((skill) => skill.cells[characterIndex].score);
        return {
            id: character.id,
            name: character.name,
            color: character.color,
            points: radarPolygon(values, scale, cx, cy, radius),
            vertices: skills.map((skill, index) => {
                const cell = skill.cells[characterIndex];
                const point = radarPoint(index, count, cell.score, scale, cx, cy, radius);
                return {
                    x: point.x,
                    y: point.y,
                    detail: {
                        characterName: character.name,
                        skillLabel: skill.label,
                        rank: cell.rank,
                        characteristicName: cell.characteristicName,
                        characteristicValue: cell.characteristic,
                        proficiency: cell.proficiency,
                        ability: cell.ability,
                    },
                };
            }),
        };
    });
    const bestValues = skills.map((skill) => skill.bestScore);
    return {
        viewBox: `0 0 ${size} ${size}`,
        cx,
        cy,
        radius,
        scale,
        dense: count > 14,
        rings: ringScores(scale).map((ring) => {
            const values = Array(count).fill(ring.score);
            const marker = radarPoint(0, count, ring.score, scale, cx, cy, radius);
            return {
                score: ring.score,
                major: ring.major,
                points: radarPolygon(values, scale, cx, cy, radius),
                labelX: marker.x + 6,
                labelY: marker.y,
                showLabel: ring.score < scale,
            };
        }),
        spokes,
        series,
        best: {
            points: radarPolygon(bestValues, scale, cx, cy, radius),
            vertices: skills.map((skill, index) => {
                const point = radarPoint(index, count, skill.bestScore, scale, cx, cy, radius);
                return {
                    x: point.x,
                    y: point.y,
                    detail: {
                        skillLabel: skill.label,
                        holders: skill.holders.map((holder) => ({
                            name: holder.name,
                            rank: holder.rank,
                            characteristicName: holder.characteristicName,
                            characteristicValue: holder.characteristic,
                            proficiency: holder.proficiency,
                            ability: holder.ability,
                        })),
                    },
                };
            }),
        },
    };
}

function compareSkills(left, right) {
    return left.label.localeCompare(right.label) || left.key.localeCompare(right.key);
}

function buildSkill(party, key) {
    const fallback = fallbackSkill(party, key);
    const label = fallback?.label || key;
    const type = fallback?.type || "General";
    const chartLabel = label.startsWith(`${type}: `) ? label.slice(type.length + 2) : label;
    const cells = party.map((character) => {
        const skill = definedSkill(character, key);
        const characteristicName = skill?.characteristic || fallback?.characteristic || "";
        const scored = skillScore(characteristicValue(character, characteristicName), skill ? skill.rank : 0);
        return {
            id: character.id,
            name: character.name,
            characteristicName,
            career: Boolean(skill?.career),
            trained: scored.rank >= 1,
            ...scored,
        };
    });
    const names = [...new Set(cells.map((cell) => cell.characteristicName).filter(Boolean))];
    const bestScore = cells.reduce((max, cell) => Math.max(max, cell.score), 0);
    const holders = cells.filter((cell) => cell.score === bestScore);
    const trained = cells
        .filter((cell) => cell.trained)
        .map((cell) => ({
            id: cell.id,
            name: cell.name,
            rank: cell.rank,
            score: cell.score,
            proficiency: cell.proficiency,
            ability: cell.ability,
            career: cell.career,
        }));
    const trainedCount = trained.length;
    let tag = "overlap";
    if (trainedCount === 0) tag = "gap";
    else if (trainedCount === 1) tag = "specialist";
    return {
        key,
        label,
        chartLabel,
        type,
        characteristic: names.length === 1 ? names[0] : "",
        mixedCharacteristic: names.length > 1,
        bestScore,
        holders,
        trainedCount,
        trained,
        gap: trainedCount === 0,
        overlap: trainedCount >= 2,
        specialist: trainedCount === 1,
        strength: bestScore >= STRONG_SCORE,
        weakness: bestScore <= WEAK_SCORE,
        tag,
        cells,
    };
}

function sectionVerdict(average) {
    if (average >= STRONG_SECTION) return "strong";
    if (average <= THIN_SECTION) return "thin";
    return "mixed";
}

function byBestScore(left, right) {
    return right.bestScore - left.bestScore || compareSkills(left, right);
}

export function auditParty(characters) {
    const party = (Array.isArray(characters) ? characters : []).map((character, index) => ({
        id: String(character?.id ?? index),
        name: character?.name ? String(character.name) : "",
        img: character?.img ? String(character.img) : "",
        players: character?.players ? String(character.players) : "",
        color: character?.color || CHARACTER_COLORS[index % CHARACTER_COLORS.length],
        characteristics: character?.characteristics ?? {},
        skills: character?.skills ?? {},
    }));
    const skills = skillKeys(party)
        .map((key) => buildSkill(party, key))
        .sort(compareSkills);
    const grouped = new Map();
    for (const skill of skills) {
        if (!grouped.has(skill.type)) grouped.set(skill.type, []);
        grouped.get(skill.type).push(skill);
    }
    const sections = [...grouped.entries()]
        .map(([type, sectionSkills]) => {
            const ordered = [...sectionSkills].sort(compareSkills);
            const average =
                ordered.reduce((total, skill) => total + skill.bestScore, 0) / ordered.length;
            return {
                type,
                average,
                verdict: sectionVerdict(average),
                skillCount: ordered.length,
                trainedCount: ordered.filter((skill) => skill.trainedCount > 0).length,
                gapCount: ordered.filter((skill) => skill.gap).length,
                overlapCount: ordered.filter((skill) => skill.overlap).length,
                skills: ordered,
                rows: [...ordered].sort(byBestScore),
                chart: buildChart(ordered, party),
            };
        })
        .sort((left, right) => sectionRank(left.type) - sectionRank(right.type) || left.type.localeCompare(right.type));

    const characterProfiles = party.map((character, index) => {
        const trained = [];
        for (const skill of skills) {
            const cell = skill.cells[index];
            if (!cell.trained) continue;
            trained.push({
                key: skill.key,
                label: skill.label,
                chartLabel: skill.chartLabel,
                type: skill.type,
                rank: cell.rank,
                characteristicName: cell.characteristicName,
                characteristic: cell.characteristic,
                proficiency: cell.proficiency,
                ability: cell.ability,
                score: cell.score,
                career: cell.career,
            });
        }
        trained.sort(
            (left, right) =>
                right.score - left.score ||
                right.rank - left.rank ||
                left.label.localeCompare(right.label)
        );
        return {
            id: character.id,
            name: character.name,
            img: character.img,
            players: character.players,
            color: character.color,
            trainedCount: trained.length,
            bestScore: trained[0]?.score ?? 0,
            top: trained.slice(0, 4),
            characteristics: Object.entries(character.characteristics).map(([name, value]) => ({
                name,
                value,
            })),
        };
    });

    const strengths = skills.filter((skill) => skill.strength).sort(byBestScore);
    const weaknesses = skills
        .filter((skill) => skill.weakness)
        .sort((left, right) => left.bestScore - right.bestScore || compareSkills(left, right));
    const overlaps = skills.filter((skill) => skill.overlap).sort(compareSkills);
    const strongest = pickExtreme(sections, -1);
    const thinnest = pickExtreme(sections, 1);
    const even =
        sections.length > 1 && strongest && thinnest && sameAverage(strongest.average, thinnest.average);

    return {
        characters: characterProfiles,
        summary: {
            skillCount: skills.length,
            trained: skills.filter((skill) => skill.trainedCount > 0).length,
            overlap: overlaps.length,
            gaps: skills.filter((skill) => skill.gap).length,
            sectionCount: sections.length,
            strongest: extremeSummary(strongest),
            thinnest: extremeSummary(thinnest),
            even,
        },
        sections,
        strengths,
        weaknesses,
        overlaps,
    };
}

function extremeSummary(section) {
    if (!section) return null;
    return { type: section.type, average: section.average };
}

function pickExtreme(sections, direction) {
    if (sections.length === 0) return null;
    return [...sections].sort((left, right) => {
        const diff = direction * (left.average - right.average);
        if (!sameAverage(left.average, right.average) && diff !== 0) return diff;
        return left.type.localeCompare(right.type);
    })[0];
}
