import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Leaderboard features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface ScoreEntry {
    event_id: string;
    email: string;
    nickname: string;
    score: number;
}

export interface LeaderboardEntry {
    rank: number;
    nickname: string;
    score: number;
}

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), ms);
    });
    return Promise.race([promise, timeout]);
}

export async function submitScore(entry: ScoreEntry): Promise<{ success: boolean; error?: string }> {
    // Log payload (without email for privacy)
    console.log('submitScore called with:', {
        event_id: entry.event_id,
        nickname: entry.nickname,
        score: entry.score
    });

    if (!supabase) {
        console.log('submitScore: Supabase not configured');
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Use RPC to submit best score only (updates if higher, ignores if lower)
        const rpcPromise = supabase
            .rpc('submit_score_best', {
                event_id_param: entry.event_id,
                email_param: entry.email,
                nickname_param: entry.nickname,
                score_param: entry.score
            });

        const { data, error } = await withTimeout(
            rpcPromise,
            10000,
            'Submit timed out. Check connection and try again.'
        );

        // Log the response
        console.log('submitScore response:', { data, error });

        if (error) {
            console.error('Error submitting score:', error);
            return { success: false, error: error.message };
        }

        console.log('submitScore: Success');
        return { success: true };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit score';
        console.error('submitScore exception:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

export interface LinkClickEntry {
    event_id: string;
    email: string;
    link_key: string;
}

/**
 * Track a link click to Supabase using sendBeacon (preferred) or fetch with keepalive.
 * This is fire-and-forget - it does NOT block navigation.
 */
export function trackLinkClick(entry: LinkClickEntry): void {
    if (!supabase) {
        console.log('trackLinkClick: Supabase not configured');
        return;
    }

    const payload = {
        event_id: entry.event_id,
        email: entry.email,
        link_key: entry.link_key,
        clicked_at: new Date().toISOString()
    };

    console.log('trackLinkClick:', { event_id: entry.event_id, link_key: entry.link_key });

    // Build the Supabase REST API URL for the link_clicks table
    const url = `${supabaseUrl}/rest/v1/link_clicks`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey!,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Prefer': 'return=minimal'
    };

    const body = JSON.stringify(payload);

    // Try sendBeacon first (most reliable for navigation scenarios)
    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        // sendBeacon doesn't support custom headers, so we use fetch with keepalive as primary
        // but we'll try a different approach: use fetch with keepalive
    }

    // Use fetch with keepalive (works even when navigating away)
    try {
        fetch(url, {
            method: 'POST',
            headers,
            body,
            keepalive: true
        }).catch(err => {
            console.error('trackLinkClick fetch error:', err);
        });
    } catch (err) {
        console.error('trackLinkClick exception:', err);
        // Last resort: try supabase client insert (may not complete if navigating)
        supabase.from('link_clicks').insert(payload).then(
            () => console.log('trackLinkClick fallback succeeded'),
            (e) => console.error('trackLinkClick fallback failed:', e)
        );
    }
}

/**
 * Get click count for a specific link and event from Supabase.
 */
export async function getClickCount(eventId: string, linkKey: string): Promise<{ count: number | null; error?: string }> {
    console.log('getClickCount called with:', { eventId, linkKey });

    if (!supabase) {
        console.log('getClickCount: Supabase not configured');
        return { count: null, error: 'Supabase not configured' };
    }

    try {
        const rpcPromise = supabase
            .rpc('get_click_count', {
                event_id_param: eventId,
                link_key_param: linkKey
            });

        const { data, error } = await withTimeout(
            rpcPromise,
            10000,
            'Click count request timed out.'
        );

        console.log('getClickCount response:', { data, error });

        if (error) {
            console.error('Error fetching click count:', error);
            return { count: null, error: error.message };
        }

        return { count: data as number };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch click count';
        console.error('getClickCount exception:', errorMessage);
        return { count: null, error: errorMessage };
    }
}

export async function getTopScores(eventId: string): Promise<{ data: LeaderboardEntry[] | null; error?: string }> {
    console.log('getTopScores called with eventId:', eventId);

    if (!supabase) {
        console.log('getTopScores: Supabase not configured');
        return { data: null, error: 'Supabase not configured' };
    }

    try {
        // Wrap the RPC call with a 10-second timeout
        const rpcPromise = supabase
            .rpc('get_top10', { event_id_param: eventId });

        const { data, error } = await withTimeout(
            rpcPromise,
            10000,
            'Leaderboard request timed out. Check connection and try again.'
        );

        console.log('getTopScores response:', { data, error });

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return { data: null, error: error.message };
        }

        return { data: data as LeaderboardEntry[] };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
        console.error('getTopScores exception:', errorMessage);
        return { data: null, error: errorMessage };
    }
}
