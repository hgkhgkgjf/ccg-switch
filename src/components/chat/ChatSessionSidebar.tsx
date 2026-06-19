import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {invoke} from '@tauri-apps/api/core';
import {ChevronRight, Clock, FolderOpen, MessageSquare, Plus, RefreshCw, Search,} from 'lucide-react';
import {getSessionSelectionKey, type SessionMeta} from '../../types/session';
import {
    formatShortDate,
    getCachedProjectSessions,
    getSessionProviderLabel,
    getVisibleProjectSessions,
    normalizeProjectPathForCache,
    rememberProjectSessions,
    sessionTitle,
    shouldAcceptSessionListResponse,
    shouldIgnoreSessionClick,
    shouldShowSessionRefreshStatus,
    shouldSyncProjectFromCurrentCwd,
} from './chatSessionSidebarUtils';

interface ProjectInfo {
    name: string;
    path: string;
    session_count: number;
    last_active: string | null;
}

interface ChatSessionSidebarProps {
    activeSession: SessionMeta | null;
    currentCwd: string | null;
    pendingSessionKey: string | null;
    onSessionSelect: (session: SessionMeta) => void;
    onNewSession: (cwd?: string | null) => void;
}

export default function ChatSessionSidebar({
    activeSession,
    currentCwd,
    pendingSessionKey,
    onSessionSelect,
    onNewSession,
}: ChatSessionSidebarProps) {
    const {t} = useTranslation();
    const [projects, setProjects] = useState<ProjectInfo[]>([]);
    const [sessions, setSessions] = useState<SessionMeta[]>([]);
    const [sessionsProjectPath, setSessionsProjectPath] = useState<string | null>(currentCwd);
    const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(currentCwd);
    const [projectQuery, setProjectQuery] = useState('');
    const [sessionQuery, setSessionQuery] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const sessionCacheRef = useRef<Map<string, SessionMeta[]>>(new Map());
    const sessionRequestSeqRef = useRef(0);
    const sessionInFlightKeyRef = useRef<string | null>(null);
    const selectedProjectKeyRef = useRef(normalizeProjectPathForCache(currentCwd));
    const hasManualProjectSelectionRef = useRef(false);

    const loadProjects = useCallback(async () => {
        setLoadingProjects(true);
        try {
            const data = await invoke<ProjectInfo[]>('get_dashboard_projects');
            setProjects(data);
        } catch (error) {
            console.error('[ChatSessionSidebar] load projects failed:', error);
        } finally {
            setLoadingProjects(false);
        }
    }, []);

    const loadSessions = useCallback(async (
        projectPath: string,
        options: {clearOnMiss?: boolean; force?: boolean} = {},
    ) => {
        const projectCacheKey = normalizeProjectPathForCache(projectPath);
        const cached = getCachedProjectSessions(sessionCacheRef.current, projectPath, options.force);
        if (cached) {
            sessionRequestSeqRef.current += 1;
            sessionInFlightKeyRef.current = null;
            setLoadingSessions(false);
            setSessionsProjectPath(projectPath);
            setSessions(cached);
            return;
        }

        if (!options.force && projectCacheKey && sessionInFlightKeyRef.current === projectCacheKey) {
            return;
        }

        if (options.clearOnMiss) {
            setSessionsProjectPath(projectPath);
            setSessions([]);
        }

        const requestSeq = sessionRequestSeqRef.current + 1;
        sessionRequestSeqRef.current = requestSeq;
        sessionInFlightKeyRef.current = projectCacheKey;
        setLoadingSessions(true);
        try {
            const data = await invoke<SessionMeta[]>('list_sessions', {projectPath});
            if (!shouldAcceptSessionListResponse({
                requestSeq,
                latestRequestSeq: sessionRequestSeqRef.current,
                requestProjectPath: projectPath,
                selectedProjectPath: selectedProjectKeyRef.current,
            })) return;

            const supportedSessions = rememberProjectSessions(sessionCacheRef.current, projectPath, data);
            setSessionsProjectPath(projectPath);
            setSessions(supportedSessions);
        } catch (error) {
            if (!shouldAcceptSessionListResponse({
                requestSeq,
                latestRequestSeq: sessionRequestSeqRef.current,
                requestProjectPath: projectPath,
                selectedProjectPath: selectedProjectKeyRef.current,
            })) return;
            console.error('[ChatSessionSidebar] load sessions failed:', error);
            sessionCacheRef.current.delete(normalizeProjectPathForCache(projectPath));
            setSessionsProjectPath(projectPath);
            if (!options.force) {
                setSessions([]);
            }
        } finally {
            if (sessionRequestSeqRef.current === requestSeq) {
                sessionInFlightKeyRef.current = null;
                setLoadingSessions(false);
            }
        }
    }, []);

    useEffect(() => {
        selectedProjectKeyRef.current = normalizeProjectPathForCache(selectedProjectPath);
    }, [selectedProjectPath]);

    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        if (!currentCwd) return;
        const currentProjectKey = normalizeProjectPathForCache(currentCwd);
        const selectedProjectKey = normalizeProjectPathForCache(selectedProjectPath);
        const visibleSessions = getVisibleProjectSessions(sessions, selectedProjectPath, sessionsProjectPath);
        const cachedSessions = getCachedProjectSessions(sessionCacheRef.current, currentCwd);
        const shouldSync = shouldSyncProjectFromCurrentCwd({
            currentCwd,
            selectedProjectPath,
            hasManualProjectSelection: hasManualProjectSelectionRef.current,
            visibleSessionCount: visibleSessions.length,
            hasCachedCurrentProjectSessions: Boolean(cachedSessions),
        });

        if (!shouldSync) {
            if (currentProjectKey && currentProjectKey === selectedProjectKey) {
                hasManualProjectSelectionRef.current = false;
            }
            return;
        }

        hasManualProjectSelectionRef.current = false;
        selectedProjectKeyRef.current = currentProjectKey;
        setSelectedProjectPath(currentCwd);
        setSessionQuery('');
        void loadSessions(currentCwd, {clearOnMiss: true});
    }, [currentCwd, loadSessions, selectedProjectPath, sessions, sessionsProjectPath]);

    const filteredProjects = useMemo(() => {
        const query = projectQuery.trim().toLowerCase();
        if (!query) return projects;

        return projects.filter((project) => (
            project.name.toLowerCase().includes(query)
            || project.path.toLowerCase().includes(query)
        ));
    }, [projectQuery, projects]);

    const visibleSessions = useMemo(
        () => getVisibleProjectSessions(sessions, selectedProjectPath, sessionsProjectPath),
        [selectedProjectPath, sessions, sessionsProjectPath],
    );

    const filteredSessions = useMemo(() => {
        const query = sessionQuery.trim().toLowerCase();
        if (!query) return visibleSessions;

        return visibleSessions.filter((session) => (
            sessionTitle(session).toLowerCase().includes(query)
            || session.sessionId.toLowerCase().includes(query)
            || session.providerId.toLowerCase().includes(query)
        ));
    }, [sessionQuery, visibleSessions]);

    const activeSessionKey = activeSession ? getSessionSelectionKey(activeSession) : null;
    const showSessionRefreshStatus = shouldShowSessionRefreshStatus(loadingSessions, visibleSessions.length);

    const handleProjectSelect = (project: ProjectInfo) => {
        const nextProjectKey = normalizeProjectPathForCache(project.path);
        const selectedProjectKey = normalizeProjectPathForCache(selectedProjectPath);
        if (nextProjectKey === selectedProjectKey && visibleSessions.length > 0) {
            return;
        }

        hasManualProjectSelectionRef.current = true;
        selectedProjectKeyRef.current = nextProjectKey;
        setSelectedProjectPath(project.path);
        setSessionQuery('');
        void loadSessions(project.path, {clearOnMiss: true});
    };

    const handleNewSession = () => {
        onNewSession(selectedProjectPath ?? currentCwd);
    };

    const handleRefreshSessions = () => {
        if (!selectedProjectPath) return;
        void loadSessions(selectedProjectPath, {force: true});
    };

    const handleSessionSelect = (session: SessionMeta) => {
        if (shouldIgnoreSessionClick(session, activeSessionKey, pendingSessionKey)) {
            return;
        }
        onSessionSelect(session);
    };

    return (
        <aside className="hidden w-72 shrink-0 border-r border-base-300 bg-base-100/80 lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                    <MessageSquare size={15}/>
                    {t('chat.sessionPanel.title')}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={() => void loadProjects()}
                        title={t('common.refresh')}
                        disabled={loadingProjects}
                    >
                        <RefreshCw size={14} className={loadingProjects ? 'animate-spin' : ''}/>
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-xs btn-square"
                        onClick={handleNewSession}
                        title={t('chat.sessionPanel.newChat')}
                    >
                        <Plus size={14}/>
                    </button>
                </div>
            </div>

            <div className="border-b border-base-300 p-2">
                <label className="relative block">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/35"/>
                    <input
                        type="text"
                        value={projectQuery}
                        onChange={(event) => setProjectQuery(event.target.value)}
                        placeholder={t('chat.sessionPanel.searchProjects')}
                        className="input input-bordered input-xs w-full pl-7 text-xs"
                    />
                </label>
            </div>

            <div className="min-h-0 flex-1">
                <div className="flex h-full min-h-0 flex-col">
                    <section className="min-h-0 basis-2/5 overflow-y-auto border-b border-base-300 pb-2">
                        <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-base-content/35">
                            {t('chat.sessionPanel.projects')}
                        </div>

                        {loadingProjects ? (
                            <div className="flex items-center justify-center py-6 text-base-content/40">
                                <RefreshCw size={16} className="animate-spin"/>
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="px-3 py-5 text-center text-xs text-base-content/40">
                                {t('chat.sessionPanel.noProjects')}
                            </div>
                        ) : (
                            <div className="space-y-0.5 px-2">
                                {filteredProjects.map((project) => {
                                    const selected = normalizeProjectPathForCache(selectedProjectPath)
                                        === normalizeProjectPathForCache(project.path);
                                    return (
                                        <button
                                            key={project.path}
                                            type="button"
                                            onClick={() => handleProjectSelect(project)}
                                            className={`w-full rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                                                selected
                                                    ? 'border-primary/25 bg-primary/10 text-base-content'
                                                    : 'border-transparent hover:bg-base-200/80'
                                            }`}
                                            title={project.path}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FolderOpen size={14} className={selected ? 'text-primary' : 'text-base-content/40'}/>
                                                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                                    {project.name}
                                                </span>
                                                <ChevronRight size={13} className={selected ? 'text-primary' : 'text-base-content/25'}/>
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-1 pl-5 text-[11px] text-base-content/40">
                                                <Clock size={11}/>
                                                <span>{t('chat.sessionPanel.projectSessionCount', {count: project.session_count})}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="min-h-0 flex-1 overflow-y-auto">
                        <div className="flex items-center justify-between px-2 pb-1 pt-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/35">
                                {t('chat.sessionPanel.sessions')}
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={handleRefreshSessions}
                                title={t('common.refresh')}
                                disabled={!selectedProjectPath || loadingSessions}
                            >
                                <RefreshCw size={13} className={loadingSessions ? 'animate-spin' : ''}/>
                            </button>
                        </div>

                        {!selectedProjectPath ? (
                            <div className="px-3 py-5 text-center text-xs text-base-content/40">
                                {t('chat.sessionPanel.selectProject')}
                            </div>
                        ) : loadingSessions && visibleSessions.length === 0 ? (
                            <div className="flex items-center justify-center py-6 text-base-content/40">
                                <RefreshCw size={16} className="animate-spin"/>
                            </div>
                        ) : visibleSessions.length === 0 ? (
                            <div className="px-3 py-5 text-center text-xs text-base-content/40">
                                {t('chat.sessionPanel.noSessions')}
                            </div>
                        ) : (
                            <div className="pb-3">
                                {showSessionRefreshStatus && (
                                    <div
                                        className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-base-300 bg-base-200/45 px-2 py-1.5 text-[11px] text-base-content/45"
                                        role="status"
                                    >
                                        <RefreshCw size={12} className="animate-spin text-primary/70"/>
                                        <span className="min-w-0 flex-1 truncate">
                                            {t('chat.sessionPanel.refreshingSessions')}
                                        </span>
                                    </div>
                                )}
                                <div className="px-2 pb-2">
                                    <label className="relative block">
                                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/35"/>
                                        <input
                                            type="text"
                                            value={sessionQuery}
                                            onChange={(event) => setSessionQuery(event.target.value)}
                                            placeholder={t('chat.sessionPanel.searchSessions')}
                                            className="input input-bordered input-xs w-full pl-7 text-xs"
                                        />
                                    </label>
                                </div>

                                {filteredSessions.length === 0 ? (
                                    <div className="px-3 py-5 text-center text-xs text-base-content/40">
                                        {t('chat.sessionPanel.noMatchingSessions')}
                                    </div>
                                ) : (
                                    <div className="space-y-0.5 px-2">
                                        {filteredSessions.map((session) => {
                                            const sessionKey = getSessionSelectionKey(session);
                                            const isPending = pendingSessionKey === sessionKey;
                                            const isActive = activeSessionKey === sessionKey;
                                            const selected = isPending || (!pendingSessionKey && isActive);
                                            const providerLabel = getSessionProviderLabel(t, session.providerId);
                                            return (
                                                <button
                                                    key={sessionKey}
                                                    type="button"
                                                    onClick={() => handleSessionSelect(session)}
                                                    className={`w-full rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                                                        selected
                                                            ? 'border-primary/25 bg-primary/10 text-base-content shadow-[inset_0_0_0_1px_rgba(59,130,246,0.05)]'
                                                            : 'border-transparent hover:bg-base-200/80'
                                                    }`}
                                                    title={isPending ? t('common.loading') : session.sessionId}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isPending ? (
                                                            <RefreshCw size={14} className="animate-spin text-primary"/>
                                                        ) : (
                                                            <MessageSquare size={14} className={selected ? 'text-primary' : 'text-base-content/40'}/>
                                                        )}
                                                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                                            {sessionTitle(session)}
                                                        </span>
                                                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                                                            selected
                                                                ? 'bg-primary/12 text-primary/80'
                                                                : 'bg-base-200 text-base-content/50'
                                                        }`}>
                                                            {providerLabel}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1 pl-5 text-[11px] text-base-content/40">
                                                        {isPending && (
                                                            <>
                                                                <span className="shrink-0 text-primary/80">{t('common.loading')}</span>
                                                                <span className="shrink-0">·</span>
                                                            </>
                                                        )}
                                                        {session.summary?.trim() && session.summary.trim() !== sessionTitle(session) ? (
                                                            <span className="min-w-0 flex-1 truncate">
                                                                {session.summary.trim()}
                                                            </span>
                                                        ) : (
                                                            <span className="min-w-0 flex-1 truncate font-mono">
                                                                {session.sessionId}
                                                            </span>
                                                        )}
                                                        <span className="shrink-0">·</span>
                                                        <span className="shrink-0">{formatShortDate(session.lastActiveAt)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </aside>
    );
}
