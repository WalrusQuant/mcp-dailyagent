"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Image as ImageIcon, FileText } from "lucide-react";

export interface FileAttachment {
  id: string;
  file: File;
  preview: string;
  type: "image" | "file";
  base64?: string;
}

interface FileUploadProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  disabled = false,
  maxFiles = 5,
  maxSizeMB = 10,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File): Promise<FileAttachment | null> => {
      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is ${maxSizeMB}MB.`);
        return null;
      }

      const isImage = file.type.startsWith("image/");
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Convert to base64 for images (needed for vision API)
      let base64: string | undefined;
      let preview: string;

      if (isImage) {
        const reader = new FileReader();
        const result = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64 = result;
        preview = result;
      } else {
        preview = "";
      }

      return {
        id,
        file,
        preview,
        type: isImage ? "image" : "file",
        base64,
      };
    },
    [maxSizeMB]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = maxFiles - attachments.length;

      if (fileArray.length > remainingSlots) {
        alert(`You can only attach up to ${maxFiles} files.`);
        return;
      }

      const processed = await Promise.all(
        fileArray.slice(0, remainingSlots).map(processFile)
      );

      const validFiles = processed.filter(
        (f): f is FileAttachment => f !== null
      );
      onAttachmentsChange([...attachments, ...validFiles]);
    },
    [attachments, maxFiles, onAttachmentsChange, processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.csv"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 bg-[#22d3ee]/10 border-2 border-dashed border-[#22d3ee] rounded-lg z-10 flex items-center justify-center"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className="w-8 h-8 text-[#22d3ee] mx-auto mb-2" />
            <p className="text-[#22d3ee] text-sm">Drop files here</p>
          </div>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group bg-[#252a33] rounded-lg p-1.5 flex items-center gap-2"
            >
              {attachment.type === "image" ? (
                <Image
                  src={attachment.preview}
                  alt={attachment.file.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-cover rounded"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-[#1a1d23] rounded">
                  <FileText className="w-6 h-6 text-[#64748b]" />
                </div>
              )}
              <span className="text-xs text-[#94a3b8] max-w-[100px] truncate">
                {attachment.file.name}
              </span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="p-1 text-[#64748b] hover:text-[#f87171] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {attachments.length < maxFiles && (
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          disabled={disabled}
          className="p-2 text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#252a33] rounded-lg transition-colors disabled:opacity-50"
          title="Attach files"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
