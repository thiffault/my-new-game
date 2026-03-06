import crypto from 'node:crypto';

export default function handler(req, res) {
    const pw = (req.body || {}).password;
    const env = process.env.ADMIN_PASSWORD;
    res.json({ pw, envSet: !!env, match: pw === env });
}
