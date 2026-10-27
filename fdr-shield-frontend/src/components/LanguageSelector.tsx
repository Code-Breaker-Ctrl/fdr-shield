import React, { useState, useRef, useEffect } from "react";
import { Languages, ChevronDown, Check } from "lucide-react";
import { useLanguage, type SupportedLanguage } from "@/contexts/LanguageContext";

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-all"
        style={{
          background: "#1e293b",
          borderColor: "#334155",
          color: "#f1f5f9",
          letterSpacing: "0.3px",
        }}
        title="Change portal language (Digital India Bhashini)"
        aria-label="Select language"
      >
        <Languages size={15} className="text-sky-400" />
        <span className="font-medium">{currentLang.nativeName}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-48 rounded-lg shadow-2xl py-1 z-50 border focus:outline-none"
          style={{
            background: "#0f172a",
            borderColor: "#334155",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1">
            <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              BHASHINI LANGUAGE SUITE
            </div>
            <div className="text-[10px] text-slate-400">7 Scheduled Official Languages</div>
          </div>

          {languages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  isSelected ? "bg-sky-950/60 text-sky-300 font-semibold" : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{l.flag}</span>
                  <div>
                    <span className="font-medium">{l.nativeName}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({l.name})</span>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-sky-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
