import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { display: string; code: string }>;
  placeholder?: string;
  className?: string;
  onSelect?: (option: string | { display: string; code: string }) => void;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  onSelect,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<
    Array<string | { display: string; code: string }>
  >([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && value.length > 1) {
      const lowerVal = value.toLowerCase();
      const matches = options.filter((opt) => {
        const label = typeof opt === "string" ? opt : opt.display;
        return label.toLowerCase().includes(lowerVal);
      });
      setFilteredOptions(matches.slice(0, 10)); // Limit to 10 suggestions
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

  const handleSelect = (opt: string | { display: string; code: string }) => {
    const label = typeof opt === "string" ? opt : opt.display;
    onChange(label);
    setShowSuggestions(false);
    if (onSelect) onSelect(opt);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (value) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        className={className}
        spellCheck={true} // Enable native spellcheck (red underline)
        lang="es"
      />
      {showSuggestions && filteredOptions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fadeIn">
          {filteredOptions.map((opt, idx) => {
            const label = typeof opt === "string" ? opt : opt.display;
            const code = typeof opt === "string" ? null : opt.code;
            return (
              <li
                key={idx}
                onClick={() => handleSelect(opt)}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 text-sm font-medium border-b border-slate-50 last:border-0 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3 h-3 text-slate-400" />
                  {label}
                </div>
                {code && <span className="text-[10px] text-slate-400 font-mono">SCT: {code}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
