import { cn } from "@/lib/utils";
import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, hoverEffect = false, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 transition-all duration-500",
                    hoverEffect && "hover:border-gold/30 hover:shadow-gold-glow/20 hover:-translate-y-1",
                    className
                )}
                {...props}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10">{children}</div>
            </div>
        );
    }
);

GlassCard.displayName = "GlassCard";
