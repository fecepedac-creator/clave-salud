
import React from 'react';
import { Consultation, ExamDefinition } from '../types';
import { TRACKED_EXAMS_OPTIONS } from '../constants';
import { ArrowUp, ArrowDown, Minus, Activity, Droplets, Wind, Zap } from 'lucide-react';

interface BioMarkersProps {
    activeExams: string[];
    consultations: Consultation[];
    examOptions?: ExamDefinition[]; // NEW PROP
}

const BioMarkers: React.FC<BioMarkersProps> = ({ activeExams, consultations, examOptions = [] }) => {
    if (!activeExams || activeExams.length === 0) return null;

    // SAFE ACCESS: Ensure consultations is an array
    const history = (consultations || [])
        .filter(c => c.exams)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest to newest

    // Use passed options if available, fallback to constants (though DoctorDashboard should pass merged)
    // If examOptions is empty but constants exist, merge manually just in case, but rely on parent.
    const effectiveOptions = examOptions.length > 0 ? examOptions : TRACKED_EXAMS_OPTIONS;

    return (
        <div className="flex flex-wrap gap-3 items-center mt-2 px-1">
            {activeExams.map(examId => {
                const config = effectiveOptions.find(e => e.id === examId);
                if (!config) return null;

                // Extract history for this specific exam
                const dataPoints = history
                    .map(c => ({
                        date: new Date(c.date).toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit'}),
                        fullDate: new Date(c.date).toLocaleDateString(),
                        value: parseFloat(c.exams?.[examId] || '0')
                    }))
                    .filter(p => !isNaN(p.value) && p.value > 0);

                if (dataPoints.length === 0) return null; // Don't show if no data

                const lastPoint = dataPoints[dataPoints.length - 1];
                const prevPoint = dataPoints.length > 1 ? dataPoints[dataPoints.length - 2] : null;
                
                let trend = 'stable';
                if (prevPoint) {
                    if (lastPoint.value > prevPoint.value) trend = 'up';
                    else if (lastPoint.value < prevPoint.value) trend = 'down';
                }

                // Determine Icon based on category
                let Icon = Activity;
                if (config.category === 'Renal' || config.category === 'Metabólico') Icon = Droplets;
                if (config.category === 'Respiratorio') Icon = Wind;
                if (config.category === 'Tiroides') Icon = Zap;

                // --- CHART SCALING LOGIC ---
                const values = dataPoints.map(p => p.value);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                
                // Add 10% padding to range for aesthetics, handle flat line case
                let range = maxVal - minVal;
                if (range === 0) range = maxVal * 0.1 || 1; // Prevent divide by zero
                const yMin = minVal - (range * 0.2); // 20% bottom padding
                const yMax = maxVal + (range * 0.2); // 20% top padding
                const yRange = yMax - yMin;

                const width = 240;
                const height = 80;

                // Generate Path Data
                const points = dataPoints.map((p, i) => {
                    const x = (i / (dataPoints.length - 1 || 1)) * width; // Handle single point case
                    const y = height - ((p.value - yMin) / yRange) * height;
                    return { x, y, value: p.value, date: p.date };
                });

                const pathData = points.length > 1 
                    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    : '';

                return (
                    <div key={examId} className="relative group z-20">
                        {/* CHIP TRIGGER */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-3 py-1 text-sm font-bold text-slate-700 cursor-help hover:border-blue-400 hover:text-blue-600 transition-colors">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs uppercase tracking-wider text-slate-500">{config.label.split('(')[0]}</span>
                            <span className="text-slate-900">{lastPoint.value} {config.unit}</span>
                            {trend === 'up' && <ArrowUp className="w-3 h-3 text-red-400" />}
                            {trend === 'down' && <ArrowDown className="w-3 h-3 text-green-400" />}
                            {trend === 'stable' && <Minus className="w-3 h-3 text-slate-300" />}
                        </div>

                        {/* POPOVER CHART */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[280px] bg-white border border-slate-200 shadow-xl rounded-xl p-4 hidden group-hover:block animate-fadeIn pointer-events-none z-50">
                            <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                                {config.label}
                                <span className="text-blue-600 bg-blue-50 px-1.5 rounded text-[10px]">Histórico</span>
                            </h5>
                            
                            <div className="relative h-[100px] w-full bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden">
                                {/* SVG Chart */}
                                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="none">
                                    {/* Grid Lines (Optional background) */}
                                    <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#e2e8f0" strokeDasharray="4" strokeWidth="1" />
                                    
                                    {/* Connection Line */}
                                    {points.length > 1 && (
                                        <path 
                                            d={pathData} 
                                            fill="none" 
                                            stroke="#3b82f6" 
                                            strokeWidth="2" 
                                            strokeDasharray="4 2" // Dashed line style
                                        />
                                    )}

                                    {/* Data Points */}
                                    {points.map((p, idx) => (
                                        <g key={idx}>
                                            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#2563eb" strokeWidth="2" />
                                            {/* Value Label above dot */}
                                            <text 
                                                x={p.x} 
                                                y={p.y - 8} 
                                                fontSize="10" 
                                                fill="#64748b" 
                                                textAnchor="middle" 
                                                fontWeight="bold"
                                            >
                                                {p.value}
                                            </text>
                                            {/* Date Label below dot (only first and last to avoid clutter, or all if few) */}
                                            {(points.length <= 4 || idx === 0 || idx === points.length - 1) && (
                                                <text 
                                                    x={p.x} 
                                                    y={height + 12} 
                                                    fontSize="8" 
                                                    fill="#94a3b8" 
                                                    textAnchor="middle"
                                                >
                                                    {p.date}
                                                </text>
                                            )}
                                        </g>
                                    ))}
                                </svg>
                            </div>
                            
                            {/* Footer Legend */}
                            <div className="flex justify-between mt-3 text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-50">
                                <span>Min: {minVal}</span>
                                <span>Max: {maxVal}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default BioMarkers;
