export type LevelOption = {
    value: string
    label: string
}

export type LevelOptionGroup = {
    label: string
    options: LevelOption[]
}

export const levelOptionGroups: LevelOptionGroup[] = [
    {
        label: 'Little Splash',
        options: [
            { value: 'LittleSplash1', label: 'Little Splash 1' },
            { value: 'LittleSplash2', label: 'Little Splash 2' },
            { value: 'LittleSplash3', label: 'Little Splash 3' },
            { value: 'LittleSplash4', label: 'Little Splash 4' },
            { value: 'LittleSplash5', label: 'Little Splash 5' },
        ],
    },
    {
        label: 'Parent and Tot',
        options: [
            { value: 'ParentandTot1', label: 'Parent and Tot 1' },
            { value: 'ParentandTot2', label: 'Parent and Tot 2' },
            { value: 'ParentandTot3', label: 'Parent and Tot 3' },
        ],
    },
    {
        label: 'Splash',
        options: [
            { value: 'Splash1', label: 'Splash 1' },
            { value: 'Splash2A', label: 'Splash 2A' },
            { value: 'Splash2B', label: 'Splash 2B' },
            { value: 'Splash3', label: 'Splash 3' },
            { value: 'Splash4', label: 'Splash 4' },
            { value: 'Splash5', label: 'Splash 5' },
            { value: 'Splash6', label: 'Splash 6' },
            { value: 'Splash7', label: 'Splash 7' },
            { value: 'Splash8', label: 'Splash 8' },
            { value: 'Splash9', label: 'Splash 9' },
            { value: 'SplashFitness', label: 'Splash Fitness' },
        ],
    },
    {
        label: 'Teen/Adult',
        options: [
            { value: 'TeenAdult1', label: 'Teen/Adult 1' },
            { value: 'TeenAdult2', label: 'Teen/Adult 2' },
            { value: 'TeenAdult3', label: 'Teen/Adult 3' },
        ],
    },
]

export const selectClass =
    'w-full rounded-lg border-2 border-secondary bg-accent px-3 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-60'
export const inputClass = `${selectClass} placeholder:text-secondary/60`
export const rowWidthClass = 'w-full max-w-[900px] mx-auto'
