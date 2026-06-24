import {APP_COLORS, APP_LABELS, AppType} from '../../types/app';
import {BrandGlyphIcon} from '../common/BrandGlyphIcon';

interface ProviderIconProps {
    appType: AppType;
    size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
};

const glyphSizeMap = {
    sm: 14,
    md: 18,
    lg: 22,
};

const brandClassMap: Partial<Record<AppType, string>> = {
    claude: 'bg-orange-50 text-[#d97757] ring-orange-200 dark:bg-orange-500/10 dark:ring-orange-500/30',
    codex: 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
    gemini: 'bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
};

function GeminiGlyph({size}: {size: number}) {
    return (
        <svg
            aria-hidden="true"
            data-provider-brand-icon-glyph="gemini-sparkle"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12 2.75c.47 2.2 1.32 4.1 2.56 5.71 1.24 1.6 3.07 2.78 5.5 3.54-2.43.76-4.26 1.94-5.5 3.54-1.24 1.6-2.09 3.51-2.56 5.71-.47-2.2-1.32-4.1-2.56-5.71-1.24-1.6-3.07-2.78-5.5-3.54 2.43-.76 4.26-1.94 5.5-3.54C10.68 6.85 11.53 4.95 12 2.75Z"
                fill="url(#provider-gemini-gradient)"
            />
            <defs>
                <linearGradient
                    id="provider-gemini-gradient"
                    x1="4"
                    y1="20"
                    x2="20"
                    y2="4"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#2563EB" />
                    <stop offset="0.52" stopColor="#7C3AED" />
                    <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
            </defs>
        </svg>
    );
}

export default function ProviderIcon({ appType, size = 'md' }: ProviderIconProps) {
    const color = APP_COLORS[appType] || '#6B7280';
    const label = APP_LABELS[appType] || appType;
    const brandClass = brandClassMap[appType];
    const glyphSize = glyphSizeMap[size];

    if (brandClass) {
        return (
            <div
                aria-label={`${label} provider`}
                className={`${sizeMap[size]} rounded-full flex items-center justify-center shadow-sm shrink-0 ring-1 ${brandClass}`}
                data-provider-brand-icon={appType}
                title={label}
            >
                {appType === 'gemini'
                    ? <GeminiGlyph size={glyphSize} />
                    : (
                        <BrandGlyphIcon
                            glyph={appType === 'claude' ? 'claude-lobehub' : 'codex-openai'}
                            size={glyphSize}
                            colored={appType === 'claude'}
                            providerIcon
                        />
                    )
                }
            </div>
        );
    }

    return (
        <div
            className={`${sizeMap[size]} rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0`}
            style={{ backgroundColor: color }}
            title={label}
        >
            {label.charAt(0).toUpperCase()}
        </div>
    );
}
