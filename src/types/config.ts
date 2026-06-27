export type SidebarPosition = 'left' | 'right' | 'top';
export type TerminalType = 'cmd' | 'powershell' | 'wt' | 'terminal' | 'iterm' | 'warp' | 'xterm' | 'gnome-terminal' | 'konsole';

export interface Config {
    theme: 'light' | 'dark';
    language: 'en' | 'zh';
    sidebarPosition: SidebarPosition;
    preferredTerminal: TerminalType;
    autoCheckUpdate?: boolean;
    checkUpdateIntervalHours?: number;
    /** When enabled, the chat daemon runs verbosely and the debug log panel is shown. */
    debugMode?: boolean;
}

export interface ApiConfig {
    name: string;
    token: string;
    url: string;
    model: string;
    customParams?: Record<string, any>;
}
