import type {SessionMeta} from '../../types/session';
import {getSessionSelectionKey} from '../../types/session';
import {shouldIgnoreChatSessionSelection} from '../../utils/chatUiBehavior';

export type SessionCache = Map<string, SessionMeta[]>;

export interface ChatSessionProjectInfo {
    name: string;
    path: string;
    session_count: number;
    last_active: string | null;
}

export interface RecentChatProjectGroup {
    projectName: string;
    projectPath: string;
    sessions: SessionMeta[];
}

interface SessionListResponseOwnership {
    requestSeq: number;
    latestRequestSeq: number;
    requestProjectPath: string | null | undefined;
    selectedProjectPath: string | null | undefined;
}

export function normalizeProjectPathForCache(projectPath: string | null | undefined): string {
    if (!projectPath) return '';
    return projectPath
        .trim()
        .replace(/\\/g, '/')
        .replace(/\/+$/g, '')
        .toLowerCase();
}

export function isSupportedChatProvider(providerId: string): boolean {
    return providerId === 'claude' || providerId === 'codex';
}

export function filterSupportedChatSessions(sessions: SessionMeta[]): SessionMeta[] {
    return sessions.filter((session) => isSupportedChatProvider(session.providerId));
}

function isSessionInProject(session: SessionMeta, projectPath: string): boolean {
    const projectKey = normalizeProjectPathForCache(projectPath);
    const sessionProjectKey = normalizeProjectPathForCache(session.projectDir);
    return !projectKey || !sessionProjectKey || sessionProjectKey === projectKey;
}

export function filterProjectChatSessions(sessions: SessionMeta[], projectPath: string): SessionMeta[] {
    return filterSupportedChatSessions(sessions).filter((session) => isSessionInProject(session, projectPath));
}

export function getVisibleProjectSessions(
    sessions: SessionMeta[],
    selectedProjectPath: string | null | undefined,
    sessionsProjectPath: string | null | undefined,
): SessionMeta[] {
    const selectedProjectKey = normalizeProjectPathForCache(selectedProjectPath);
    if (!selectedProjectKey) return [];

    const sessionsProjectKey = normalizeProjectPathForCache(sessionsProjectPath);
    if (sessionsProjectKey !== selectedProjectKey) return [];

    return filterProjectChatSessions(sessions, selectedProjectPath ?? '');
}

export function getCachedProjectSessions(
    cache: SessionCache,
    projectPath: string,
    force = false,
): SessionMeta[] | null {
    if (force) return null;
    return cache.get(normalizeProjectPathForCache(projectPath)) ?? null;
}

export function shouldAcceptSessionListResponse({
    requestSeq,
    latestRequestSeq,
    requestProjectPath,
    selectedProjectPath,
}: SessionListResponseOwnership): boolean {
    if (requestSeq !== latestRequestSeq) return false;

    const requestProjectKey = normalizeProjectPathForCache(requestProjectPath);
    const selectedProjectKey = normalizeProjectPathForCache(selectedProjectPath);
    return Boolean(requestProjectKey && selectedProjectKey && requestProjectKey === selectedProjectKey);
}

interface ShouldSyncProjectFromCurrentCwdOptions {
    currentCwd: string | null | undefined;
    selectedProjectPath: string | null | undefined;
    hasManualProjectSelection: boolean;
    visibleSessionCount: number;
    hasCachedCurrentProjectSessions: boolean;
}

export function shouldSyncProjectFromCurrentCwd({
    currentCwd,
    selectedProjectPath,
    hasManualProjectSelection,
    visibleSessionCount,
    hasCachedCurrentProjectSessions,
}: ShouldSyncProjectFromCurrentCwdOptions): boolean {
    const currentProjectKey = normalizeProjectPathForCache(currentCwd);
    if (!currentProjectKey) return false;

    const selectedProjectKey = normalizeProjectPathForCache(selectedProjectPath);
    if (hasManualProjectSelection && selectedProjectKey && selectedProjectKey !== currentProjectKey) {
        return false;
    }

    if (
        currentProjectKey === selectedProjectKey
        && (visibleSessionCount > 0 || hasCachedCurrentProjectSessions)
    ) {
        return false;
    }

    return true;
}

export function rememberProjectSessions(
    cache: SessionCache,
    projectPath: string,
    sessions: SessionMeta[],
): SessionMeta[] {
    const supportedSessions = filterProjectChatSessions(sessions, projectPath);
    const projectCacheKey = normalizeProjectPathForCache(projectPath);
    const cacheKeys = new Set([projectCacheKey]);
    supportedSessions.forEach((session) => {
        const projectDirKey = normalizeProjectPathForCache(session.projectDir);
        if (projectDirKey && projectDirKey === projectCacheKey) {
            cacheKeys.add(projectDirKey);
        }
    });

    cacheKeys.forEach((cacheKey) => {
        if (cacheKey) {
            cache.set(cacheKey, supportedSessions);
        }
    });
    return supportedSessions;
}

export function shouldIgnoreSessionClick(
    session: Pick<SessionMeta, 'providerId' | 'sourcePath'>,
    activeSessionKey: string | null,
    pendingSessionKey: string | null,
): boolean {
    const sessionKey = getSessionSelectionKey(session);
    return shouldIgnoreChatSessionSelection({
        sessionKey,
        activeSessionKey,
        pendingSessionKey,
    });
}

export function shouldShowSessionRefreshStatus(loadingSessions: boolean, visibleSessionCount: number): boolean {
    return loadingSessions && visibleSessionCount > 0;
}

export function buildRecentChatProjectGroups({
    projects,
    sessionsByProject,
    limitPerProject = 5,
    recentSince,
}: {
    projects: ChatSessionProjectInfo[];
    sessionsByProject: SessionCache;
    limitPerProject?: number;
    recentSince?: number;
}): RecentChatProjectGroup[] {
    const safeLimit = Math.max(1, Math.floor(limitPerProject));
    const safeRecentSince = typeof recentSince === 'number' && Number.isFinite(recentSince)
        ? recentSince
        : null;

    return projects
        .map((project) => {
            const projectKey = normalizeProjectPathForCache(project.path);
            const sessions = (sessionsByProject.get(projectKey) ?? [])
                .filter((session) => isSupportedChatProvider(session.providerId))
                .filter((session) => isSessionInProject(session, project.path))
                .filter((session) => !session.archived)
                .filter((session) => safeRecentSince === null || session.lastActiveAt >= safeRecentSince)
                .slice()
                .sort((left, right) => {
                    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
                        return left.pinned ? -1 : 1;
                    }
                    return right.lastActiveAt - left.lastActiveAt;
                })
                .slice(0, safeLimit);

            return {
                projectName: project.name,
                projectPath: project.path,
                sessions,
            };
        })
        .filter((group) => group.sessions.length > 0);
}

export function formatShortDate(value: number | string | null): string {
    if (value === null) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function shortSessionId(sessionId: string): string {
    return sessionId.length <= 16
        ? sessionId
        : `${sessionId.slice(0, 7)}...${sessionId.slice(-5)}`;
}

export function sessionTitle(session: Pick<SessionMeta, 'sessionId' | 'title' | 'summary'>): string {
    const title = session.title?.trim();
    if (title) return title;

    const summary = session.summary?.trim();
    if (summary) return summary;

    return shortSessionId(session.sessionId);
}

export function getSessionProviderLabel(
    t: (key: string) => string,
    providerId: string,
): string {
    const normalized = providerId.trim().toLowerCase();
    const translated = t(`history.provider_${normalized}`);
    if (translated !== `history.provider_${normalized}`) {
        return translated;
    }

    return normalized
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
