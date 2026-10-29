export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  position = textarea.selectionStart,
): DOMRect {
  const computed = window.getComputedStyle(textarea);
  const textareaRect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  marker.textContent = "\u200b";

  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "fixed";
  mirror.style.left = `${textareaRect.left}px`;
  mirror.style.top = `${textareaRect.top}px`;
  mirror.style.height = `${textareaRect.height}px`;
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "auto";
  mirror.style.font = computed.font;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.textIndent = computed.textIndent;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.lineHeight = computed.lineHeight;

  mirror.textContent = textarea.value.slice(0, position);
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  return markerRect;
}

export function clampCaretAnchorRect(rect: DOMRect, container: HTMLElement): DOMRect {
  const textareaRect = container.getBoundingClientRect();
  const left = Math.min(
    Math.max(rect.left, textareaRect.left + 8),
    textareaRect.right - 8,
  );
  const top = Math.min(
    Math.max(rect.top, textareaRect.top + 4),
    textareaRect.bottom - 4,
  );
  const height = Math.max(rect.height || 16, 16);
  return new DOMRect(left, top, 0, height);
}
