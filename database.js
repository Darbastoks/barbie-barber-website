const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'barbershop.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function initDatabase() {
    const db = getDb();

    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT DEFAULT '',
            duration INTEGER DEFAULT 30,
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT DEFAULT '',
            service TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            message TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed admin if not exists
    const bcrypt = require('bcryptjs');
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (adminCount.count === 0) {
        const hash = bcrypt.hashSync('barber2024', 10);
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hash);
        console.log('✅ Default admin created (admin / barber2024)');
    }

    // Seed services if not exists
    const svcCount = db.prepare('SELECT COUNT(*) as count FROM services').get();
    if (svcCount.count === 0) {
        const insert = db.prepare('INSERT INTO services (name, price, description, duration, sort_order) VALUES (?, ?, ?, ?, ?)');
        const services = [
            ['Plaukų kirpimas', 25, 'Profesionalus vyrų plaukų kirpimas', 30, 1],
            ['Barzdos modeliavimas', 25, 'Barzdos formavimas ir modeliavimas', 30, 2],
            ['Barzda su karštų rankšluosčių', 25, 'Barzdos tvarkymas su karštais rankšluosčiais', 35, 3],
            ['Kirpimas + barzdos modeliavimas', 35, 'Plaukų kirpimas kartu su barzdos modeliavimu', 50, 4],
            ['Grožio kaukė + antakių korekcija', 15, 'Veido kaukė ir antakių korekcija', 20, 5],
            ['Dažymo konsultacija', 5, 'Konsultacija dėl plaukų dažymo', 15, 6],
            ['Kirpimas + barzda + grožio kaukė', 40, 'Pilnas kompleksas: kirpimas, barzda ir kaukė', 60, 7],
            ['Kompleksas (viskas)', 50, 'Kirpimas + barzda + karšti rankšluosčiai + kaukė', 75, 8]
        ];
        const insertMany = db.transaction(() => {
            for (const s of services) insert.run(...s);
        });
        insertMany();
        console.log('✅ Default services inserted');
    }

    console.log('✅ SQLite database ready');
    return db;
}

module.exports = { initDatabase, getDb };
