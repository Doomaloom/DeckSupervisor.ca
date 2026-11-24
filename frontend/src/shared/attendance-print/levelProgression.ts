import curriculum from '../../features/results/curriculum.json';

/**
 * The level a swimmer registers in after completing a level, following the "Recommended Next Level" boxes on the
 * Lifesaving Society progress reports (Little Splash 5 goes on to Splash 2B; Splash 9 to Bronze Star; Teen/Adult 3
 * to Splash Fitness). Parent and Tot 3 continues to Little Splash 1.
 */
export const NEXT_LEVEL: Record<string, string> = {
    ParentandTot1: 'ParentandTot2', ParentandTot2: 'ParentandTot3', ParentandTot3: 'LittleSplash1',
    LittleSplash1: 'LittleSplash2', LittleSplash2: 'LittleSplash3', LittleSplash3: 'LittleSplash4', LittleSplash4: 'LittleSplash5', LittleSplash5: 'Splash2B',
    Splash1: 'Splash2A', Splash2A: 'Splash2B', Splash2B: 'Splash3', Splash3: 'Splash4', Splash4: 'Splash5', Splash5: 'Splash6',
    Splash6: 'Splash7', Splash7: 'Splash8', Splash8: 'Splash9', Splash9: 'BronzeStar',
    TeenAdult1: 'TeenAdult2', TeenAdult2: 'TeenAdult3', TeenAdult3: 'SplashFitness',
    SplashFitness: 'SplashFitness',
};

/** Short register code written on the sheet: LS3 Little Splash, S2A Splash, SA2 Teen/Adult, PT1 Parent and Tot. */
export function levelCode(level: string): string {
    if (level === 'SplashFitness') return 'SF';
    if (level === 'BronzeStar') return 'BS';
    const match = /^(LittleSplash|ParentandTot|TeenAdult|Splash)(\w+)$/.exec(level);
    if (!match) throw new Error(`No register code for level ${level}.`);
    return ({ LittleSplash: 'LS', ParentandTot: 'PT', TeenAdult: 'SA', Splash: 'S' } as Record<string, string>)[match[1]] + match[2].toUpperCase();
}

const skillIds = Object.keys(curriculum.skills as Record<string, string>);
/** Complete means every curriculum skill of the level has at least three successful attempts. */
export function levelComplete(level: string, successfulAttempts: Record<string, number>): boolean {
    const skills = skillIds.filter(id => id.startsWith(`${level}:`));
    return skills.length > 0 && skills.every(id => (successfulAttempts[id] ?? 0) >= 3);
}

export type LevelResult = { complete: boolean; result: 'C' | 'I'; registerIn: string };
/** C and the next level's code when complete; otherwise I and the same level again. */
export function levelResult(level: string, successfulAttempts: Record<string, number>): LevelResult {
    const complete = levelComplete(level, successfulAttempts);
    const next = complete ? NEXT_LEVEL[level] : level;
    if (!next) throw new Error(`No next level is set for ${level}.`);
    return { complete, result: complete ? 'C' : 'I', registerIn: levelCode(next) };
}
