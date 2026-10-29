"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CaretDown,
  CaretUp,
  Check,
  MagnifyingGlassMinus,
} from "@phosphor-icons/react";

import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Search } from "@/components/ui/search";
import {
  FORM_CONTROL_DEFAULT_SIZE,
  selectTriggerClassName,
} from "@/components/ui/form-control";

export type DropdownMenuOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  /** Same group label collapses into one section header in the menu. */
  group?: string;
  descriptionMono?: boolean;
};

type DropdownMenuProps = {
  id?: string;
  value: string;
  options: DropdownMenuOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
  placement?: "top" | "bottom";
  size?: "default" | "compact" | "pill";
  /** auto: at least trigger width, grow with content up to max; trigger: lock to trigger width */
  menuWidth?: "auto" | "trigger";
  /** Floor for menu min-width in px when menuWidth is auto (useful for icon-only triggers). */
  menuMinWidth?: number;
  /** Cap for menu max-width in px when menuWidth is auto. */
  menuMaxWidth?: number;
  className?: string;
  menuZIndex?: number;
  triggerClassName?: string;
  /** When set, replaces the default trigger label / chevron content. */
  triggerContent?: ReactNode;
  leading?: ReactNode;
  tone?: "default" | "accent";
  hideValueLabel?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  /** Sticky top slot. When searchable and omitted, a Search field is rendered. */
  header?: ReactNode;
  /** Sticky bottom slot (e.g. account balance). */
  footer?: ReactNode;
};

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number | "max-content";
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
};

type MenuMotion = "enter" | "exit";

const MENU_GAP = 6;
const MENU_Z_INDEX = 50;
const MENU_MAX_HEIGHT = 280;
const MENU_MAX_WIDTH = 320;
const VIEWPORT_PADDING = 8;
const MENU_EXIT_DURATION_MS = 180;

type DropdownMenuSection = {
  group?: string;
  options: DropdownMenuOption[];
};

function groupDropdownOptions(options: DropdownMenuOption[]): DropdownMenuSection[] {
  const sections: DropdownMenuSection[] = [];
  for (const option of options) {
    const group = option.group?.trim() || undefined;
    const last = sections[sections.length - 1];
    if (last && last.group === group) {
      last.options.push(option);
      continue;
    }
    sections.push({ group, options: [option] });
  }
  return sections;
}

function resolveMenuMotionClassName(opensUpward: boolean, motion: MenuMotion) {
  if (motion === "exit") {
    return opensUpward ? "ui-menu-exit-top" : "ui-menu-exit-bottom";
  }
  return opensUpward ? "ui-menu-enter-top" : "ui-menu-enter-bottom";
}

function getMenuPosition(
  triggerRect: DOMRect,
  preferredPlacement: "top" | "bottom",
  menuWidthMode: "auto" | "trigger",
  menuMinWidth: number,
  menuMaxWidth: number,
  measured?: { height?: number; width?: number },
): MenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - triggerRect.bottom - MENU_GAP - VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - MENU_GAP - VIEWPORT_PADDING;
  const estimatedHeight = measured?.height ?? MENU_MAX_HEIGHT;

  const shouldOpenTop =
    preferredPlacement === "top"
      ? spaceAbove >= Math.min(estimatedHeight, spaceBelow) || spaceAbove > spaceBelow
      : spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

  const viewportCap = viewportWidth - VIEWPORT_PADDING * 2;
  const triggerWidth = Math.min(triggerRect.width, viewportCap);
  const widthFloor = Math.min(viewportCap, Math.max(triggerWidth, menuMinWidth));
  const contentMaxWidth = Math.min(
    viewportCap,
    Math.max(widthFloor, menuMaxWidth),
  );

  let menuWidth: number | "max-content";
  let minWidth: number;
  let maxWidth: number;

  if (menuWidthMode === "trigger") {
    menuWidth = triggerWidth;
    minWidth = triggerWidth;
    maxWidth = triggerWidth;
  } else if (measured?.width !== undefined) {
    menuWidth = Math.min(contentMaxWidth, Math.max(widthFloor, measured.width));
    minWidth = widthFloor;
    maxWidth = contentMaxWidth;
  } else {
    menuWidth = "max-content";
    minWidth = widthFloor;
    maxWidth = contentMaxWidth;
  }

  const resolvedWidth = typeof menuWidth === "number" ? menuWidth : minWidth;
  const menuLeft = Math.min(
    Math.max(triggerRect.left, VIEWPORT_PADDING),
    viewportWidth - VIEWPORT_PADDING - resolvedWidth,
  );

  if (shouldOpenTop) {
    return {
      left: menuLeft,
      width: menuWidth,
      minWidth,
      maxWidth,
      bottom: viewportHeight - triggerRect.top + MENU_GAP,
      maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(0, spaceAbove)),
    };
  }

  return {
    left: menuLeft,
    width: menuWidth,
    minWidth,
    maxWidth,
    top: triggerRect.bottom + MENU_GAP,
    maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(0, spaceBelow)),
  };
}

