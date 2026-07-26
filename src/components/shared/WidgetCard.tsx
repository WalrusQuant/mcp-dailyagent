"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface WidgetCardProps {
  href: string;
  title: string;
  icon: LucideIcon;
  /** CSS color for icon + badge tint, e.g. var(--domain-tasks) */
  domainColor?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WidgetCard({
  href,
  title,
  icon: Icon,
  domainColor = "var(--accent-primary)",
  meta,
  children,
  className = "",
}: WidgetCardProps) {
  return (
    <Link href={href} className={`card-interactive block ${className}`}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <span
          className="icon-badge"
          style={{
            background: `color-mix(in srgb, ${domainColor} 16%, transparent)`,
            color: domainColor,
          }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <span className="heading-sm flex-1 min-w-0 truncate">{title}</span>
        {meta != null && (
          <span className="caption shrink-0 tabular-nums">{meta}</span>
        )}
      </div>
      {children}
    </Link>
  );
}
