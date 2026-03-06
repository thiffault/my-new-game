/**
 * Admin API Server for API Runner
 *
 * Endpoints:
 * - POST /api/admin/login - Authenticate admin
 * - GET /api/admin/scores - Get all scores for an event
 * - POST /api/admin/reset - Delete all scores for an event
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const app = express();
const PORT = process.env.ADMIN_PORT || 8787;

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
}

if (!ADMIN_PASSWORD) {
    console.error('Missing ADMIN_PASSWORD in environment');
    process.exit(1);
}

// Create Supabase client with service role key (admin access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// In-memory token store
const validTokens = new Map();
const TOKEN_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

// Middleware - CORS for dev and production
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());
// Serve the built frontend (Vite output)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath));

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Generate a random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware to verify admin token
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const tokenData = validTokens.get(token);

    if (!tokenData) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (Date.now() > tokenData.expiresAt) {
        validTokens.delete(token);
        return res.status(401).json({ error: 'Token expired' });
    }

    next();
}

// Clean up expired tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of validTokens.entries()) {
        if (now > data.expiresAt) {
            validTokens.delete(token);
        }
    }
}, 5 * 60 * 1000);

// ============ ENDPOINTS ============

/**
 * POST /api/admin/login
 * Body: { password: string }
 * Returns: { token: string } or 401
 */
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    console.log('Login attempt received');

    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }

    if (password !== ADMIN_PASSWORD) {
        console.log('Login failed: incorrect password');
        return res.status(401).json({ error: 'Incorrect password' });
    }

    // Generate token and store it
    const token = generateToken();
    validTokens.set(token, {
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRY_MS
    });

    console.log('Login successful, token issued (expires in 2 hours)');
    res.json({ token });
});

/**
 * GET /api/admin/scores?eventId=...
 * Headers: Authorization: Bearer <token>
 * Returns: { scores: [...], count: number }
 */
app.get('/api/admin/scores', requireAuth, async (req, res) => {
    const { eventId } = req.query;

    if (!eventId) {
        return res.status(400).json({ error: 'eventId query parameter required' });
    }

    console.log('Fetching scores for eventId:', eventId);

    try {
        const { data, error } = await supabase
            .from('scores')
            .select('email, nickname, score, created_at')
            .eq('event_id', eventId)
            .order('score', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`Found ${data.length} scores for eventId: ${eventId}`);
        res.json({ scores: data, count: data.length });
    } catch (err) {
        console.error('Exception fetching scores:', err);
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

/**
 * POST /api/admin/reset
 * Headers: Authorization: Bearer <token>
 * Body: { eventId: string }
 * Returns: { deletedCount: number }
 */
app.post('/api/admin/reset', requireAuth, async (req, res) => {
    const { eventId } = req.body;

    if (!eventId) {
        return res.status(400).json({ error: 'eventId required in body' });
    }

    console.log('Resetting scores for eventId:', eventId);

    try {
        // First count how many will be deleted
        const { count } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId);

        // Delete the scores
        const { error } = await supabase
            .from('scores')
            .delete()
            .eq('event_id', eventId);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`Deleted ${count} scores for eventId: ${eventId}`);
        res.json({ deletedCount: count || 0 });
    } catch (err) {
        console.error('Exception resetting scores:', err);
        res.status(500).json({ error: 'Failed to reset scores' });
    }
});

/**
 * GET /api/admin/health
 */
app.get('/api/admin/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Admin API server running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /api/admin/login');
    console.log('  GET  /api/admin/scores?eventId=...');
    console.log('  POST /api/admin/reset');
});