export function DropdownMenu({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "",
  ariaLabel,
  placement = "bottom",
  size = "default",
  menuWidth = "auto",
  menuMinWidth = 0,
  menuMaxWidth = MENU_MAX_WIDTH,
  className = "",
  menuZIndex = MENU_Z_INDEX,
  triggerClassName,
  triggerContent,
  leading,
  tone = "default",
  hideValueLabel = false,
  searchable = false,
  searchPlaceholder = "",
  emptySearchLabel = "",
  header,
  footer,
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const exitCompletedRef = useRef(false);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [motion, setMotion] = useState<MenuMotion>("enter");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!searchable || !query) {
      return options;
    }
    return options.filter((option) => {
      const label = option.label.toLowerCase();
      const description = option.description?.toLowerCase() ?? "";
      const group = option.group?.toLowerCase() ?? "";
      const optionValue = option.value.toLowerCase();
      return (
        label.includes(query) ||
        description.includes(query) ||
        group.includes(query) ||
        optionValue.includes(query)
      );
    });
  }, [options, searchQuery, searchable]);
  const selectedOption = options.find((item) => item.value === value);
  const sections = groupDropdownOptions(filteredOptions);
  const showGroupHeaders =
    sections.filter((section) => Boolean(section.group)).length > 1;

  const updateMenuPosition = useCallback(
    (measured?: { height?: number; width?: number }) => {
      if (!triggerRef.current) {
        return;
      }
      setMenuPosition(
        getMenuPosition(
          triggerRef.current.getBoundingClientRect(),
          placement,
          menuWidth,
          menuMinWidth,
          menuMaxWidth,
          measured,
        ),
      );
    },
    [menuMaxWidth, menuMinWidth, menuWidth, placement],
  );

  const measureAndUpdatePosition = useCallback(() => {
    const menu = menuRef.current;
    if (!menu || !triggerRef.current) {
      return;
    }

    const optionButtons = menu.querySelectorAll<HTMLElement>('[role="option"]');
    let contentWidth = 0;
    for (const button of optionButtons) {
      const previousWidth = button.style.width;
      const truncatedElements = button.querySelectorAll<HTMLElement>(".truncate");
      const previousStyles = Array.from(truncatedElements).map((element) => ({
        element,
        overflow: element.style.overflow,
        minWidth: element.style.minWidth,
        width: element.style.width,
      }));

      button.style.width = "max-content";
      for (const element of truncatedElements) {
        element.style.overflow = "visible";
        element.style.minWidth = "max-content";
        element.style.width = "max-content";
      }

      contentWidth = Math.max(contentWidth, button.scrollWidth);

      button.style.width = previousWidth;
      for (const previous of previousStyles) {
        previous.element.style.overflow = previous.overflow;
        previous.element.style.minWidth = previous.minWidth;
        previous.element.style.width = previous.width;
      }
    }

    const styles = window.getComputedStyle(menu);
    const horizontalChrome =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0) +
      (Number.parseFloat(styles.borderLeftWidth) || 0) +
      (Number.parseFloat(styles.borderRightWidth) || 0);

    updateMenuPosition({
      height: menu.scrollHeight,
      width: Math.ceil(contentWidth + horizontalChrome),
    });
  }, [updateMenuPosition]);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setRendered(true);
      setMotion("enter");
    } else if (rendered) {
      setMotion("exit");
    }
  }

  useEffect(() => {
    if (motion === "enter") {
      exitCompletedRef.current = false;
    }
  }, [motion]);

  useEffect(() => {
    if (!rendered || motion !== "exit") {
      return;
    }

    const finishExit = () => {
      if (exitCompletedRef.current) {
        return;
      }
      exitCompletedRef.current = true;
      setRendered(false);
      setMenuPosition(null);
      setSearchQuery("");
    };

    const timeoutId = window.setTimeout(finishExit, MENU_EXIT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [motion, rendered]);

  useLayoutEffect(() => {
    if (!isOpen || !rendered || motion === "exit" || !menuRef.current) {
      return;
    }
    measureAndUpdatePosition();
  }, [filteredOptions, isOpen, measureAndUpdatePosition, motion, rendered]);

  useEffect(() => {
    if (!isOpen || !rendered || motion === "exit" || !searchable) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, motion, rendered, searchable]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !rendered || motion === "exit") {
      return;
    }

    updateMenuPosition();

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (searchable && searchQuery.trim()) {
          setSearchQuery("");
          return;
        }
        closeMenu();
      }
    };

    const handleLayoutChange = () => {
      measureAndUpdatePosition();
    };

    window.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [
    closeMenu,
    isOpen,
    measureAndUpdatePosition,
    motion,
    rendered,
    searchQuery,
    searchable,
    updateMenuPosition,
  ]);

  const handleMenuAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (motion !== "exit" || event.target !== event.currentTarget) {
      return;
    }
    if (exitCompletedRef.current) {
      return;
    }
    exitCompletedRef.current = true;
    setRendered(false);
    setMenuPosition(null);
    setSearchQuery("");
  };

  const defaultTriggerClassName =
    size === "compact"
      ? "ui-press flex min-w-0 flex-1 cursor-pointer items-center justify-start gap-1.5 rounded-md px-1 py-1 text-left text-xs text-zinc-600 outline-none transition-[color,background-color,transform] duration-150 ease-out hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      : size === "pill"
        ? `ui-press inline-flex max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs outline-none transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
            tone === "accent"
              ? "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 hover:shadow-sm dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:border-sky-800 dark:hover:bg-sky-950"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          }`
        : selectTriggerClassName("soft", FORM_CONTROL_DEFAULT_SIZE);
  const resolvedTriggerClassName = triggerClassName ?? defaultTriggerClassName;

  const itemClassName =
    size === "compact" || size === "pill"
      ? "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-[color,background-color] duration-150 ease-out"
      : "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-[color,background-color] duration-150 ease-out";

  const menuOpensUpward = menuPosition?.bottom !== undefined;
  const hasFooter = footer != null;
  const menuClassName = [
    "flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
    resolveMenuMotionClassName(menuOpensUpward, motion),
  ].join(" ");

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
        position: "fixed",
        left: menuPosition.left,
        top: menuPosition.top,
        bottom: menuPosition.bottom,
        width: menuPosition.width,
        minWidth: menuPosition.minWidth,
        maxWidth: menuPosition.maxWidth,
        maxHeight: menuPosition.maxHeight,
        zIndex: menuZIndex,
      }
    : undefined;

  const resolvedHeader =
    header ??
    (searchable ? (
      <div className="p-1.5">
        <Search
          ref={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          size="mini"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder || ariaLabel}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.stopPropagation();
              if (searchQuery.trim()) {
                return;
              }
              event.preventDefault();
              closeMenu();
            }
          }}
        />
      </div>
    ) : null);

  const menuContent =
    rendered && menuPosition ? (
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        data-dropdown-menu-portal=""
        className={menuClassName}
        style={menuStyle}
        onAnimationEnd={handleMenuAnimationEnd}
      >
        {resolvedHeader != null ? (
          <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800">
            {resolvedHeader}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {sections.length === 0 ? (
            <Empty size="inline" icon={MagnifyingGlassMinus}>
              {emptySearchLabel || "—"}
            </Empty>
          ) : null}
          {sections.map((section, sectionIndex) => (
            <div
              key={section.group ? `group:${section.group}` : `section:${sectionIndex}`}
              role={section.group ? "group" : undefined}
              aria-label={section.group}
            >
              {section.group && showGroupHeaders ? (
                <div
                  className={`px-2.5 pb-1 text-[10px] font-medium tracking-wide text-zinc-400 ${
                    sectionIndex > 0 ? "mt-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800" : "pt-1"
                  }`}
                >
                  {section.group}
                </div>
              ) : null}
              {section.options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={motion === "exit"}
                    onClick={() => {
                      onChange(option.value);
                      closeMenu();
                    }}
                    className={`${itemClassName} ${
                      isSelected
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {option.leading ? (
                        <span className="inline-flex size-5 shrink-0 items-center justify-center">
                          {option.leading}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs leading-4">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span
                            className={`mt-0.5 block truncate text-[10px] leading-3 ${
                              option.descriptionMono ? "font-mono" : ""
                            } ${
                              isSelected ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400"
                            }`}
                          >
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {isSelected ? <Icon icon={Check} size={14} className="shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {hasFooter ? (
          <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800">
            {footer}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (!isOpen) {
            updateMenuPosition();
            setIsOpen(true);
            return;
          }
          closeMenu();
        }}
        className={resolvedTriggerClassName}
      >
        {triggerContent != null ? (
          triggerContent
        ) : hideValueLabel ? (
          <>
            {leading ? (
              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                {leading}
              </span>
            ) : null}
            <span className="sr-only">{selectedOption?.label ?? placeholder}</span>
          </>
        ) : (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {leading ? (
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  {leading}
                </span>
              ) : null}
              <span
                className={`min-w-0 flex-1 truncate leading-4 ${selectedOption ? "" : "text-zinc-400"}`}
              >
                {selectedOption?.label ?? placeholder}
              </span>
            </span>
            <Icon
              icon={isOpen ? CaretUp : CaretDown}
              size={size === "pill" || size === "compact" ? 12 : 16}
              className="playground-select-chevron shrink-0 text-current opacity-60 transition-transform duration-200 ease-out"
            />
          </>
        )}
      </button>

      {typeof document !== "undefined" && menuContent
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
}
