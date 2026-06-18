import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {invoke} from '@tauri-apps/api/core';
import {ChevronRight, Clock, FolderOpen, MessageSquare, Plus, RefreshCw, Search,} from 'lucide-react';
import {getSessionSelectionKey, type SessionMeta} from '../../types/session';
import {formatShortDate, getSessionProviderLabel, sessionTitle} from './chatSessionSidebarUtils';

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

function isSupportedChatProvider(providerId: string): boolean {
    return providerId === 'claude' || providerId === 'codex';
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
    const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(currentCwd);
    const [projectQuery, setProjectQuery] = useState('');
    const [sessionQuery, setSessionQuery] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(false);

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

    const loadSessions = useCallback(async (projectPath: string) => {
        setLoadingSessions(true);
        try {
            const data = await invoke<SessionMeta[]>('list_sessions', {projectPath});
            setSessions(data.filter((session) => isSupportedChatProvider(session.providerId)));
        } catch (error) {
            console.error('[ChatSessionSidebar] load sessions failed:', error);
            setSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        if (!currentCwd) return;
        setSelectedProjectPath(currentCwd);
        setSessionQuery('');
        void loadSessions(currentCwd);
    }, [currentCwd, loadSessions]);

    const filteredProjects = useMemo(() => {
        const query = projectQuery.trim().toLowerCase();
        if (!query) return projects;

        return projects.filter((project) => (
            project.name.toLowerCase().includes(query)
            || project.path.toLowerCase().includes(query)
        ));
    }, [projectQuery, projects]);

    const filteredSessions = useMemo(() => {
        const query = sessionQuery.trim().toLowerCase();
        if (!query) return sessions;

        return sessions.filter((session) => (
            sessionTitle(session).toLowerCase().includes(query)
            || session.sessionId.toLowerCase().includes(query)
            || session.providerId.toLowerCase().includes(query)
        ));
    }, [sessionQuery, sessions]);

    const activeSessionKey = activeSession ? getSessionSelectionKey(activeSession) : null;

    const handleProjectSelect = (project: ProjectInfo) => {
        setSelectedProjectPath(project.path);
        setSessionQuery('');
        void loadSessions(project.path);
    };

    const handleNewSession = () => {
        onNewSession(selectedProjectPath ?? currentCwd);
    };

    const handleRefreshSessions = () => {
        if (!selectedProjectPath) return;
        void loadSessions(selectedProjectPath);
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
                                    const selected = selectedProjectPath === project.path;
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
                        ) : loadingSessions && sessions.length === 0 ? (
                            <div className="flex items-center justify-center py-6 text-base-content/40">
                                <RefreshCw size={16} className="animate-spin"/>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="px-3 py-5 text-center text-xs text-base-content/40">
                                {t('chat.sessionPanel.noSessions')}
                            </div>
                        ) : (
                            <div className="pb-3">
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

                                {loadingSessions ? (
                                    <div className="flex items-center justify-center py-6 text-base-content/40">
                                        <RefreshCw size={16} className="animate-spin"/>
                                    </div>
                                ) : filteredSessions.length === 0 ? (
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
                                                    onClick={() => onSessionSelect(session)}
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
