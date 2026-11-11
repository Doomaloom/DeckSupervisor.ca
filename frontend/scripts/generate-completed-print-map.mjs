import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('../rec-tablet/src/workflows/swimming/curriculum/catalog.json', root), 'utf8'));
const clean = value => value.replace(/\s+/g, ' ').trim();
const levels = {};
for (const level of catalog.levels) {
    const html = await readFile(new URL(`frontend/src/shared/attendance-print/templates/${level.id}.html`, root), 'utf8');
    const document = new JSDOM(html).window.document;
    const cells = [...document.querySelector('#student-rows').children];
    const numbered = cells.map((cell, cellIndex) => ({ cellIndex, heading: clean(cell.textContent) })).filter(cell => /^\d+[a-z]?\s*\./i.test(cell.heading));
    if (numbered.length !== level.skills.length) throw new Error(`${level.id}: template/catalog column mismatch`);
    levels[level.id] = numbered.map((cell, index) => {
        const skill = level.skills[index];
        if (clean(`${skill.number}. ${skill.name}`).replace(/\s/g, '') !== cell.heading.replace(/\s/g, '')) throw new Error(`${level.id}: mismatched column ${cell.heading}`);
        return { ...cell, skillIds: [skill.id], aggregation: 'all' };
    });
}
await writeFile(new URL('frontend/src/shared/attendance-print/completedPrintMap.json', root), JSON.stringify({ curriculumVersion: catalog.version, levels }, null, 2) + '\n');
