export default function handler(req, res) {
    res.json({ ok: true, pw: (req.body || {}).password, env: !!process.env.ADMIN_PASSWORD });
}
