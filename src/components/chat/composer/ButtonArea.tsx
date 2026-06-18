import {useTranslation} from 'react-i18next';
import {
    Bot,
    Circle,
    CircleDashed,
    CircleDot,
    ClipboardList,
    Flame,
    Lightbulb,
    Loader2,
    type LucideIcon,
    MessageSquare,
    Rocket,
    Send,
    Sparkles,
    Square,
    Terminal,
    Zap,
} from 'lucide-react';
import {SelectorDropdown, type SelectorOption} from './SelectorDropdown';
import {
    AVAILABLE_MODES,
    AVAILABLE_PROVIDERS,
    type ChatProviderId,
    modelsForProvider,
    type PermissionMode,
    type ReasoningEffort,
    reasoningLevelsFor,
    reasoningVisibleFor,
} from './constants';

const MODE_ICONS: Record<string, LucideIcon> = {
    'message-square': MessageSquare,
    'clipboard-list': ClipboardList,
    bot: Bot,
    zap: Zap,
};

const REASONING_ICONS: Record<string, LucideIcon> = {
    'circle-dot': CircleDot,
    circle: Circle,
    'circle-dashed': CircleDashed,
    flame: Flame,
    rocket: Rocket,
};

interface ButtonAreaProps {
    provider: ChatProviderId;
    permissionMode: PermissionMode;
    model: string;
    reasoningEffort: ReasoningEffort;
    isLoading: boolean;
    isEnhancing: boolean;
    canSubmit: boolean;
    hasPromptText: boolean;
    onProviderChange: (p: ChatProviderId) => void;
    onModeChange: (m: PermissionMode) => void;
    onModelChange: (id: string) => void;
    onReasoningChange: (e: ReasoningEffort) => void;
    onEnhance: () => void;
    onSubmit: () => void;
    onStop: () => void;
}

/**
 * 输入区底部工具栏：provider / 权限模式 / 模型 / 推理强度选择器 +
 * Prompt 增强 + 发送/停止。移植自 jcc-gui ButtonArea。
 */
export function ButtonArea({
    provider,
    permissionMode,
    model,
    reasoningEffort,
    isLoading,
    isEnhancing,
    canSubmit,
    hasPromptText,
    onProviderChange,
    onModeChange,
    onModelChange,
    onReasoningChange,
    onEnhance,
    onSubmit,
    onStop,
}: ButtonAreaProps) {
    const { t } = useTranslation();

    const providerOptions: SelectorOption<ChatProviderId>[] = AVAILABLE_PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        icon: <Terminal size={14} />,
    }));

    const modeOptions: SelectorOption<PermissionMode>[] = AVAILABLE_MODES.filter(
        // Codex 暂不暴露 plan 模式
        (m) => provider !== 'codex' || m.id !== 'plan',
    ).map((m) => {
        const Icon = MODE_ICONS[m.icon];
        return {
            id: m.id,
            label: t(`chat.modes.${m.i18nKey}.label`),
            description: t(`chat.modes.${m.i18nKey}.description`),
            icon: <Icon size={14} />,
        };
    });

    const models = modelsForProvider(provider);
    const modelOptions: SelectorOption<string>[] = models.map((m) => ({
        id: m.id,
        label: m.label,
        description: t(`chat.models.${m.descKey}`, { defaultValue: '' }) || undefined,
        icon: <Terminal size={14} />,
    }));

    const reasoningVisible = reasoningVisibleFor(provider, model);
    const reasoningLevels = reasoningLevelsFor(provider, model);
    const reasoningOptions: SelectorOption<ReasoningEffort>[] = reasoningLevels.map((r) => {
        const Icon = REASONING_ICONS[r.icon];
        return {
            id: r.id,
            label: t(`chat.reasoning.${r.i18nKey}.label`),
            description: t(`chat.reasoning.${r.i18nKey}.description`),
            icon: <Icon size={14} />,
        };
    });

    const currentMode = AVAILABLE_MODES.find((m) => m.id === permissionMode);
    const CurrentModeIcon = currentMode ? MODE_ICONS[currentMode.icon] : MessageSquare;
    const currentModel = models.find((m) => m.id === model);

    return (
        <div className="flex flex-nowrap items-center gap-1 px-1 pt-1">
            {/* 左侧选择器组 */}
            <SelectorDropdown
                value={provider}
                options={providerOptions}
                onChange={onProviderChange}
                buttonIcon={<Terminal size={14} />}
                title={t('chat.providerLabel')}
            />

            <SelectorDropdown
                value={permissionMode}
                options={modeOptions}
                onChange={onModeChange}
                buttonIcon={<CurrentModeIcon size={14} />}
                buttonLabel={currentMode ? t(`chat.modes.${currentMode.i18nKey}.label`) : undefined}
                highlight={permissionMode === 'bypassPermissions'}
                title={t('chat.modeLabel')}
            />

            <SelectorDropdown
                value={model}
                options={modelOptions}
                onChange={onModelChange}
                buttonIcon={<Terminal size={14} />}
                buttonLabel={currentModel?.label}
                title={t('chat.modelLabel')}
            />

            {reasoningVisible && (
                <SelectorDropdown
                    value={reasoningEffort}
                    options={reasoningOptions}
                    onChange={onReasoningChange}
                    buttonIcon={<Lightbulb size={14} />}
                    buttonLabel={t(`chat.reasoning.${reasoningEffort}.label`)}
                    align="right"
                    title={t('chat.reasoningLabel')}
                />
            )}

            {/* 右侧工具按钮 */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-base-200 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent"
                    onClick={onEnhance}
                    disabled={!hasPromptText || isLoading || isEnhancing}
                    title={t('chat.enhancePrompt')}
                >
                    {isEnhancing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                </button>

                {isLoading ? (
                    <button
                        type="button"
                        className="btn btn-xs btn-error gap-1"
                        onClick={onStop}
                        title={t('chat.stop')}
                    >
                        <Square size={14} />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn btn-xs btn-primary gap-1"
                        onClick={onSubmit}
                        disabled={!canSubmit}
                        title={t('chat.send')}
                    >
                        <Send size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
