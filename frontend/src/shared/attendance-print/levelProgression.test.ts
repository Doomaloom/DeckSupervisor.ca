import { describe, expect, it } from 'vitest';
import curriculum from '../../features/results/curriculum.json';
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from './templateRegistry';
import { levelCode, levelComplete, levelResult, NEXT_LEVEL } from './levelProgression';

const skillsOf = (level: string) => Object.keys(curriculum.skills as Record<string, string>).filter(id => id.startsWith(`${level}:`));
const all = (level: string, n = 3) => Object.fromEntries(skillsOf(level).map(id => [id, n]));

describe('level progression', () => {
    it('writes register codes as LS, S, SA and PT plus the level number', () => {
        expect(['LittleSplash3', 'Splash1', 'Splash2A', 'Splash2B', 'Splash9', 'TeenAdult2', 'ParentandTot1', 'SplashFitness', 'BronzeStar'].map(levelCode))
            .toEqual(['LS3', 'S1', 'S2A', 'S2B', 'S9', 'SA2', 'PT1', 'SF', 'BS']);
    });
    it('has a next level for every curriculum level with a sheet', () => {
        const levels = [...new Set(Object.keys(curriculum.skills as Record<string, string>).map(id => id.split(':')[0]))];
        expect(levels.length).toBeGreaterThan(20);
        for (const level of levels) {
            expect(LEGACY_ATTENDANCE_TEMPLATE_KEYS, level).toContain(level);
            expect(() => levelCode(NEXT_LEVEL[level]), level).not.toThrow();
        }
    });
    it('is complete only when every skill of the level has three successful attempts', () => {
        expect(levelComplete('Splash1', all('Splash1'))).toBe(true);
        expect(levelComplete('Splash1', all('Splash1', 9))).toBe(true);
        const short = all('Splash1'); short[skillsOf('Splash1')[0]] = 2;
        expect(levelComplete('Splash1', short)).toBe(false);
        const missing = all('Splash1'); delete missing[skillsOf('Splash1').at(-1)!];
        expect(levelComplete('Splash1', missing)).toBe(false);
        expect(levelComplete('Splash1', {})).toBe(false);
        expect(levelComplete('Unknown', {})).toBe(false);
    });
    it('marks C and the next level when complete, I and the same level otherwise', () => {
        expect(levelResult('Splash2A', all('Splash2A'))).toEqual({ complete: true, result: 'C', registerIn: 'S2B' });
        expect(levelResult('Splash2A', {})).toEqual({ complete: false, result: 'I', registerIn: 'S2A' });
        expect(levelResult('LittleSplash5', all('LittleSplash5')).registerIn).toBe('S2B');
        expect(levelResult('TeenAdult1', all('TeenAdult1')).registerIn).toBe('SA2');
        expect(levelResult('ParentandTot3', all('ParentandTot3')).registerIn).toBe('LS1');
        expect(levelResult('Splash9', all('Splash9')).registerIn).toBe('BS');
        expect(levelResult('ParentandTot2', {}).registerIn).toBe('PT2');
    });
});
