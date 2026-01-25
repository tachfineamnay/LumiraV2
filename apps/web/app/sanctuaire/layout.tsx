import React from "react";
import SanctuaireLayoutClient from "./SanctuaireLayoutClient";

// Forces the entire route segment to be dynamic, skipping static generation.
// This is critical because the dashboard relies on authentication and URL parameters (useSearchParams)
// which cause build failures if statically rendered.
export const dynamic = 'force-dynamic';

export default function SanctuaireLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SanctuaireLayoutClient>
            {children}
        </SanctuaireLayoutClient>
    );
}
