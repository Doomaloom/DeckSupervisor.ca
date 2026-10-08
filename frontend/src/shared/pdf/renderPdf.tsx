import { pdf } from "@react-pdf/renderer";
import React from "react";
import { registerPdfFonts } from "./pdfFonts";
import type { PdfArtifact } from "./types";

export async function renderPdfArtifact(
    document: React.ReactElement,
    details: Omit<PdfArtifact, "blob">,
): Promise<PdfArtifact> {
    registerPdfFonts();
    const blob = await pdf(document).toBlob();
    return { ...details, blob };
}
