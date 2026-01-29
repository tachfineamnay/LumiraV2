"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Admin root page - redirects to Desk v2 Dashboard
 */
export default function AdminDashboard() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/board");
    }, [router]);

    return (
        <div className="h-[calc(100vh-120px)] flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Redirection vers le Desk...</p>
            </div>
        </div>
    );
}
