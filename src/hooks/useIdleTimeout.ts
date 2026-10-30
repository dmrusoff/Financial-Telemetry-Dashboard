import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimeoutOptions {
    /** Timeout duration in milliseconds (default: 15 minutes) */
    timeout?: number;
    /** Callback function when user becomes idle */
    onIdle: () => void;
    /** Whether the timeout is enabled (default: true) */
    enabled?: boolean;
    /** Events to track for activity (default: common user interactions) */
    events?: string[];
}

const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const DEFAULT_EVENTS = [
    'mousedown',
    'mousemove',
    'keypress',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'wheel',
];

/**
 * Hook to detect user inactivity and trigger a callback (e.g., logout)
 * Follows OWASP recommendations for financial application security
 */
export const useIdleTimeout = ({
    timeout = DEFAULT_TIMEOUT,
    onIdle,
    enabled = true,
    events = DEFAULT_EVENTS,
}: UseIdleTimeoutOptions) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onIdleRef = useRef(onIdle);

    // Keep the callback ref updated
    useEffect(() => {
        onIdleRef.current = onIdle;
    }, [onIdle]);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (enabled) {
            timeoutRef.current = setTimeout(() => {
                onIdleRef.current();
            }, timeout);
        }
    }, [timeout, enabled]);

    useEffect(() => {
        if (!enabled) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            return;
        }

        // Add event listeners for user activity
        const handleActivity = () => {
            resetTimer();
        };

        events.forEach((event) => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        // Also reset on visibility change (user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                resetTimer();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start the timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach((event) => {
                document.removeEventListener(event, handleActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, events, resetTimer]);

    return { resetTimer };
};

export default useIdleTimeout;
