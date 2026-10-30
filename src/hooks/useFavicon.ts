import { useEffect } from 'react';

const FAVICONS = {
    default: {
        svg: `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234f46e5%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M12 2v20%22/><path d=%22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6%22/></svg>`,
        png: '/favicon.png',
        appleTouchIcon: '/apple-touch-icon.png',
        title: 'Financial Telemetry Dashboard'
    },
    admin: {
        svg: `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234f46e5%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><circle cx=%2212%22 cy=%2212%22 r=%223%22/></svg>`,
        png: '/admin-favicon.svg',
        appleTouchIcon: '/admin-apple-touch-icon.png',
        title: 'Admin Control Center'
    }
};

type FaviconType = keyof typeof FAVICONS;

export function useFavicon(type: FaviconType = 'default') {
    useEffect(() => {
        const favicon = FAVICONS[type] || FAVICONS.default;
        document.title = favicon.title;
    }, [type]);
}

export default useFavicon;
