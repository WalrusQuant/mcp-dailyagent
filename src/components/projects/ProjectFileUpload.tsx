"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";
import { ProjectFile } from "@/types/database";

interface ProjectFileUploadProps {
  projectId: string;
  onFileUploaded: (file: ProjectFile) => void;
}

const ALLOWED_EXTENSIONS = ["pdf", "txt", "md", "json", "csv", "png", "jpg", "jpeg", "gif", "webp"];

function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type .${ext} not allowed`;
  }
  if (file.size > 50 * 1024 * 1024) {
    return "File too large (max 50MB)";
  }
  return null;
}

export function ProjectFileUpload({ projectId, onFileUploaded }: ProjectFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      alert(error);
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onFileUploaded(data);
      } else {
        const err = await response.json();
        alert(err.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [projectId, onFileUploaded]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      await uploadFile(file);
    }
    e.target.value = "";
  };

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
        isDragging ? "border-[var(--accent-primary)]" : ""
      }`}
      style={{
        borderColor: isDragging ? "var(--accent-primary)" : "var(--border-default)",
        background: isDragging ? "var(--bg-elevated)" : "var(--bg-base)",
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.gif,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent-primary)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {uploadProgress}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Drop files here or click to upload
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            PDF, TXT, MD, JSON, CSV, PNG, JPG, GIF, WEBP — Max 50MB
          </p>
        </div>
      )}
    </div>
  );
}
