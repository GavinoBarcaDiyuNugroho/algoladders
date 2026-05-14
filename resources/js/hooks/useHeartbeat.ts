import { useEffect } from 'react';

// Helper to get CSRF token from cookies (Laravel standard)
const getXsrfToken = () => {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : '';
};

const sendPing = (roomCode: string) => {
    fetch(`/rooms/${roomCode}/ping`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken()
        }
    }).catch(() => {});
};

export function useHeartbeat(roomCode: string, intervalMs: number = 10000) {
    useEffect(() => {
        if (!roomCode) return;

        // Send initial ping
        sendPing(roomCode);

        const interval = setInterval(() => {
            sendPing(roomCode);
        }, intervalMs);

        return () => clearInterval(interval);
    }, [roomCode, intervalMs]);
}
