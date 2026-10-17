// A tab left open across deployments can reference lazy chunks that no longer
// exist. Load the current entry point once instead of retrying the missing URL.
export function registerStaleDeploymentRecovery() {
    const recoveryKey = `deployment-recovery:${import.meta.url}`;

    window.addEventListener("vite:preloadError", (event) => {
        try {
            // Keep the marker for this bundle so a persistent loading failure
            // still reaches the normal error UI instead of causing a reload loop.
            if (window.sessionStorage.getItem(recoveryKey)) return;
            window.sessionStorage.setItem(recoveryKey, "1");
        } catch {
            // Without storage, we cannot safely guard against repeated reloads.
            return;
        }

        event.preventDefault();
        window.location.reload();
    });
}
