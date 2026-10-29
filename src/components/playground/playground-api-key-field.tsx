"use client";

import {
  CaretDown,
  Check,
  Eye,
  EyeSlash,
  Key,
} from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { PLAYGROUND_TOOLBAR_SELECT_TRIGGER } from "@/components/playground/playground-styles";
import {
  readApiKeyVault,
  readPlaygroundApiKey,
  readSelectedApiKeyId,
  resolveVaultPlaintext,
  writeApiKeyVaultEntry,
  writePlaygroundApiKey,
  writeSelectedApiKeyId,
} from "@/lib/playground-api-key";
import { messages } from "@/messages";
import type { ApiKeyRecord } from "@/types/admin";

/** Legacy local vault id — open-source canvas no longer uses this UI. */
const LOCAL_KEY_ID = "local-byok";

type PlaygroundApiKeySharedProps = {
  formId: string;
  value: string;
  onChange: (value: string) => void;
  onResolvingChange?: (resolving: boolean) => void;
};

type PlaygroundApiKeyContextValue = {
  formId: string;
  keysLoading: boolean;
  keyResolving: boolean;
  activeKeys: ApiKeyRecord[];
  selectedId: string;
  selectedKey: ApiKeyRecord | undefined;
  selectedKeyMasked: string;
  vaultPlaintext: string;
  showApiKey: boolean;
  setShowApiKey: (next: boolean | ((current: boolean) => boolean)) => void;
  keyOptions: Array<{
    value: string;
    label: string;
    description?: string;
    descriptionMono?: boolean;
  }>;
  isMember: boolean;
  showManageKeys: boolean;
  selectKey: (id: string) => void;
};

const PlaygroundApiKeyContext = createContext<PlaygroundApiKeyContextValue | null>(
  null,
);

function usePlaygroundApiKeyContext() {
  const context = useContext(PlaygroundApiKeyContext);
  if (!context) {
    throw new Error(
      "Playground API key components must be used within PlaygroundApiKeyToolbarRoot",
    );
  }
  return context;
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

function buildLocalKeyRecord(plaintext: string): ApiKeyRecord {
  const trimmed = plaintext.trim();
  return {
    id: LOCAL_KEY_ID,
    tenantId: "local",
    tenantUserId: null,
    tenantUserEmail: null,
    name: messages.playground.apiKey,
    keyPrefix: trimmed.slice(0, 4) || "sk-",
    keySuffix: trimmed.slice(-4) || "****",
    maskedKey: maskSecret(trimmed),
    status: "active",
    chatRpm: null,
    imageRpm: null,
    videoRpm: null,
    createdAt: new Date(0).toISOString(),
    revokedAt: null,
  };
}

function usePlaygroundApiKeyState({
  onChange,
  onResolvingChange,
}: PlaygroundApiKeySharedProps): Omit<PlaygroundApiKeyContextValue, "formId"> {
  const [selectedId, setSelectedId] = useState(readSelectedApiKeyId);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyResolving, setKeyResolving] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<ApiKeyRecord[]>([]);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    onResolvingChange?.(keyResolving);
  }, [keyResolving, onResolvingChange]);

  const applyLocalCredential = useCallback(
    (plaintext: string) => {
      const trimmed = plaintext.trim();
      if (!trimmed) {
        setActiveKeys([]);
        setSelectedId("");
        writeSelectedApiKeyId("");
        onChange("");
        writePlaygroundApiKey("");
        return;
      }
      writeApiKeyVaultEntry(LOCAL_KEY_ID, trimmed);
      writeSelectedApiKeyId(LOCAL_KEY_ID);
      writePlaygroundApiKey(trimmed);
      setActiveKeys([buildLocalKeyRecord(trimmed)]);
      setSelectedId(LOCAL_KEY_ID);
      onChange(trimmed);
    },
    [onChange],
  );

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;
    setKeysLoading(true);
    setKeyResolving(true);
    try {
      const legacy = readPlaygroundApiKey().trim();
      const vault = resolveVaultPlaintext(LOCAL_KEY_ID, readApiKeyVault());
      applyLocalCredential(vault || legacy);
    } finally {
      setKeysLoading(false);
      setKeyResolving(false);
    }
  }, [applyLocalCredential]);

  const selectedKey = activeKeys.find((key) => key.id === selectedId);
  const vaultPlaintext = selectedId
    ? resolveVaultPlaintext(selectedId, readApiKeyVault())
    : "";
  const selectedKeyMasked =
    selectedKey?.maskedKey ?? (selectedKey ? `${selectedKey.keyPrefix}****` : "");

  const keyOptions = useMemo(
    () =>
      activeKeys.map((key) => ({
        value: key.id,
        label: key.name,
        description: key.maskedKey ?? `${key.keyPrefix}****`,
        descriptionMono: true,
      })),
    [activeKeys],
  );

  const selectKey = useCallback(
    (id: string) => {
      setSelectedId(id);
      writeSelectedApiKeyId(id);
      const plaintext = resolveVaultPlaintext(id, readApiKeyVault());
      onChange(plaintext);
      writePlaygroundApiKey(plaintext);
    },
    [onChange],
  );

  return {
    keysLoading,
    keyResolving,
    activeKeys,
    selectedId,
    selectedKey,
    selectedKeyMasked,
    vaultPlaintext,
    showApiKey,
    setShowApiKey,
    keyOptions,
    isMember: false,
    showManageKeys: false,
    selectKey,
  };
}

