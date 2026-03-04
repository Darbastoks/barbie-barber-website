require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initDatabase, Admin, Service, Booking } = require('./database');

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
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ==================== API ROUTES ====================

// --- Services ---
app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find().sort({ sort_order: 1 });
        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepavyko gauti paslaugų' });
    }
});

// --- Bookings ---
app.post('/api/bookings', async (req, res) => {
    try {
        const { name, phone, email, service, date, time, message } = req.body;

        // Validation
        if (!name || !phone || !service || !date || !time) {
            return res.status(400).json({ error: 'Prašome užpildyti visus privalomus laukus' });
        }

        // Check if time slot is already taken
        const existing = await Booking.countDocuments({
            date: date,
            time: time,
            status: { $ne: 'cancelled' }
        });

        if (existing > 0) {
            return res.status(409).json({ error: 'Šis laikas jau užimtas. Pasirinkite kitą laiką.' });
        }

        const newBooking = new Booking({
            name, phone, email, service, date, time, message
        });
        await newBooking.save();

        res.status(201).json({
            success: true,
            message: 'Registracija sėkminga! Laukiame jūsų.',
            bookingId: newBooking._id
        });
    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({ error: 'Serverio klaida. Bandykite dar kartą.' });
    }
});

// Get booked times for a specific date (public - for the booking form)
app.get('/api/bookings/times/:date', async (req, res) => {
    try {
        const bookedTimes = await Booking.find(
            { date: req.params.date, status: { $ne: 'cancelled' } },
            { time: 1, _id: 0 }
        );
        res.json(bookedTimes.map(b => b.time));
    } catch (err) {
        res.status(500).json({ error: 'Klaida gaunant laikus' });
    }
});

// ==================== ADMIN ROUTES ====================

// Admin auth middleware
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Reikia prisijungti' });
}

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });

        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Neteisingas prisijungimo vardas arba slaptažodis' });
        }

        req.session.isAdmin = true;
        req.session.adminId = admin._id;
        res.json({ success: true, message: 'Prisijungta sėkmingai' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Prisijungimo klaida' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check admin session
app.get('/api/admin/check', requireAdmin, (req, res) => {
    res.json({ isAdmin: true });
});

// Get all bookings (admin only)
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ date: -1, time: 1 });
        // Mongoose maps _id to id virtually, but we can map it explicitly for the frontend
        const formattedBookings = bookings.map(b => ({
            ...b.toObject(),
            id: b._id
        }));
        res.json(formattedBookings);
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko gauti registracijų' });
    }
});

// Update booking status (admin only)
app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Netinkamas statusas' });
        }

        await Booking.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko atnaujinti registracijos' });
    }
});

// Delete booking (admin only)
app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko ištrinti registracijos' });
    }
});

// Change admin password
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const admin = await Admin.findById(req.session.adminId);

        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ error: 'Neteisingas dabartinis slaptažodis' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await Admin.findByIdAndUpdate(admin._id, { password: hashedPassword });

        res.json({ success: true, message: 'Slaptažodis pakeistas' });
    } catch (err) {
        res.status(500).json({ error: 'Nepavyko pakeisti slaptažodžio' });
    }
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
async function start() {
    try {
        await initDatabase();
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
