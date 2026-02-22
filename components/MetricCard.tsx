import React from "react";
import * as LucideIcons from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: keyof typeof LucideIcons;
    colorClass?: string;
    trend?: {
        value: string | number;
        isUp: boolean;
    };
    loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    icon,
    colorClass = "text-indigo-400",
    trend,
    loading = false,
}) => {
    const IconComponent = LucideIcons[icon] as React.ElementType;

    if (loading) {
        return (
            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 animate-pulse">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl" />
                    <div className="w-16 h-4 bg-slate-700 rounded" />
                </div>
                <div className="w-24 h-8 bg-slate-700 rounded mb-2" />
                <div className="w-32 h-3 bg-slate-700 rounded" />
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-health-400/50 transition-all group hover:shadow-premium-glow transform hover:-translate-y-1 duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-slate-900/50 ${colorClass}`}>
                    <IconComponent className="w-6 h-6" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend.isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>
                        {trend.isUp ? <LucideIcons.TrendingUp className="w-3 h-3" /> : <LucideIcons.TrendingDown className="w-3 h-3" />}
                        {trend.value}
                    </div>
                )}
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
            </div>
        </div>
    );
};

export default MetricCard;
