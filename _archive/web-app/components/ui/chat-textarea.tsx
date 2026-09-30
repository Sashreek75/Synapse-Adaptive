"use client";

/**
 * CHAT TEXTAREA — an auto-growing input that behaves like a modern chat composer:
 * it starts at one line and grows with the content up to `maxHeight`, then scrolls.
 * Enter submits; Shift+Enter inserts a newline. Because it's a real <textarea>, pasted
 * text keeps its line breaks and formatting, and emojis / IME composition come through
 * intact (we never submit mid-composition).
 */

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit?: () => void;
  /** Max pixel height before the textarea starts to scroll instead of grow. */
  maxHeight?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

export function ChatTextarea({
  value,
  onValueChange,
  onSubmit,
  maxHeight = 200,
  className,
  onKeyDown,
  rows = 1,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Grow to fit the content (up to maxHeight), then scroll. Runs on every value change.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={(e) => {
        // Enter submits; Shift+Enter is a newline. Never submit while an IME (emoji /
        // multibyte) composition is in progress.
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.nativeEvent.isComposing &&
          onSubmit
        ) {
          e.preventDefault();
          onSubmit();
        }
        onKeyDown?.(e);
      }}
      className={cn("resize-none", className)}
      {...rest}
    />
  );
}
