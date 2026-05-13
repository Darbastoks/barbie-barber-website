require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initDatabase, getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'barbie-barber-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==================== API ROUTES ====================

// --- Services ---
app.get('/api/services', (req, res) => {
    try {
        const db = getDb();
        const services = db.prepare('SELECT * FROM services ORDER BY sort_order').all();
        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepavyko gauti paslaugų' });
    }
});

// --- Bookings ---
app.post('/api/bookings', (req, res) => {
    try {
        const { name, phone, email, service, date, time, message, website_url_fake } = req.body;

        // Honeypot check
        if (website_url_fake) {
            return res.status(200).json({ success: true, message: 'Registracija sėkminga! Laukiame jūsų.' });
        }

        if (!name || !phone || !service || !date || !time) {
            return res.status(400).json({ error: 'Prašome užpildyti visus privalomus laukus' });
        }

        const db = getDb();

        // Check double-booking
        const existing = db.prepare(
            "SELECT COUNT(*) as count FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'"
        ).get(date, time);

        if (existing.count > 0) {
            return res.status(409).json({ error: 'Šis laikas jau užimtas. Pasirinkite kitą laiką.' });
        }

        const result = db.prepare(
            'INSERT INTO bookings (name, phone, email, service, date, time, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(name, phone, email || '', service, date, time, message || '');

        res.status(201).json({
            success: true,
            message: 'Registracija sėkminga! Laukiame jūsų.',
            bookingId: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({ error: 'Serverio klaida. Bandykite dar kartą.' });
    }
});

// Get booked times for a date
app.get('/api/bookings/times/:date', (req, res) => {
    try {
        const db = getDb();
        const times = db.prepare(
            "SELECT time FROM bookings WHERE date = ? AND status != 'cancelled'"
        ).all(req.params.date);
        res.json(times.map(t => t.time));
    } catch (err) {
        res.status(500).json({ error: 'Klaida gaunant laikus' });
    }
});

// ==================== ADMIN ROUTES ====================

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Reikia prisijungti' });
}

app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const db = getDb();
        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Neteisingas prisijungimo vardas arba slaptažodis' });
        }

        req.session.isAdmin = true;
        req.session.adminId = admin.id;
        res.json({ success: true, message: 'Prisijungta sėkmingai' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Prisijungimo klaida' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/check', requireAdmin, (req, res) => {
    res.json({ isAdmin: true });
});

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    try {
        const db = getDb();
        const bookings = db.prepare('SELECT * FROM bookings ORDER BY date DESC, time ASC').all();
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko gauti registracijų' });
    }
});

app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Netinkamas statusas' });
        }

        const db = getDb();
        db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko atnaujinti registracijos' });
    }
});

app.delete('/api/admin/bookings/:id', requireAdmin, (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko ištrinti registracijos' });
    }
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const db = getDb();
        const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);

        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ error: 'Neteisingas dabartinis slaptažodis' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, admin.id);

        res.json({ success: true, message: 'Slaptažodis pakeistas' });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko pakeisti slaptažodžio' });
    }
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== START ====================
async function start() {
    try {
        initDatabase();
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════╗
║   💈 G SPOT BARBERSHOP - Serveris       ║
║   🌐 http://localhost:${PORT}              ║
║   👨‍💼 Admin: http://localhost:${PORT}/admin  ║
╚══════════════════════════════════════════╝
            `);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
