import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import { DayProvider } from "./DayContext";
import { registerStaleDeploymentRecovery } from "../lib/recoverStaleDeployment";

registerStaleDeploymentRecovery();

const container = document.getElementById("root");

if (!container) {
    throw new Error("Root container not found");
}

const root = createRoot(container);
root.render(
    <React.StrictMode>
        <AuthProvider>
            <DayProvider>
                <App />
            </DayProvider>
        </AuthProvider>
    </React.StrictMode>,
);
