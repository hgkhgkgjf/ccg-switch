import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ButtonArea} from './ButtonArea';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('ButtonArea', () => {
    const CLAUDE_LOBEHUB_PATH_START = 'M4.709 15.955l4.72';
    const OLD_CLAUDE_PLACEHOLDER_PATH_START = 'M11.1 2.75h1.8';

    const getProviderButtonHtml = (html: string) => {
        return html.match(/<button[^>]*title="AI provider"[\s\S]*?<\/button>/)?.[0] ?? '';
    };

    const getModelButtonHtml = (html: string) => {
        return html.match(/<button[^>]*title="Model"[\s\S]*?<\/button>/)?.[0] ?? '';
    };

    it('disables provider, mode, model, and reasoning selectors while a turn is loading', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(html).toMatch(/<button[^>]*title="AI provider"[^>]*disabled/);
        expect(html).toMatch(/<button[^>]*title="Permission mode"[^>]*disabled/);
        expect(html).toMatch(/<button[^>]*title="Model"[^>]*disabled/);
        expect(html).toMatch(/<button[^>]*title="Reasoning effort"[^>]*disabled/);
        expect(html).not.toContain('title="chat.providerLabel"');
        expect(html).not.toContain('title="chat.modeLabel"');
        expect(html).not.toContain('title="chat.modelLabel"');
        expect(html).not.toContain('title="chat.reasoningLabel"');
    });

    it('shows a disabled send affordance instead of stop while a send is waiting for request id', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(html).toMatch(/<button(?=[^>]*title="Send")(?=[^>]*disabled)[^>]*>/);
        expect(html).not.toContain('title="Stop"');
        expect(html).not.toContain('title="chat.send"');
    });

    it('keeps composer primary actions in a fixed right-side action group', () => {
        const sendHtml = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );
        const stopHtml = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(sendHtml).toContain('chat-composer-toolbar');
        expect(sendHtml).toContain('chat-composer-toolbar-selectors');
        expect(sendHtml).toContain('chat-composer-toolbar-actions');
        expect(sendHtml).toMatch(/<button(?=[^>]*title="Enhance prompt")(?=[^>]*aria-label="Enhance prompt")(?=[^>]*chat-composer-action-button)(?=[^>]*h-7)(?=[^>]*w-7)(?=[^>]*shrink-0)[^>]*>/);
        expect(sendHtml).toMatch(/<button(?=[^>]*title="Send")(?=[^>]*aria-label="Send")(?=[^>]*chat-composer-primary-action)(?=[^>]*h-7)(?=[^>]*w-7)(?=[^>]*shrink-0)[^>]*>/);
        expect(stopHtml).toMatch(/<button(?=[^>]*title="Stop")(?=[^>]*aria-label="Stop")(?=[^>]*chat-composer-primary-action)(?=[^>]*h-7)(?=[^>]*w-7)(?=[^>]*shrink-0)[^>]*>/);
        expect(sendHtml).not.toContain('chat.enhancePrompt');
        expect(sendHtml).not.toContain('chat.send');
        expect(stopHtml).not.toContain('chat.stop');
    });

    it('keeps selected mode and reasoning values readable when translations return keys', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(html).toContain('Default Mode');
        expect(html).toContain('High');
        expect(html).not.toContain('chat.modes.default.label');
        expect(html).not.toContain('chat.reasoning.high.label');
    });

    it('renders the model selector with a model-specific icon and injected dynamic model label', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-sonnet-provider-20260601"
                models={[
                    {
                        id: 'claude-sonnet-provider-20260601',
                        label: 'Provider Sonnet',
                        description: 'Loaded from provider configuration',
                    },
                ]}
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(html).toContain('Provider Sonnet');
        const modelButton = getModelButtonHtml(html);
        expect(modelButton).toContain('data-chat-model-icon="claude-sonnet"');
        expect(modelButton).toContain('data-chat-model-icon-glyph="claude-lobehub"');
        expect(modelButton).toContain(CLAUDE_LOBEHUB_PATH_START);
        expect(modelButton).toContain('chat-model-icon-box');
        expect(modelButton).toContain('selector-dropdown-trigger-icon');
        expect(modelButton).not.toContain('lucide-sparkles');
        expect(modelButton).not.toContain('lucide-gem');
    });

    it('renders Codex model icons as the OpenAI/Codex brand glyph instead of a terminal icon', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="codex"
                permissionMode="default"
                model="gpt-5.2-codex"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        const modelButton = getModelButtonHtml(html);
        expect(modelButton).toContain('data-chat-model-icon="codex-codex"');
        expect(modelButton).toContain('data-chat-model-icon-glyph="codex-openai"');
        expect(modelButton).toContain('chat-model-icon-box');
        expect(modelButton).toContain('selector-dropdown-trigger-icon');
        expect(modelButton).not.toContain('lucide-terminal');
    });

    it('renders provider-specific icons for Claude Code and Codex selector states', () => {
        const claudeHtml = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );
        const codexHtml = renderToStaticMarkup(
            <ButtonArea
                provider="codex"
                permissionMode="default"
                model="gpt-5.2-codex"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        const claudeProviderButton = getProviderButtonHtml(claudeHtml);
        const codexProviderButton = getProviderButtonHtml(codexHtml);

        expect(claudeProviderButton).toContain('data-chat-provider-icon="claude"');
        expect(claudeProviderButton).toContain('selector-dropdown-trigger-icon');
        expect(codexProviderButton).toContain('data-chat-provider-icon="codex"');
        expect(codexProviderButton).toContain('selector-dropdown-trigger-icon');
        expect(claudeProviderButton).toContain('data-chat-provider-icon-glyph="claude-lobehub"');
        expect(claudeProviderButton).toContain(CLAUDE_LOBEHUB_PATH_START);
        expect(claudeProviderButton).not.toContain(OLD_CLAUDE_PLACEHOLDER_PATH_START);
        expect(claudeProviderButton).not.toContain('lucide-terminal');
        expect(codexProviderButton).not.toContain('lucide-terminal');
    });

    it('renders an icon-only model refresh control when dynamic refresh is available', () => {
        const html = renderToStaticMarkup(
            <ButtonArea
                provider="codex"
                permissionMode="default"
                model="gpt-5.2-codex"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                modelsCanRefresh
                onRefreshModels={() => undefined}
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(html).toMatch(/<button(?=[^>]*title="Refresh models")(?=[^>]*aria-label="Refresh models")[^>]*>/);
        expect(html).not.toContain('chat.modelsRefresh');
        expect(html).toContain('data-chat-model-icon="codex-codex"');
    });

    it('surfaces model refresh loading and error states in the model menu footer', () => {
        const loadingHtml = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                modelsCanRefresh
                modelsRefreshing
                onRefreshModels={() => undefined}
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );
        const errorHtml = renderToStaticMarkup(
            <ButtonArea
                provider="claude"
                permissionMode="default"
                model="claude-opus-4-8"
                reasoningEffort="high"
                isLoading={false}
                isSubmitting={false}
                isEnhancing={false}
                canSubmit
                hasPromptText
                modelsCanRefresh
                modelsRefreshError="Network failed"
                onRefreshModels={() => undefined}
                onProviderChange={() => undefined}
                onModeChange={() => undefined}
                onModelChange={() => undefined}
                onReasoningChange={() => undefined}
                onEnhance={() => undefined}
                onSubmit={() => undefined}
                onStop={() => undefined}
            />,
        );

        expect(loadingHtml).toContain('Refreshing models...');
        expect(loadingHtml).not.toContain('chat.modelsRefreshing');
        expect(errorHtml).toContain('Network failed');
    });
});
