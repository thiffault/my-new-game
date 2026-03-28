import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TOKEN_EXPIRY_MS = 2 * 60 * 60 * 1000;

function verifyToken(token) {
    if (!token) return false;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [timestamp, sig] = decoded.split('.');
        if (!timestamp || !sig) return false;
        if (Date.now() - parseInt(timestamp) > TOKEN_EXPIRY_MS) return false;
        const expected = crypto
            .createHmac('sha256', process.env.ADMIN_PASSWORD)
            .update(timestamp)
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    const origin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
        .from('scores')
        .select('event_id')
        .order('event_id', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const events = [...new Set(data.map(r => r.event_id))];
    return res.json({ events });
}
