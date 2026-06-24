import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createInstance} from 'i18next';
import {I18nextProvider} from 'react-i18next';
import StatusPanel, {getStatusEditPreviewTop} from './StatusPanel';
import {type ChatStatusSummary, getChatStatusEditKey} from '../../utils/chatStatusSummary';

function createKeyOnlyI18n() {
    const instance = createInstance();
    instance.init({
        lng: 'en',
        fallbackLng: false,
        resources: {},
        initImmediate: false,
        interpolation: {escapeValue: false},
    });
    return instance;
}

describe('StatusPanel', () => {
    it('keeps status edit hover previews inside the viewport near the bottom edge', () => {
        expect(getStatusEditPreviewTop(680, 720)).toBe(228);
        expect(getStatusEditPreviewTop(260, 360)).toBe(12);
        expect(getStatusEditPreviewTop(40, 720)).toBe(32);
    });

    it('renders runtime context for model, mode, workspace, and SDK readiness', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                model="claude-sonnet-4-6"
                permissionMode="bypassPermissions"
                reasoningEffort="high"
                currentCwd="C:/guodevelop/ccg-switch"
                sdkStatus={{
                    id: 'claude-sdk',
                    displayName: 'Claude Code SDK',
                    installed: true,
                    path: 'C:/deps/claude-sdk',
                    currentVersion: '1.2.0',
                    defaultVersion: '^0.2.58',
                    latestVersion: '1.2.0',
                    availableVersions: ['1.2.0'],
                }}
            />,
        );

        expect(html).toContain('status-runtime-context');
        expect(html).toContain('status-runtime-context-grid');
        expect((html.match(/status-runtime-context-item/g) ?? []).length).toBe(5);
        expect(html).toContain('status-runtime-context-value');
        expect(html).toContain('claude-sonnet-4-6');
        expect(html).toMatch(/Auto Mode|自动模式/i);
        expect(html).toMatch(/High|高/i);
        expect(html).toContain('C:/guodevelop/ccg-switch');
        expect(html).toContain('Claude Code SDK');
        expect(html).toMatch(/Installed|已安装/i);
        expect(html).toMatch(/aria-label="(?:Model|模型): claude-sonnet-4-6"/i);
        expect(html).toMatch(/aria-label="(?:Permission mode|权限模式): (?:Auto Mode|自动模式)"/i);
        expect(html).toMatch(/aria-label="(?:Reasoning effort|推理强度): (?:High|高)"/i);
        expect(html).toMatch(/aria-label="(?:Workspace|工作区): C:\/guodevelop\/ccg-switch"/i);
        expect(html).toMatch(/aria-label="(?:SDK): Claude Code SDK · (?:Installed|已安装)"/i);
        expect(html).toMatch(/title="(?:Model|模型): claude-sonnet-4-6"/i);
        expect(html).toMatch(/title="(?:Permission mode|权限模式): (?:Auto Mode|自动模式)"/i);
        expect(html).toMatch(/title="(?:Reasoning effort|推理强度): (?:High|高)"/i);
        expect(html).toMatch(/title="(?:Workspace|工作区): C:\/guodevelop\/ccg-switch"/i);
        expect(html).toMatch(/title="(?:SDK): C:\/deps\/claude-sdk"/i);
    });

    it('falls back to readable top status and runtime labels when i18n keys are unavailable', () => {
        const statusSummary: ChatStatusSummary = {
            activeTool: {
                toolId: 'tool-bash',
                type: 'bash',
                label: 'Bash',
                accentClass: 'accent-terminal',
                summary: 'npm run build',
                detail: 'Running build verification',
                status: 'pending',
            },
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 1,
            completedToolCount: 0,
            errorToolCount: 0,
        };
        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="claude"
                    messageCount={4}
                    daemonReady={false}
                    daemonStatus="shutdown"
                    model="claude-sonnet-4-6"
                    permissionMode="bypassPermissions"
                    reasoningEffort="high"
                    currentCwd="C:/guodevelop/ccg-switch"
                    anchorCount={3}
                    statusSummary={statusSummary}
                    sdkStatus={{
                        id: 'claude-sdk',
                        displayName: 'Claude Code SDK',
                        installed: true,
                        path: 'C:/deps/claude-sdk',
                        currentVersion: '1.2.0',
                        defaultVersion: '^0.2.58',
                        latestVersion: '1.2.0',
                        availableVersions: ['1.2.0'],
                    }}
                    onReconnectDaemon={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('Session status');
        expect(html).toContain('AI provider');
        expect(html).toContain('Messages');
        expect(html).toContain('Message anchors');
        expect(html).toContain('class="status-top-provider-value font-medium text-base-content/70" title="AI provider: claude" aria-label="AI provider: claude"');
        expect(html).toContain('class="status-top-message-count font-medium text-base-content/70" title="Messages: 4" aria-label="Messages: 4"');
        expect(html).toContain('class="status-top-anchor-count font-medium text-base-content/70" title="Message anchors: 3" aria-label="Message anchors: 3"');
        expect(html).toContain('Daemon');
        expect(html).toContain('Daemon offline');
        expect(html).toContain('class="status-top-daemon-value font-medium text-error" title="Daemon: Daemon offline" aria-label="Daemon: Daemon offline"');
        expect(html).toContain('aria-label="Daemon: Daemon offline"');
        expect(html).toContain('Reconnect daemon');
        expect(html).toContain('Runtime context');
        expect(html).toContain('Bash: npm run build · Pending');
        expect(html).toContain('Model');
        expect(html).toContain('Permission mode');
        expect(html).toContain('Auto Mode');
        expect(html).toContain('Reasoning effort');
        expect(html).toContain('High');
        expect(html).toContain('Workspace');
        expect(html).toContain('SDK');
        expect(html).toContain('Installed');
        expect(html).toContain('aria-label="Model: claude-sonnet-4-6"');
        expect(html).toContain('aria-label="Permission mode: Auto Mode"');
        expect(html).toContain('aria-label="Reasoning effort: High"');
        expect(html).toContain('aria-label="Workspace: C:/guodevelop/ccg-switch"');
        expect(html).toContain('aria-label="SDK: Claude Code SDK · Installed"');
        expect(html).toContain('title="Model: claude-sonnet-4-6"');
        expect(html).toContain('title="Permission mode: Auto Mode"');
        expect(html).toContain('title="Reasoning effort: High"');
        expect(html).toContain('title="Workspace: C:/guodevelop/ccg-switch"');
        expect(html).toContain('title="SDK: C:/deps/claude-sdk"');
        expect(html).not.toContain('chat.layout.statusPanel');
        expect(html).not.toContain('chat.providerLabel');
        expect(html).not.toContain('chat.layout.messageCount');
        expect(html).not.toContain('chat.layout.anchorRail');
        expect(html).not.toContain('chat.daemon.label');
        expect(html).not.toContain('chat.daemon.offline');
        expect(html).not.toContain('chat.daemon.reconnect');
        expect(html).not.toContain('chat.layout.runtimeContext');
        expect(html).not.toContain('chat.modelLabel');
        expect(html).not.toContain('chat.modeLabel');
        expect(html).not.toContain('chat.modes.bypassPermissions.label');
        expect(html).not.toContain('chat.reasoningLabel');
        expect(html).not.toContain('chat.reasoning.high.label');
        expect(html).not.toContain('chat.layout.workspace');
        expect(html).not.toContain('chat.layout.sdkStatus');
        expect(html).not.toContain('chat.sdk.installed');
    });

    it('consolidates tool counts into the current activity card header', () => {
        const statusSummary: ChatStatusSummary = {
            activeTool: {
                toolId: 'tool-bash',
                type: 'bash',
                label: 'Bash',
                accentClass: 'accent-terminal',
                summary: 'npm run build',
                detail: 'Running build verification',
                status: 'pending',
            },
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 3,
            completedToolCount: 2,
            errorToolCount: 1,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-tool-counts');
        expect(html).toContain('status-activity-tool-count pending');
        expect(html).toContain('status-activity-tool-count error');
        expect(html).toMatch(/title="(?:Pending tools|进行中工具): 3"/i);
        expect(html).toMatch(/title="(?:Failed tools|失败工具): 1"/i);
        expect(html).toMatch(/aria-label="(?:Pending tools|进行中工具): 3"/i);
        expect(html).toMatch(/aria-label="(?:Failed tools|失败工具): 1"/i);
        expect(html).toMatch(/aria-label="Bash: npm run build · (?:Pending|等待中)"/i);
        expect(html).toContain('title="Bash: npm run build"');
        expect(html).toContain('aria-label="Bash: npm run build"');
        expect(html).toContain('title="Bash: Running build verification"');
        expect(html).toContain('aria-label="Bash: Running build verification"');
        expect(html).not.toMatch(/<span>(?:Pending tools|进行中工具)<\/span>/i);
        expect(html).not.toMatch(/<span>(?:Failed tools|失败工具)<\/span>/i);
    });

    it('renders a recent desktop task list in the current activity card with subagents separated', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-oldest',
                    type: 'bash',
                    label: 'Bash',
                    accentClass: 'accent-terminal',
                    summary: 'oldest hidden task',
                    detail: 'first command',
                    status: 'completed',
                },
                {
                    toolId: 'tool-read',
                    type: 'read',
                    label: 'Read',
                    accentClass: 'accent-read',
                    summary: 'read src/App.tsx',
                    detail: 'src/App.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-agent',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'spawn review agent',
                    detail: 'subagent history',
                    status: 'completed',
                },
                {
                    toolId: 'tool-grep',
                    type: 'search',
                    label: 'Search',
                    accentClass: 'accent-search',
                    summary: 'grep StatusPanel',
                    detail: 'src/components/chat',
                    status: 'completed',
                },
                {
                    toolId: 'tool-edit',
                    type: 'edit',
                    label: 'Edit',
                    accentClass: 'accent-edit',
                    summary: 'edit StatusPanel.tsx',
                    detail: 'src/components/chat/StatusPanel.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-build',
                    type: 'bash',
                    label: 'Build',
                    accentClass: 'accent-terminal',
                    summary: 'npm run build',
                    detail: 'type-check and bundle',
                    status: 'completed',
                },
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 6,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-task-list');
        expect(html).toContain('status-activity-task-row');
        expect(html).toContain('status-activity-scroll-region');
        expect(html).toContain('role="region"');
        expect(html).toMatch(/tabindex="0"/i);
        expect(html).toMatch(/aria-label="(?:Activity history|活动历史)"/i);
        expect(html).toMatch(/class="status-activity-task-ratio[^"]*" title="(?:Tasks|任务): 5 \/ 6" aria-label="(?:Tasks|任务): 5 \/ 6"/i);
        expect(html).toMatch(/class="status-activity-subagent-ratio[^"]*" title="(?:Subagents|子代理): 1 \/ 1" aria-label="(?:Subagents|子代理): 1 \/ 1"/i);
        expect(html).toContain('max-h-64');
        expect(html).toContain('overflow-y-auto');
        expect(html).toContain('npm test -- StatusPanel');
        expect(html).toContain('npm run build');
        expect(html).toContain('edit StatusPanel.tsx');
        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('spawn review agent');
        expect(html).toMatch(/title="Test: npm test -- StatusPanel · (?:Success|成功)"/i);
        expect(html).toMatch(/aria-label="Test: npm test -- StatusPanel · (?:Success|成功)"/i);
        expect(html).not.toContain('oldest hidden task');
        expect(html).toMatch(/Earlier tool tasks hidden from activity history: 1|活动历史中还有 1 个更早工具任务未显示/i);
        expect(html).toMatch(/class="status-activity-task-hidden-count[^"]*" title="(?:Earlier tool tasks hidden from activity history: 1|活动历史中还有 1 个更早工具任务未显示)" aria-label="(?:Earlier tool tasks hidden from activity history: 1|活动历史中还有 1 个更早工具任务未显示)"/i);
    });

    it('renders desktop task rows as transcript jump targets when a selector is provided', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('<button');
        expect(html).toContain('status-activity-task-row');
        expect(html).toContain('data-target-tool-id="tool-test"');
        expect(html).toMatch(/title="(?:Jump to tool task: |定位工具任务：)npm test -- StatusPanel"/i);
        expect(html).toMatch(/aria-label="(?:Jump to tool task: |定位工具任务：)npm test -- StatusPanel"/i);
        expect(html).not.toContain('disabled=""');
    });

    it('renders recent desktop subagent activity as transcript jump targets without mixing it into tasks', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-read',
                    type: 'read',
                    label: 'Read',
                    accentClass: 'accent-read',
                    summary: 'read src/App.tsx',
                    detail: 'src/App.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'agent-oldest',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'oldest hidden subagent',
                    detail: 'reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner · sonnet',
                    status: 'pending',
                },
            ],
            agentTools: [
                {
                    toolId: 'agent-oldest',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'oldest hidden subagent',
                    detail: 'reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner · sonnet',
                    status: 'pending',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 1,
            completedToolCount: 3,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
                onSelectTool={() => undefined}
            />,
        );

        expect(html).toContain('status-activity-task-list');
        expect(html).toContain('read src/App.tsx');
        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('write regression coverage');
        expect(html).toContain('review maintainability risks');
        expect(html).not.toContain('oldest hidden subagent');
        expect(html).toContain('data-target-tool-id="agent-test"');
        expect(html).toContain('data-target-tool-id="agent-review"');
        expect(html).toMatch(/class="status-activity-task-ratio[^"]*" title="(?:Tasks|任务): 1 \/ 1" aria-label="(?:Tasks|任务): 1 \/ 1"/i);
        expect(html).toMatch(/class="status-activity-subagent-ratio[^"]*" title="(?:Subagents|子代理): 2 \/ 3" aria-label="(?:Subagents|子代理): 2 \/ 3"/i);
        expect(html).toMatch(/title="(?:Jump to subagent activity: |定位子代理活动：)write regression coverage"/i);
        expect(html).toMatch(/aria-label="(?:Jump to subagent activity: |定位子代理活动：)write regression coverage"/i);
        expect(html).toMatch(/title="Task: write regression coverage · (?:Pending|等待中)"/i);
        expect(html).toMatch(/aria-label="Task: write regression coverage · (?:Pending|等待中)"/i);
        expect(html).not.toMatch(/aria-label="(?:Jump to tool task: |定位工具任务：)write regression coverage"/i);
        expect(html).toMatch(/Earlier subagents hidden from activity history: 1|活动历史中还有 1 个更早子代理未显示/i);
        expect(html).toMatch(/class="status-activity-subagent-hidden-count[^"]*" title="(?:Earlier subagents hidden from activity history: 1|活动历史中还有 1 个更早子代理未显示)" aria-label="(?:Earlier subagents hidden from activity history: 1|活动历史中还有 1 个更早子代理未显示)"/i);
    });

    it('does not show the idle activity message when only subagent history is visible', () => {
        const statusSummary: ChatStatusSummary = {
            agentTools: [
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={24}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-activity-subagent-list');
        expect(html).toContain('review maintainability risks');
        expect(html).not.toMatch(/Idle|当前空闲/i);
    });

    it('falls back to readable desktop activity labels when i18n keys are unavailable', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'pending',
                },
                {
                    toolId: 'tool-build',
                    type: 'bash',
                    label: 'Build',
                    accentClass: 'accent-terminal',
                    summary: 'npm run build',
                    detail: 'type-check and bundle',
                    status: 'error',
                },
                {
                    toolId: 'tool-edit',
                    type: 'edit',
                    label: 'Edit',
                    accentClass: 'accent-edit',
                    summary: 'edit StatusPanel.tsx',
                    detail: 'src/components/chat/StatusPanel.tsx',
                    status: 'completed',
                },
            ],
            agentTools: [
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer · opus',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner · sonnet',
                    status: 'pending',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 2,
            completedToolCount: 2,
            errorToolCount: 1,
        };

        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={24}
                    daemonReady={false}
                    daemonStatus="paused externally"
                    statusSummary={statusSummary}
                    onSelectTool={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('Jump to tool task: npm test -- StatusPanel');
        expect(html).toContain('Jump to subagent activity: write regression coverage');
        expect(html).toContain('Pending');
        expect(html).toContain('Failed');
        expect(html).toContain('Success');
        expect(html).not.toContain('chat.layout.scrollToToolTask');
        expect(html).not.toContain('chat.layout.scrollToSubagentActivity');
        expect(html).not.toContain('tools.pending');
        expect(html).not.toContain('tools.failed');
        expect(html).not.toContain('common.success');
    });

    it('falls back to readable desktop activity chrome when i18n keys are unavailable', () => {
        const statusSummary: ChatStatusSummary = {
            toolTimeline: [
                {
                    toolId: 'tool-oldest',
                    type: 'bash',
                    label: 'Bash',
                    accentClass: 'accent-terminal',
                    summary: 'oldest hidden task',
                    detail: 'first command',
                    status: 'completed',
                },
                {
                    toolId: 'tool-read',
                    type: 'read',
                    label: 'Read',
                    accentClass: 'accent-read',
                    summary: 'read src/App.tsx',
                    detail: 'src/App.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-grep',
                    type: 'search',
                    label: 'Search',
                    accentClass: 'accent-search',
                    summary: 'grep StatusPanel',
                    detail: 'src/components/chat',
                    status: 'completed',
                },
                {
                    toolId: 'tool-edit',
                    type: 'edit',
                    label: 'Edit',
                    accentClass: 'accent-edit',
                    summary: 'edit StatusPanel.tsx',
                    detail: 'src/components/chat/StatusPanel.tsx',
                    status: 'completed',
                },
                {
                    toolId: 'tool-build',
                    type: 'bash',
                    label: 'Build',
                    accentClass: 'accent-terminal',
                    summary: 'npm run build',
                    detail: 'type-check and bundle',
                    status: 'completed',
                },
                {
                    toolId: 'tool-test',
                    type: 'bash',
                    label: 'Test',
                    accentClass: 'accent-terminal',
                    summary: 'npm test -- StatusPanel',
                    detail: 'targeted regression',
                    status: 'pending',
                },
            ],
            agentTools: [
                {
                    toolId: 'agent-oldest',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'oldest hidden subagent',
                    detail: 'reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-review',
                    type: 'agent',
                    label: 'Agent',
                    accentClass: 'accent-agent',
                    summary: 'review maintainability risks',
                    detail: 'code-reviewer',
                    status: 'completed',
                },
                {
                    toolId: 'agent-test',
                    type: 'agent',
                    label: 'Task',
                    accentClass: 'accent-agent',
                    summary: 'write regression coverage',
                    detail: 'test-runner',
                    status: 'pending',
                },
            ],
            recentEdits: [],
            allEdits: [],
            touchedFileCount: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            pendingToolCount: 2,
            completedToolCount: 7,
            errorToolCount: 1,
        };

        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={24}
                    daemonReady={false}
                    daemonStatus="paused externally"
                    statusSummary={statusSummary}
                    onSelectTool={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('Current activity');
        expect(html).toContain('Pending tools');
        expect(html).toContain('Failed tools');
        expect(html).toContain('Activity history');
        expect(html).toContain('Tasks');
        expect(html).toContain('Subagents');
        expect(html).toContain('1 earlier tool task hidden from activity history');
        expect(html).toContain('1 earlier subagent hidden from activity history');
        expect(html).not.toContain('chat.layout.currentActivity');
        expect(html).not.toContain('chat.layout.pendingTools');
        expect(html).not.toContain('chat.layout.errorTools');
        expect(html).not.toContain('chat.layout.activityHistoryRegion');
        expect(html).not.toContain('chat.layout.inputStatusTasks');
        expect(html).not.toContain('chat.layout.inputStatusSubagents');
        expect(html).not.toContain('chat.layout.inputStatusMoreTools');
        expect(html).not.toContain('chat.layout.inputStatusMoreSubagents');
        expect(html).not.toContain('chat.layout.activityHistoryMoreTools');
        expect(html).not.toContain('chat.layout.activityHistoryMoreSubagents');
    });

    it('falls back to readable transient activity and anchor labels when i18n keys are unavailable', () => {
        const streamingHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={24}
                    daemonReady
                    isStreaming
                    activeAnchorLabel="Refactor status panel labels"
                />
            </I18nextProvider>,
        );
        const idleHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={24}
                    daemonReady
                    statusSummary={{
                        recentEdits: [],
                        allEdits: [],
                        touchedFileCount: 0,
                        totalAdditions: 0,
                        totalDeletions: 0,
                        pendingToolCount: 1,
                        completedToolCount: 0,
                        errorToolCount: 0,
                    }}
                />
            </I18nextProvider>,
        );

        expect(streamingHtml).toContain('Streaming reply');
        expect(streamingHtml).toContain('Current message');
        expect(streamingHtml).toContain('Refactor status panel labels');
        expect(streamingHtml).toContain('title="Current message: Refactor status panel labels"');
        expect(streamingHtml).toContain('aria-label="Current message: Refactor status panel labels"');
        expect(streamingHtml).toContain(
            'class="status-active-anchor-value text-[11px] leading-tight text-base-content/60" title="Current message: Refactor status panel labels" aria-label="Current message: Refactor status panel labels"',
        );
        expect(idleHtml).toContain('Idle');
        expect(streamingHtml).not.toContain('chat.layout.streamingReply');
        expect(streamingHtml).not.toContain('chat.layout.currentAnchor');
        expect(idleHtml).not.toContain('chat.layout.idle');
    });

    it('omits the recent edits card when there are no edits to inspect', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
            />,
        );

        expect(html).not.toMatch(/Recent edits|最近改动/i);
        expect(html).not.toMatch(/No file edits to show yet|暂时没有可展示的文件改动/i);
        expect(html).not.toContain('status-edit-tree-scroll');
    });

    it('omits the current activity card while the chat is completely idle', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
            />,
        );

        expect(html).not.toMatch(/Current activity|当前活动/i);
        expect(html).not.toMatch(/Idle|当前空闲/i);
        expect(html).not.toContain('status-activity-tool-counts');
    });

    it('keeps the current activity card visible while a reply is streaming', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={18}
                daemonReady
                isStreaming
            />,
        );

        expect(html).toMatch(/Current activity|当前活动/i);
        expect(html).toMatch(/Streaming reply|正在生成回复|正在回复/i);
    });

    it('renders completed history session load metrics as a collapsed diagnostic entry', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'complete',
                        startedAt: 1000,
                        completedAt: 1161,
                        elapsedMs: 161,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: 5000,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: 50,
                        fullMapMs: 11,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toMatch(/class="[^"]*status-session-load-metrics[^"]*"[^>]+title="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 161ms · (?:Source|来源) · C:\/Users\/Administrator\/\.codex\/sessions\/session-1\.jsonl"[^>]+aria-label="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 161ms · (?:Source|来源) · C:\/Users\/Administrator\/\.codex\/sessions\/session-1\.jsonl"/i);
        expect(html).toMatch(/History load|历史加载/i);
        expect(html).toContain('5000');
        expect(html).toContain('120');
        expect(html).toContain('161ms');
        expect(html).toMatch(/class="[^"]*text-\[10px\][^"]*" title="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 161ms" aria-label="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 161ms"/i);
        expect(html).toMatch(/aria-label="(?:History load|历史加载): (?:Complete|完成)"/i);
        expect(html).not.toContain('status-session-load-details');
        expect(html).not.toContain('40ms');
        expect(html).not.toContain('50ms');
    });

    it('renders windowed history session load metrics as a ready collapsed entry', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'windowed',
                        startedAt: 1000,
                        completedAt: 1057,
                        elapsedMs: 57,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: null,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded=\"false\"');
        expect(html).toMatch(/aria-label=\"(?:Expand history load details|展开历史加载详情)\"/i);
        expect(html).toMatch(/Window ready|窗口就绪/i);
        expect(html).toContain('120');
        expect(html).toContain('5000');
        expect(html).toContain('57ms');
        expect(html).toMatch(/class="[^"]*text-\[10px\][^"]*" title="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 57ms" aria-label="(?:History load|历史加载): (?:Window first paint|窗口首屏) · 120 \/ 5000 · 57ms"/i);
        expect(html).not.toContain('status-session-load-details');
        expect(html).not.toMatch(/Loading|加载中/i);
    });

    it('auto-expands history session load metrics while loading or errored', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 120,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: false,
                        status: 'loading',
                        startedAt: 1000,
                        completedAt: null,
                        elapsedMs: null,
                        windowMessageCount: 120,
                        totalMessageCount: 5000,
                        fullMessageCount: null,
                        windowLoadMs: 40,
                        windowMapMs: 7,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toMatch(/aria-label=\"(?:Collapse history load details|收起历史加载详情)\"/i);
        expect(html).toContain('status-session-load-details');
        expect(html).toContain('40ms');
    });

    it('renders cache-hit history session load metrics without full-stage noise', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                {...({
                    provider: 'codex',
                    messageCount: 5000,
                    daemonReady: true,
                    sessionLoadMetrics: {
                        sessionKey: 'codex::session-1',
                        providerId: 'codex',
                        sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                        cacheHit: true,
                        status: 'complete',
                        startedAt: 2000,
                        completedAt: 2002,
                        elapsedMs: 2,
                        windowMessageCount: 0,
                        totalMessageCount: 5000,
                        fullMessageCount: 5000,
                        windowLoadMs: null,
                        windowMapMs: null,
                        fullLoadMs: null,
                        fullMapMs: null,
                        error: null,
                    },
                } as any)}
            />,
        );

        expect(html).toContain('status-session-load-metrics');
        expect(html).toMatch(/Cache hit|缓存命中/i);
        expect(html).toMatch(/class="[^"]*text-\[10px\][^"]*" title="(?:History load|历史加载): (?:Cache hit|缓存命中) · 5000 · 2ms" aria-label="(?:History load|历史加载): (?:Cache hit|缓存命中) · 5000 · 2ms"/i);
        expect(html).not.toContain('Full 0ms');
    });

    it('falls back to readable history session load labels when i18n keys are unavailable', () => {
        const windowHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    {...({
                        provider: 'codex',
                        messageCount: 120,
                        daemonReady: true,
                        sessionLoadMetrics: {
                            sessionKey: 'codex::session-1',
                            providerId: 'codex',
                            sourcePath: 'C:/Users/Administrator/.codex/sessions/session-1.jsonl',
                            cacheHit: false,
                            status: 'loading',
                            startedAt: 1000,
                            completedAt: null,
                            elapsedMs: 161,
                            windowMessageCount: 120,
                            totalMessageCount: 5000,
                            fullMessageCount: 5000,
                            windowLoadMs: 40,
                            windowMapMs: 7,
                            fullLoadMs: 50,
                            fullMapMs: 11,
                            error: null,
                        },
                    } as any)}
                />
            </I18nextProvider>,
        );
        const cacheHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    {...({
                        provider: 'codex',
                        messageCount: 5000,
                        daemonReady: true,
                        sessionLoadMetrics: {
                            sessionKey: 'codex::session-cache',
                            providerId: 'codex',
                            sourcePath: 'C:/Users/Administrator/.codex/sessions/session-cache.jsonl',
                            cacheHit: true,
                            status: 'error',
                            startedAt: 2000,
                            completedAt: null,
                            elapsedMs: 2,
                            windowMessageCount: 0,
                            totalMessageCount: 5000,
                            fullMessageCount: 5000,
                            windowLoadMs: null,
                            windowMapMs: null,
                            fullLoadMs: null,
                            fullMapMs: null,
                            error: 'Cache read failed',
                        },
                    } as any)}
                />
            </I18nextProvider>,
        );

        expect(windowHtml).toContain('History load');
        expect(windowHtml).toContain('Loading');
        expect(windowHtml).toContain('Window first paint');
        expect(windowHtml).toContain('Source');
        expect(windowHtml).toContain('Window');
        expect(windowHtml).toContain('Map 7ms');
        expect(windowHtml).toContain('Full');
        expect(windowHtml).toContain('Map 11ms');
        expect(windowHtml).toContain('Elapsed');
        expect(cacheHtml).toContain('History load');
        expect(cacheHtml).toContain('Load failed');
        expect(cacheHtml).toContain('Cache hit');
        expect(cacheHtml).toContain('Cache');
        expect(cacheHtml).toContain('Cache read failed');
        expect(windowHtml).toContain('title="History load: Window first paint · 120 / 5000 · 161ms · Source · C:/Users/Administrator/.codex/sessions/session-1.jsonl" aria-label="History load: Window first paint · 120 / 5000 · 161ms · Source · C:/Users/Administrator/.codex/sessions/session-1.jsonl"');
        expect(cacheHtml).toContain('title="History load: Cache hit · 5000 · 2ms · Source · C:/Users/Administrator/.codex/sessions/session-cache.jsonl" aria-label="History load: Cache hit · 5000 · 2ms · Source · C:/Users/Administrator/.codex/sessions/session-cache.jsonl"');
        expect(windowHtml).toContain('title="History load: Source · Window first paint" aria-label="History load: Source · Window first paint"');
        expect(windowHtml).toContain('title="History load: Window · 120 / 5000 · 40ms · Map 7ms" aria-label="History load: Window · 120 / 5000 · 40ms · Map 7ms"');
        expect(windowHtml).toContain('title="History load: Full · 5000 · 50ms · Map 11ms" aria-label="History load: Full · 5000 · 50ms · Map 11ms"');
        expect(windowHtml).toContain('title="History load: Elapsed · 161ms" aria-label="History load: Elapsed · 161ms"');
        expect(cacheHtml).toContain('title="History load: Source · Cache hit" aria-label="History load: Source · Cache hit"');
        expect(cacheHtml).toContain('title="History load: Cache · 5000 · 2ms" aria-label="History load: Cache · 5000 · 2ms"');
        expect(windowHtml).toContain('title="History load: Window first paint · 120 / 5000 · 161ms" aria-label="History load: Window first paint · 120 / 5000 · 161ms"');
        expect(cacheHtml).toContain('title="History load: Cache hit · 5000 · 2ms" aria-label="History load: Cache hit · 5000 · 2ms"');
        expect(windowHtml).toContain('aria-label="History load: Loading"');
        expect(cacheHtml).toContain('aria-label="History load: Load failed"');
        expect(cacheHtml).toContain('title="History load: Load failed · Cache read failed"');
        expect(cacheHtml).toContain('aria-label="History load: Load failed · Cache read failed"');
        [
            windowHtml,
            cacheHtml,
        ].forEach((html) => {
            expect(html).not.toContain('chat.layout.sessionLoadMetrics');
            expect(html).not.toContain('chat.layout.sessionLoadError');
            expect(html).not.toContain('chat.layout.sessionLoadLoading');
            expect(html).not.toContain('chat.layout.sessionLoadWindowed');
            expect(html).not.toContain('chat.layout.sessionLoadComplete');
            expect(html).not.toContain('chat.layout.sessionLoadCacheHit');
            expect(html).not.toContain('chat.layout.sessionLoadWindowFirstPaint');
            expect(html).not.toContain('chat.layout.sessionLoadSource');
            expect(html).not.toContain('chat.layout.sessionLoadCache');
            expect(html).not.toContain('chat.layout.sessionLoadWindow');
            expect(html).not.toContain('chat.layout.sessionLoadMapMs');
            expect(html).not.toContain('chat.layout.sessionLoadFull');
            expect(html).not.toContain('chat.layout.sessionLoadElapsed');
        });
    });

    it('renders recent edit diff hover previews from status summary data', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 1,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {
                            kind: 'removed',
                            text: 'old status row',
                            oldLineNumber: 12,
                        },
                        {
                            kind: 'added',
                            text: 'new status row',
                            newLineNumber: 12,
                        },
                    ],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 1,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 1,
            totalAdditions: 1,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-diff-trigger');
        expect(html).toContain('edit-diff-hover-preview');
        expect(html).toContain('old status row');
        expect(html).toContain('new status row');
        expect(html).toContain('src/components/chat/StatusPanel.tsx');
    });

    it('renders all-file edit totals even when the visible recent list is shorter', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit-latest',
                    displayPath: 'src/latest.ts',
                    openPath: 'src/latest.ts',
                    additions: 1,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit-latest',
                    displayPath: 'src/latest.ts',
                    openPath: 'src/latest.ts',
                    additions: 1,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden',
                    displayPath: 'src/hidden.ts',
                    openPath: 'src/hidden.ts',
                    additions: 11,
                    deletions: 3,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-2',
                    displayPath: 'src/hidden-2.ts',
                    openPath: 'src/hidden-2.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-3',
                    displayPath: 'src/hidden-3.ts',
                    openPath: 'src/hidden-3.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-4',
                    displayPath: 'src/hidden-4.ts',
                    openPath: 'src/hidden-4.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-hidden-5',
                    displayPath: 'src/hidden-5.ts',
                    openPath: 'src/hidden-5.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 6,
            totalAdditions: 12,
            totalDeletions: 3,
            pendingToolCount: 0,
            completedToolCount: 6,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={12}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toMatch(/6\s*(files|个文件)/);
        expect(html).toContain('+12 / -3');
        expect(html).toContain('src/latest.ts');
        expect(html).toMatch(/5\s*(more files|个文件)/);
        expect(html).not.toContain('src/hidden.ts');
    });

    it('falls back to readable recent edit chrome when i18n keys are unavailable', () => {
        const selectedEdit = {
            toolId: 'tool-edit-latest',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 3,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old label', oldLineNumber: 10},
                {kind: 'added' as const, text: 'new label', newLineNumber: 10},
            ],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [selectedEdit],
            allEdits: [
                selectedEdit,
                {
                    toolId: 'tool-edit-hidden',
                    displayPath: 'src/hidden.ts',
                    openPath: 'src/hidden.ts',
                    additions: 0,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 2,
            totalAdditions: 3,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 2,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={18}
                    daemonReady
                    statusSummary={statusSummary}
                    selectedEditKey={getChatStatusEditKey(selectedEdit)}
                    isDiffPaneCollapsed
                    onOpenDiffPanel={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('Recent edits');
        expect(html).toContain('2 files · +3 / -1');
        expect(html).toContain('title="2 files · +3 / -1"');
        expect(html).toContain('aria-label="2 files · +3 / -1"');
        expect(html).toContain('Collapse edit tree');
        expect(html).toContain('Diff view mode');
        expect(html).toContain('Unified diff view');
        expect(html).toContain('Split diff view');
        expect(html).toContain('Current full diff: src/components/chat/StatusPanel.tsx');
        expect(html).toContain('Open file: src/components/chat/StatusPanel.tsx');
        expect(html).toContain('Open diff review for src/components/chat/StatusPanel.tsx');
        expect(html).toContain('aria-label="src/components/chat/StatusPanel.tsx: Success"');
        expect(html).toContain('title="Edit stats: src/components/chat/StatusPanel.tsx · +3 / -1"');
        expect(html).toContain('aria-label="Edit stats: src/components/chat/StatusPanel.tsx · +3 / -1"');
        expect(html).toContain('1 more file not shown in this list');
        expect(html).toMatch(/title="1 more file not shown in this list"/i);
        expect(html).toMatch(/aria-label="1 more file not shown in this list"/i);
        expect(html).not.toMatch(/title="1 more file"/i);
        expect(html).not.toContain('chat.layout.recentEdits');
        expect(html).not.toContain('chat.layout.editSummary');
        expect(html).not.toContain('chat.layout.collapseEditTree');
        expect(html).not.toContain('chat.layout.diffViewMode');
        expect(html).not.toContain('chat.layout.diffUnifiedView');
        expect(html).not.toContain('chat.layout.diffSplitView');
        expect(html).not.toContain('chat.layout.inspectCurrentFullDiff');
        expect(html).not.toContain('tools.openFileForPath');
        expect(html).not.toContain('chat.layout.expandDiffPanelForFile');
        expect(html).not.toContain('chat.layout.hiddenEditFiles');
    });

    it('renders edit files as a scrollable tree with diff mode controls', () => {
        const statusSummary: ChatStatusSummary = {
            recentEdits: [
                {
                    toolId: 'tool-edit-a',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 2,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {kind: 'removed', text: 'old line', oldLineNumber: 1},
                        {kind: 'added', text: 'new line', newLineNumber: 1},
                    ],
                },
                {
                    toolId: 'tool-edit-b',
                    displayPath: 'src/components/chat/MessageList.tsx',
                    openPath: 'src/components/chat/MessageList.tsx',
                    additions: 3,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-c',
                    displayPath: 'src/utils/toolPresentation.ts',
                    openPath: 'src/utils/toolPresentation.ts',
                    additions: 4,
                    deletions: 2,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-d',
                    displayPath: 'src/styles/toolBlocks.css',
                    openPath: 'src/styles/toolBlocks.css',
                    additions: 1,
                    deletions: 5,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            allEdits: [
                {
                    toolId: 'tool-edit-a',
                    displayPath: 'src/components/chat/StatusPanel.tsx',
                    openPath: 'src/components/chat/StatusPanel.tsx',
                    additions: 2,
                    deletions: 1,
                    status: 'completed',
                    diffPreviewLines: [
                        {kind: 'removed', text: 'old line', oldLineNumber: 1},
                        {kind: 'added', text: 'new line', newLineNumber: 1},
                    ],
                },
                {
                    toolId: 'tool-edit-b',
                    displayPath: 'src/components/chat/MessageList.tsx',
                    openPath: 'src/components/chat/MessageList.tsx',
                    additions: 3,
                    deletions: 0,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-c',
                    displayPath: 'src/utils/toolPresentation.ts',
                    openPath: 'src/utils/toolPresentation.ts',
                    additions: 4,
                    deletions: 2,
                    status: 'completed',
                    diffPreviewLines: [],
                },
                {
                    toolId: 'tool-edit-d',
                    displayPath: 'src/styles/toolBlocks.css',
                    openPath: 'src/styles/toolBlocks.css',
                    additions: 1,
                    deletions: 5,
                    status: 'completed',
                    diffPreviewLines: [],
                },
            ],
            touchedFileCount: 4,
            totalAdditions: 10,
            totalDeletions: 8,
            pendingToolCount: 0,
            completedToolCount: 4,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-tree-scroll');
        expect(html).toContain('status-edit-tree-toggle');
        expect(html).toContain('status-diff-mode-toggle');
        expect(html).toContain('status-edit-tree-folder');
        expect(html).toContain('status-edit-tree-file');
        expect(html).toContain('src');
        expect(html).toContain('components');
        expect(html).toContain('toolPresentation.ts');
        expect(html).toMatch(/aria-label="(?:Collapse folder: |收起文件夹：)src"/i);
        expect(html).toMatch(/aria-label="src\/components\/chat\/StatusPanel\.tsx: (?:Success|成功)"/i);
        expect(html).toMatch(/title="(?:Edit stats: |编辑统计：)src · \+10 \/ -8"/i);
        expect(html).toMatch(/aria-label="(?:Edit stats: |编辑统计：)src · \+10 \/ -8"/i);
        expect(html).toMatch(/title="(?:Edit stats: |编辑统计：)src\/components\/chat\/StatusPanel\.tsx · \+2 \/ -1"/i);
        expect(html).toMatch(/aria-label="(?:Edit stats: |编辑统计：)src\/components\/chat\/StatusPanel\.tsx · \+2 \/ -1"/i);
        expect(html).toMatch(/split diff view|拆分差异视图/i);
    });

    it('collapses large edit trees to folder rows by default', () => {
        const edits = Array.from({length: 30}, (_, index) => ({
            toolId: `tool-edit-${index}`,
            displayPath: `src/features/chat/file-${index}.ts`,
            openPath: `src/features/chat/file-${index}.ts`,
            additions: index + 1,
            deletions: index % 3,
            status: 'completed' as const,
            diffPreviewLines: [],
        }));
        const statusSummary: ChatStatusSummary = {
            recentEdits: edits.slice(0, 4),
            allEdits: edits,
            touchedFileCount: edits.length,
            totalAdditions: edits.reduce((sum, edit) => sum + edit.additions, 0),
            totalDeletions: edits.reduce((sum, edit) => sum + edit.deletions, 0),
            pendingToolCount: 0,
            completedToolCount: edits.length,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={150}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        expect(html).toContain('status-edit-tree-folder');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('src');
        expect(html).toMatch(/aria-label="(?:Expand folder: |展开文件夹：)src"/i);
        expect(html).not.toContain('status-edit-tree-file');
        expect(html).not.toContain('file-0.ts');
    });

    it('marks the selected edit row for the central diff review pane', () => {
        const selectedEdit = {
            toolId: 'tool-edit-a',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old line', oldLineNumber: 1},
                {kind: 'added' as const, text: 'new line', newLineNumber: 1},
            ],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [selectedEdit],
            allEdits: [selectedEdit],
            touchedFileCount: 1,
            totalAdditions: 2,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
                selectedEditKey={getChatStatusEditKey(selectedEdit)}
                diffViewMode="split"
            />,
        );

        expect(html).toContain('status-edit-tree-file-selected');
        expect(html).toContain('aria-current="true"');
        expect(html).toMatch(/aria-label="(?:Current full diff: |当前完整差异：)src\/components\/chat\/StatusPanel\.tsx"/i);
        expect(html).toContain('status-edit-tree-open');
        expect(html).toMatch(/aria-label="(?:Open file: |打开文件：)src\/components\/chat\/StatusPanel\.tsx"/i);
        expect(html).toContain('edit-diff-hover-preview-split');
        expect(html).toContain('edit-diff-hover-preview-status');
    });

    it('associates status edit hover previews with their trigger rows', () => {
        const previewedEdit = {
            toolId: 'tool-edit-a',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old line', oldLineNumber: 1},
                {kind: 'added' as const, text: 'new line', newLineNumber: 1},
            ],
        };
        const editWithoutPreview = {
            toolId: 'tool-edit-b',
            displayPath: 'src/components/chat/MessageList.tsx',
            openPath: 'src/components/chat/MessageList.tsx',
            additions: 1,
            deletions: 0,
            status: 'completed' as const,
            diffPreviewLines: [],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [previewedEdit, editWithoutPreview],
            allEdits: [previewedEdit, editWithoutPreview],
            touchedFileCount: 2,
            totalAdditions: 3,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 2,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
            />,
        );

        const describedByMatch = html.match(/aria-describedby="([^"]+)"/);

        expect(describedByMatch).not.toBeNull();
        const tooltipId = describedByMatch?.[1] ?? '';
        expect(tooltipId).toMatch(/^status-edit-diff-preview-/);
        expect(html).toContain(`id="${tooltipId}"`);
        expect(html).toContain('role="tooltip"');
        expect((html.match(/aria-describedby=/g) ?? []).length).toBe(1);
        expect(html).toContain('MessageList.tsx');
    });

    it('renders an explicit reopen action when the central diff pane is collapsed without relying on selection', () => {
        const selectedEdit = {
            toolId: 'tool-edit-a',
            displayPath: 'src/components/chat/StatusPanel.tsx',
            openPath: 'src/components/chat/StatusPanel.tsx',
            additions: 2,
            deletions: 1,
            status: 'completed' as const,
            diffPreviewLines: [
                {kind: 'removed' as const, text: 'old line', oldLineNumber: 1},
                {kind: 'added' as const, text: 'new line', newLineNumber: 1},
            ],
        };
        const statusSummary: ChatStatusSummary = {
            recentEdits: [selectedEdit],
            allEdits: [selectedEdit],
            touchedFileCount: 1,
            totalAdditions: 2,
            totalDeletions: 1,
            pendingToolCount: 0,
            completedToolCount: 1,
            errorToolCount: 0,
        };

        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={18}
                daemonReady
                statusSummary={statusSummary}
                isDiffPaneCollapsed
                onOpenDiffPanel={() => undefined}
            />,
        );

        expect(html).toContain('status-diff-pane-reopen');
        expect(html).toContain('status-diff-pane-reopen-header');
        expect(html).toMatch(/aria-label="(?:Expand file diff panel: |展开文件差异面板：)src\/components\/chat\/StatusPanel\.tsx"/i);
    });

    it('renders daemon offline status with a manual reconnect action', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady={false}
                daemonStatus="shutdown"
                onReconnectDaemon={() => undefined}
            />,
        );

        expect(html).toContain('status-daemon-reconnect');
        expect(html).toMatch(/daemon offline|守护进程离线/i);
        expect(html).toMatch(/aria-label="(?:Daemon|守护进程): (?:Daemon offline|守护进程离线)"/i);
        expect(html).toMatch(/reconnect daemon|重新连接守护进程/i);
    });

    it('labels the disabled daemon reconnect action with its in-flight state', () => {
        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="claude"
                    messageCount={4}
                    daemonReady={false}
                    daemonStatus="shutdown"
                    daemonReconnecting
                    onReconnectDaemon={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('status-daemon-reconnect');
        expect(html).toContain('disabled=""');
        expect(html).toContain('animate-spin');
        expect(html).toMatch(/title="Reconnecting daemon"/i);
        expect(html).toMatch(/aria-label="Reconnecting daemon"/i);
        expect(html).not.toMatch(/aria-label="Reconnect daemon"/i);
    });

    it('renders daemon failure diagnostics next to the manual recovery path', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady={false}
                daemonStatus="error"
                daemonError="Error: node executable not found"
                onReconnectDaemon={() => undefined}
            />,
        );

        expect(html).toContain('status-daemon-diagnostic');
        expect(html).toContain('Error: node executable not found');
        expect(html).toMatch(/title="(?:Daemon|守护进程): (?:Daemon error|守护进程异常) · Error: node executable not found"/i);
        expect(html).toMatch(/aria-label="(?:Daemon|守护进程): (?:Daemon error|守护进程异常) · Error: node executable not found"/i);
        expect(html).toContain('status-daemon-reconnect');
    });

    it('renders MCP availability behind an explicit collapsed toggle for the active provider', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 5,
                    enabledServers: 2,
                    loading: false,
                    error: null,
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                        {id: 'browser', name: 'browser', enabled: false, transport: 'sse'},
                    ],
                }}
            />,
        );

        expect(html).toContain('status-mcp-summary');
        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toMatch(/aria-label="(?:Expand MCP details|展开 MCP 详情)"/i);
        expect(html).toMatch(/class="[^"]*status-mcp-summary[^"]*"[^>]+title="MCP: (?:2 \/ 5 available|2 \/ 5 可用)"[^>]+aria-label="MCP: (?:2 \/ 5 available|2 \/ 5 可用)"/i);
        expect(html).toMatch(/MCP/i);
        expect(html).toContain('2 / 5');
        expect(html).toMatch(/available|可用/i);
        expect(html).not.toContain('status-mcp-details');
        expect(html).not.toContain('filesystem');
        expect(html).not.toContain('browser');
    });

    it('renders MCP loading and error diagnostics without hiding configured counts', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="claude"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 4,
                    enabledServers: 1,
                    loading: true,
                    error: 'failed to load mcp config',
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                    ],
                }}
            />,
        );

        expect(html).toContain('status-mcp-summary');
        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toMatch(/aria-label="(?:Collapse MCP details|收起 MCP 详情)"/i);
        expect(html).toContain('status-mcp-details');
        expect(html).toContain('1 / 4');
        expect(html).toContain('failed to load mcp config');
        expect(html).toMatch(/title="MCP: (?:Configuration error|配置错误) · failed to load mcp config"/i);
        expect(html).toMatch(/aria-label="MCP: (?:Configuration error|配置错误) · failed to load mcp config"/i);
        expect(html).toMatch(/class="[^"]*status-mcp-summary[^"]*"[^>]+title="MCP: (?:Configuration error|配置错误) · failed to load mcp config"[^>]+aria-label="MCP: (?:Configuration error|配置错误) · failed to load mcp config"/i);
        expect(html).toMatch(/loading|正在加载/i);
        expect(html).toMatch(/class="[^"]*status-mcp-loading[^"]*"[^>]+title="MCP: (?:Loading MCP configuration|正在加载 MCP 配置)…"[^>]+aria-label="MCP: (?:Loading MCP configuration|正在加载 MCP 配置)…"/i);
        expect(html).toContain('filesystem');
    });

    it('renders user-triggered MCP connectivity checks and live results', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                provider="codex"
                messageCount={4}
                daemonReady
                mcpStatus={{
                    totalServers: 2,
                    enabledServers: 1,
                    loading: false,
                    error: null,
                    servers: [
                        {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                        {id: 'browser', name: 'browser', enabled: false, transport: 'sse'},
                    ],
                }}
                mcpConnectivity={{
                    checking: true,
                    checkedAt: 1710000000000,
                    error: 'live check timed out',
                    hasResults: true,
                    resultByServerId: {
                        filesystem: {
                            serverId: 'filesystem',
                            status: 'online',
                            message: 'Handshake complete',
                            latencyMs: 24,
                        },
                    },
                }}
                onCheckMcpConnectivity={() => undefined}
            />,
        );

        expect(html).toContain('status-mcp-toggle');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('status-mcp-details');
        expect(html).toContain('status-mcp-check');
        expect(html).toMatch(/class="status-mcp-check-hint min-w-0 text-\[10px\] leading-snug text-base-content\/45" title="MCP: (?:Run a live check for enabled MCP servers\.|手动检测已启用服务器连通性)" aria-label="MCP: (?:Run a live check for enabled MCP servers\.|手动检测已启用服务器连通性)"/i);
        expect(html).toMatch(/Checking|检测中/i);
        expect(html).toMatch(/aria-label="(?:Checking\.\.\.|检测中…)"/i);
        expect(html).toMatch(/title="(?:Checking\.\.\.|检测中…)"/i);
        expect(html).toMatch(/class="status-mcp-configured-server-count" title="(?:Configured servers|已配置服务器): 2" aria-label="(?:Configured servers|已配置服务器): 2"/i);
        expect(html).toContain('status-mcp-live-result');
        expect(html).toMatch(/Online|在线/i);
        expect(html).toContain('24ms');
        expect(html).toContain('class="flex-shrink-0" aria-hidden="true">24ms</span>');
        expect(html).toMatch(/title="(?:MCP server: filesystem|MCP 服务器：filesystem)" aria-label="(?:MCP server: filesystem|MCP 服务器：filesystem)"/i);
        expect(html).toMatch(/title="(?:MCP server transport: filesystem · stdio|MCP 服务器传输：filesystem · stdio)" aria-label="(?:MCP server transport: filesystem · stdio|MCP 服务器传输：filesystem · stdio)"/i);
        expect(html).toMatch(/title="(?:MCP server transport: browser · sse|MCP 服务器传输：browser · sse)" aria-label="(?:MCP server transport: browser · sse|MCP 服务器传输：browser · sse)"/i);
        expect(html).toMatch(/class="[^"]*status-mcp-live-result[^"]*"[^>]+title="filesystem: (?:Online|在线) · Handshake complete · 24ms"[^>]+aria-label="filesystem: (?:Online|在线) · Handshake complete · 24ms"/i);
        expect(html).toMatch(/aria-label="filesystem: (?:Online|在线) · Handshake complete · 24ms"/i);
        expect(html).toMatch(/aria-label="filesystem: (?:Enabled|已启用)"/i);
        expect(html).toMatch(/aria-label="browser: (?:Disabled|未启用)"/i);
        expect(html).toMatch(/title="MCP: (?:Live check failed|实时检查失败) · live check timed out"/i);
        expect(html).toMatch(/aria-label="MCP: (?:Live check failed|实时检查失败) · live check timed out"/i);
    });

    it('falls back to readable MCP labels when i18n keys are unavailable', () => {
        const html = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={4}
                    daemonReady
                    mcpStatus={{
                        totalServers: 2,
                        enabledServers: 1,
                        loading: true,
                        error: null,
                        servers: [
                            {id: 'filesystem', name: 'filesystem', enabled: true, transport: 'stdio'},
                            {id: 'browser', name: 'browser', enabled: false, transport: null},
                        ],
                    }}
                    mcpConnectivity={{
                        checking: true,
                        checkedAt: 1710000000000,
                        error: null,
                        hasResults: true,
                        resultByServerId: {
                            filesystem: {
                                serverId: 'filesystem',
                                status: 'online',
                                message: null,
                                latencyMs: 24,
                            },
                        },
                    }}
                    onCheckMcpConnectivity={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(html).toContain('MCP');
        expect(html).toContain('1 / 2 available');
        expect(html).toContain('class="status-mcp-summary col-span-2 rounded-md border border-base-300/70 bg-base-100/45 px-2 py-1.5 status-mcp-summary-expanded" title="MCP: 1 / 2 available" aria-label="MCP: 1 / 2 available"');
        expect(html).toContain('Loading MCP configuration...');
        expect(html).toContain('class="status-mcp-loading text-[10px] leading-snug text-base-content/45" title="MCP: Loading MCP configuration..." aria-label="MCP: Loading MCP configuration..."');
        expect(html).toContain('Configured servers');
        expect(html).toContain('class="status-mcp-configured-server-count" title="Configured servers: 2" aria-label="Configured servers: 2"');
        expect(html).toContain('Enabled');
        expect(html).toContain('Disabled');
        expect(html).toContain('Online');
        expect(html).toContain('24ms');
        expect(html).toContain('class="flex-shrink-0" aria-hidden="true">24ms</span>');
        expect(html).toContain('Checking...');
        expect(html).toContain('class="status-mcp-check-hint min-w-0 text-[10px] leading-snug text-base-content/45" title="MCP: Run a live check for enabled MCP servers." aria-label="MCP: Run a live check for enabled MCP servers."');
        expect(html).toContain('title="MCP server: filesystem" aria-label="MCP server: filesystem"');
        expect(html).toContain('title="MCP server: browser" aria-label="MCP server: browser"');
        expect(html).toContain('title="MCP server transport: filesystem · stdio" aria-label="MCP server transport: filesystem · stdio"');
        expect(html).toContain('aria-label="filesystem: Online · 24ms"');
        expect(html).toContain('aria-label="filesystem: Enabled"');
        expect(html).toContain('aria-label="browser: Disabled"');
        expect(html).not.toContain('chat.layout.mcpEnabledSummary');
        expect(html).not.toContain('chat.layout.mcpLoading');
        expect(html).not.toContain('chat.layout.mcpConfiguredServers');
        expect(html).not.toContain('chat.layout.mcpEnabled');
        expect(html).not.toContain('chat.layout.mcpDisabled');
        expect(html).not.toContain('chat.layout.mcpLiveOnline');
        expect(html).not.toContain('chat.layout.mcpLiveLatency');
        expect(html).not.toContain('chat.layout.mcpChecking');

        const emptyHtml = renderToStaticMarkup(
            <I18nextProvider i18n={createKeyOnlyI18n()}>
                <StatusPanel
                    provider="codex"
                    messageCount={4}
                    daemonReady
                    mcpStatus={{
                        totalServers: 0,
                        enabledServers: 0,
                        loading: false,
                        error: 'config unavailable',
                        servers: [],
                    }}
                    onCheckMcpConnectivity={() => undefined}
                />
            </I18nextProvider>,
        );

        expect(emptyHtml).toContain('No MCP servers configured');
        expect(emptyHtml).toContain('class="status-mcp-empty text-[10px] leading-snug text-base-content/45" title="MCP: No MCP servers configured" aria-label="MCP: No MCP servers configured"');
        expect(emptyHtml).toContain('class="status-mcp-check-hint min-w-0 text-[10px] leading-snug text-base-content/45" title="MCP: No enabled MCP servers to check." aria-label="MCP: No enabled MCP servers to check."');
        expect(emptyHtml).toContain('title="MCP: Configuration error · config unavailable"');
        expect(emptyHtml).toContain('aria-label="MCP: Configuration error · config unavailable"');
        expect(emptyHtml).toContain('class="status-mcp-summary col-span-2 rounded-md border border-base-300/70 bg-base-100/45 px-2 py-1.5 status-mcp-summary-expanded" title="MCP: Configuration error · config unavailable" aria-label="MCP: Configuration error · config unavailable"');
        expect(emptyHtml).not.toContain('chat.layout.mcpNoServers');
        expect(emptyHtml).not.toContain('chat.layout.mcpConfigurationError');
    });
});
