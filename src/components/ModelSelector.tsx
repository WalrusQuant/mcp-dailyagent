"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Model } from "@/lib/models";

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  variant?: "default" | "pill";
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  variant = "default",
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentModel = models.find((m) => m.id === selectedModel);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = () => setIsOpen((prev) => !prev);
    window.addEventListener("toggle-model-selector", handler);
    return () => window.removeEventListener("toggle-model-selector", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(models.findIndex((m) => m.id === selectedModel));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, models.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0) {
          onModelChange(models[highlightIndex].id);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const isPill = variant === "pill";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-1.5 transition-colors ${
          isPill
            ? "px-3 py-1.5 rounded-full text-sm font-medium"
            : "px-3 py-2 rounded-lg text-sm"
        }`}
        style={{
          background: isPill ? "var(--bg-elevated)" : "transparent",
          color: isPill ? "var(--text-muted)" : "var(--text-primary)",
          border: isPill ? "none" : "1px solid var(--border-default)",
        }}
      >
        <span>{isPill ? "Model" : (currentModel?.name || "Select model")}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl shadow-lg z-50 py-1 overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          {models.map((model, index) => (
            <button
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 transition-colors flex items-start gap-3"
              style={{
                background:
                  highlightIndex === index
                    ? "var(--bg-hover)"
                    : undefined,
              }}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {model.name}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {model.provider}
                  </span>
                </div>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {model.description}
                </p>
              </div>
              {model.id === selectedModel && (
                <Check
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: "var(--accent-primary)" }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
