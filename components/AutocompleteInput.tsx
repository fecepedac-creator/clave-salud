import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    onSelect?: (value: string) => void;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ 
    value, onChange, options, placeholder, className, onSelect 
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value && value.length > 1) {
            const lowerVal = value.toLowerCase();
            const matches = options.filter(opt => opt.toLowerCase().includes(lowerVal));
            setFilteredOptions(matches.slice(0, 5)); // Limit to 5 suggestions
        } else {
            setFilteredOptions([]);
        }
    }, [value, options]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (opt: string) => {
        onChange(opt);
        setShowSuggestions(false);
        if (onSelect) onSelect(opt);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input 
                type="text"
                value={value}
                onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
                onFocus={() => { if(value) setShowSuggestions(true); }}
                placeholder={placeholder}
                className={className}
                spellCheck={true} // Enable native spellcheck (red underline)
                lang="es"
            />
            {showSuggestions && filteredOptions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fadeIn">
                    {filteredOptions.map((opt, idx) => (
                        <li 
                            key={idx}
                            onClick={() => handleSelect(opt)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 text-sm font-medium border-b border-slate-50 last:border-0 flex items-center gap-2"
                        >
                            <Search className="w-3 h-3 text-slate-400"/>
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AutocompleteInput;