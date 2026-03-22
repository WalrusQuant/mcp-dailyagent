"use client";

import { useState, useEffect } from "react";
import NextImage from "next/image";
import { Loader2, Download, Send, Image as ImageIcon, Trash2 } from "lucide-react";
import { GeneratedImage } from "@/types/database";
import { useModels } from "@/lib/useModels";
import { ModelSelector } from "./ModelSelector";

export function ImageGenerator() {
  const { imageModels, defaultImageModel } = useModels();
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultImageModel);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const response = await fetch("/api/images");
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (err) {
      console.error("Failed to load images:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      if (data.data && data.data[0]) {
        const imageUrl = data.data[0].url;

        const saveResponse = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            image_url: imageUrl,
            model: selectedModel,
          }),
        });

        if (saveResponse.ok) {
          const savedImage = await saveResponse.json();
          setImages((prev) => [savedImage, ...prev]);
        }

        setPrompt("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteImage = async (id: string) => {
    try {
      const response = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div
        className="flex items-center px-4 py-2"
        style={{
          borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
        }}
      >
        <ModelSelector
          models={imageModels}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
          </div>
        ) : images.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ImageIcon className="w-12 h-12 mb-4" style={{ color: "var(--border-default)" }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Generate an image
            </h2>
            <p style={{ color: "var(--text-secondary)" }} className="max-w-md">
              Describe what you want to create and the AI will generate it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading && (
              <div
                className="aspect-square rounded-lg flex items-center justify-center"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: "var(--accent-primary)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Generating...</span>
                </div>
              </div>
            )}
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square rounded-lg overflow-hidden"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <NextImage src={image.image_url} alt={image.prompt} fill className="object-cover" unoptimized />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 md:absolute md:inset-0 md:bg-black/70 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity md:flex md:flex-col md:justify-between md:p-4">
                  <p className="hidden md:block text-white text-sm line-clamp-3">{image.prompt}</p>
                  <div className="flex justify-between items-center md:items-end gap-2">
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-red-500 text-white rounded-md text-xs md:text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <Trash2 className="w-3.5 md:w-4 h-3.5 md:h-4" />
                      <span className="hidden md:inline">Delete</span>
                    </button>
                    <button
                      onClick={() => downloadImage(image.image_url, `image-${image.id}.png`)}
                      className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium hover:opacity-90 transition-opacity"
                      style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                    >
                      <Download className="w-3.5 md:w-4 h-3.5 md:h-4" />
                      <span className="hidden md:inline">Download</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 text-sm"
          style={{
            background: "rgba(248, 113, 113, 0.1)",
            borderTop: "1px solid rgba(248, 113, 113, 0.3)",
            color: "var(--accent-negative)",
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-3 md:p-4" style={{ borderTop: "1px solid var(--border-default)" }}>
        <form onSubmit={handleGenerate} className="max-w-3xl mx-auto">
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-2"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
            }}
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image..."
              className="flex-1 bg-transparent focus:outline-none text-sm py-2"
              style={{ color: "var(--text-primary)" }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="p-2 rounded-lg transition-opacity disabled:opacity-30"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