function usePlaygroundApiKeyStateWithFormId(
  props: PlaygroundApiKeySharedProps,
): PlaygroundApiKeyContextValue {
  const state = usePlaygroundApiKeyState(props);
  return { ...state, formId: props.formId };
}

export function PlaygroundApiKeyToolbarRoot({
  children,
  onSelectedIdChange,
  ...props
}: PlaygroundApiKeySharedProps & {
  children: ReactNode;
  onSelectedIdChange?: (id: string) => void;
}) {
  const state = usePlaygroundApiKeyStateWithFormId(props);
  useEffect(() => {
    onSelectedIdChange?.(state.selectedId);
  }, [onSelectedIdChange, state.selectedId]);
  return (
    <PlaygroundApiKeyContext.Provider value={state}>
      {children}
    </PlaygroundApiKeyContext.Provider>
  );
}

export function PlaygroundApiKeyToolbarSelect({
  className = "",
}: {
  className?: string;
}) {
  const {
    formId,
    keysLoading,
    keyResolving,
    activeKeys,
    selectedId,
    selectedKey,
    selectedKeyMasked,
    keyOptions,
    selectKey,
  } = usePlaygroundApiKeyContext();

  if (activeKeys.length === 0) {
    return (
      <p className={`truncate text-xs text-zinc-400 ${className}`.trim()}>
        {keysLoading ? messages.loading : emptyApiKeysMessage()}
      </p>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-0.5 ${className}`.trim()}>
      <Select
        id={`${formId}-api-key`}
        value={selectedId}
        options={keyOptions}
        placeholder={messages.playground.apiKeyPlaceholder}
        disabled={keysLoading || keyResolving}
        ariaLabel={messages.playground.apiKey}
        menuZIndex={50}
        size="compact"
        menuWidth="auto"
        menuMinWidth={240}
        menuMaxWidth={320}
        className="min-w-0 flex-1"
        triggerClassName={PLAYGROUND_TOOLBAR_SELECT_TRIGGER}
        triggerContent={
          selectedKey ? (
            <>
              <span className="min-w-0 flex-1 truncate text-left">
                <span className="truncate">{selectedKey.name}</span>
                <span className="ml-1.5 truncate font-mono text-[10px] text-zinc-400">
                  {selectedKeyMasked}
                </span>
              </span>
              <Icon
                icon={CaretDown}
                size={12}
                className="shrink-0 text-current opacity-60"
              />
            </>
          ) : undefined
        }
        onChange={selectKey}
      />

    </div>
  );
}

export function PlaygroundApiKeyIconMenu({
  className = "",
}: {
  className?: string;
}) {
  const {
    keysLoading,
    keyResolving,
    activeKeys,
    selectedId,
    selectKey,
  } = usePlaygroundApiKeyContext();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasKeys = activeKeys.length > 0;

  return (
    <div className={`relative flex shrink-0 items-center ${className}`.trim()}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-sm"
        aria-label={messages.playground.apiKey}
        aria-haspopup="menu"
        aria-expanded={open}
        title={messages.playground.apiKey}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon
          icon={Key}
          size={15}
          className={
            hasKeys
              ? "text-zinc-500 dark:text-zinc-300"
              : "text-amber-500"
          }
        />
        {keyResolving ? (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
        ) : null}
      </Button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={buttonRef}
        placement="bottom"
        role="menu"
        ariaLabel={messages.playground.apiKey}
        minWidth={240}
        maxWidth={320}
        maxHeight={320}
        className="p-1"
      >
        {keysLoading ? (
          <p className="px-2 py-3 text-xs text-zinc-400">
            {messages.loading}
          </p>
        ) : activeKeys.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-zinc-400">
            {emptyApiKeysMessage()}
          </p>
        ) : (
          <div className="space-y-0.5">
            {activeKeys.map((key) => (
              <button
                key={key.id}
                type="button"
                role="menuitemradio"
                aria-checked={selectedId === key.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  selectKey(key.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-zinc-700 dark:text-zinc-200">
                    {key.name}
                  </span>
                  <span className="block truncate font-mono text-[9px] text-zinc-400">
                    {key.maskedKey ?? `${key.keyPrefix}****`}
                  </span>
                </span>
                {selectedId === key.id ? (
                  <Icon
                    icon={Check}
                    size={13}
                    className="shrink-0 text-sky-500"
                  />
                ) : null}
              </button>
            ))}
          </div>
        )}

      </Popover>
    </div>
  );
}

function emptyApiKeysMessage(): string {
  return messages.canvas.generationMissing;
}

type PlaygroundApiKeyFieldProps = PlaygroundApiKeySharedProps & {
  layout?: "default";
};

/** Full form field layout (sidebar / settings panels). */
export function PlaygroundApiKeyField({
  formId,
  value,
  onChange,
}: PlaygroundApiKeyFieldProps) {
  const {
    keysLoading,
    keyResolving,
    activeKeys,
    selectedId,
    selectedKey,
    vaultPlaintext,
    showApiKey,
    setShowApiKey,
    keyOptions,
    selectKey,
  } = usePlaygroundApiKeyStateWithFormId({ formId, value, onChange });

  const selectControl =
    activeKeys.length > 0 ? (
      <Select
        id={`${formId}-api-key`}
        value={selectedId}
        options={keyOptions}
        placeholder={messages.playground.apiKeyPlaceholder}
        disabled={keysLoading || keyResolving}
        ariaLabel={messages.playground.apiKey}
        menuZIndex={50}
        menuWidth="auto"
        menuMinWidth={280}
        menuMaxWidth={360}
        onChange={selectKey}
      />
    ) : (
      <p className="text-xs text-zinc-400">
        {keysLoading ? messages.loading : emptyApiKeysMessage()}
      </p>
    );

  return (
    <Field
      label={messages.playground.apiKey}
      htmlFor={`${formId}-api-key`}
      hint={
        <p className="text-xs leading-relaxed text-zinc-400">
          {messages.playground.apiKeyHint}
          
        </p>
      }
    >
      {selectControl}
      {selectedId && vaultPlaintext ? (
        <p className="mt-1.5 font-mono text-xs text-zinc-400">
          {showApiKey ? vaultPlaintext : selectedKey?.maskedKey}
          <button
            type="button"
            className="ml-2 inline-flex align-middle text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label={
              showApiKey
                ? messages.playground.hideKey
                : messages.playground.showKey
            }
            aria-pressed={showApiKey}
            onClick={() => setShowApiKey((current) => !current)}
          >
            <Icon
              icon={showApiKey ? EyeSlash : Eye}
              size={14}
            />
          </button>
        </p>
      ) : null}
    </Field>
  );
}
