import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export interface HistoryPoint {
    date: string;
    fullDate: string;
    value: number;
}

interface MiniTrendChartProps {
    data: HistoryPoint[];
    unit?: string;
    label: string;
}

export const MiniTrendChart: React.FC<MiniTrendChartProps> = ({
    data,
    unit,
    label,
}) => {
    if (!data || data.length === 0)
        return <p className="text-xs text-slate-400 italic p-2">Sin historial suficiente.</p>;

    // Sort data just in case
    const sortedData = [...data].sort(
        (a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
    ); // Oldest first
    const lastPoint = sortedData[sortedData.length - 1];
    const prevPoint = sortedData.length > 1 ? sortedData[sortedData.length - 2] : null;

    // Trend Logic
    let trend = "stable";
    if (prevPoint) {
        if (lastPoint.value > prevPoint.value) trend = "up";
        else if (lastPoint.value < prevPoint.value) trend = "down";
    }

    // Scaling Logic
    const values = sortedData.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    let range = maxVal - minVal;
    if (range === 0) range = maxVal * 0.1 || 1;

    // 20% Padding
    const yMin = minVal - range * 0.2;
    const yMax = maxVal + range * 0.2;
    const yRange = yMax - yMin;

    const width = 240;
    const height = 80;

    const points = sortedData.map((p, i) => {
        const x = (i / (sortedData.length - 1 || 1)) * width;
        const y = height - ((p.value - yMin) / yRange) * height;
        return { x, y, value: p.value, date: p.date };
    });

    const pathData =
        points.length > 1 ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") : "";

    return (
        <div className="w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-sm animate-fadeIn z-50">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-700 text-xs uppercase">{label}</span>
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                    <span className="font-bold text-slate-800 text-xs">
                        {lastPoint.value} {unit}
                    </span>
                    {trend === "up" && <ArrowUp className="w-3 h-3 text-red-400" />}
                    {trend === "down" && <ArrowDown className="w-3 h-3 text-green-400" />}
                    {trend === "stable" && <Minus className="w-3 h-3 text-slate-300" />}
                </div>
            </div>

            <div className="relative h-[80px] w-full bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden mb-2">
                <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${width} ${height}`}
                    className="overflow-visible"
                    preserveAspectRatio="none"
                >
                    {/* Grid Line */}
                    <line
                        x1="0"
                        y1={height / 2}
                        x2={width}
                        y2={height / 2}
                        stroke="#e2e8f0"
                        strokeDasharray="4"
                        strokeWidth="1"
                    />
                    {/* Path */}
                    {points.length > 1 && (
                        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
                    )}
                    {/* Dots */}
                    {points.map((p, idx) => (
                        <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="3" fill="white" stroke="#2563eb" strokeWidth="2" />
                            {/* Label Last Point */}
                            {idx === points.length - 1 && (
                                <text
                                    x={p.x}
                                    y={p.y - 6}
                                    fontSize="9"
                                    fill="#2563eb"
                                    textAnchor="middle"
                                    fontWeight="bold"
                                >
                                    {p.value}
                                </text>
                            )}
                        </g>
                    ))}
                </svg>
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Min: {minVal}</span>
                <span>Max: {maxVal}</span>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-1">
                Última medición: {sortedData[sortedData.length - 1].date}
            </p>
        </div>
    );
};
