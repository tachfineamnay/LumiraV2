"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import to avoid SSR issues with localStorage
const MissionControlDashboard = dynamic(
    () => import("../../components/admin/MissionControl"),
    {
        ssr: false,
        loading: () => (
            <div className="h-[calc(100vh-120px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Chargement du Mission Control...</p>
                </div>
            </div>
        ),
    }
);

export default function AdminDashboard() {
    return <MissionControlDashboard />;
}
