/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    /** Optional override for where tutorial videos stream from (defaults to the public tutorial-videos bucket). */
    readonly VITE_TUTORIAL_VIDEOS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
