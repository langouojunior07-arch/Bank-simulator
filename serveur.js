const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// --- BASE DE DONNÉES SQLITE ---
const db = new sqlite3.Database('./bank_simulator.db', (err) => {
    if (err) console.error('Erreur ouverture BD', err.message);
    else console.log('Connecté à la base de données SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS players (
        user_id TEXT PRIMARY KEY,
        checking REAL DEFAULT 1000.0,
        savings REAL DEFAULT 0.0,
        debt REAL DEFAULT 0.0,
        investments REAL DEFAULT 0.0,
        company_value REAL DEFAULT 0.0,
        bank_level INTEGER DEFAULT 1,
        reputation INTEGER DEFAULT 50
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS companies (
        owner_id TEXT PRIMARY KEY,
        name TEXT,
        domain TEXT DEFAULT 'Général',
        treasury REAL DEFAULT 10000.0,
        revenue REAL DEFAULT 1000.0,
        rating REAL DEFAULT 3.0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stocks (
        symbol TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        change REAL
    )`);

    db.run(`INSERT OR IGNORE INTO stocks (symbol, name, price, change) VALUES ('AAPL', 'Apple Inc.', 175.50, 1.2)`);
    db.run(`INSERT OR IGNORE INTO stocks (symbol, name, price, change) VALUES ('TSLA', 'Tesla Motors', 240.00, -2.5)`);
});

// --- ROUTES API ---

// Obtenir ou créer le profil joueur
app.get('/api/player/:id', (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM players WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO players (user_id) VALUES (?)`, [userId], () => {
                db.get(`SELECT * FROM players WHERE user_id = ?`, [userId], (err, newRow) => {
                    res.json(newRow);
                });
            });
        } else {
            res.json(row);
        }
    });
});

// Action : Dépôt épargne
app.post('/api/player/depot', (req, res) => {
    const { userId, amount } = req.body;
    db.get(`SELECT checking FROM players WHERE user_id = ?`, [userId], (err, row) => {
        if (!row || row.checking < amount) return res.status(400).json({ error: 'Solde insuffisant' });
        db.run(`UPDATE players SET checking = checking - ?, savings = savings + ? WHERE user_id = ?`, [amount, amount, userId], () => {
            res.json({ success: true });
        });
    });
});

// --- INTERFACE WEB INTÉGRÉE ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Simulateur Bancaire & Économique</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 50px; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                button { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 15px; }
                button:hover { background: #2563eb; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🏦 Simulateur Économique</h1>
                <div id="stats">Chargement de votre compte...</div>
                <button onclick="faire Depot()">Déposer 100 € en épargne</button>
            </div>
            <script>
                const userId = "joueur_test_1";
                async function loadStats() {
                    const res = await fetch('/api/player/' + userId);
                    const data = await res.json();
                    document.getElementById('stats').innerHTML = \`
                        <p>💰 <strong>Compte Courant :</strong> \${data.checking} €</p>
                        <p>🏦 <strong>Épargne :</strong> \${data.savings} €</p>
                        <p>⭐ <strong>Niveau Bancaire :</strong> \${data.bank_level}/100</p>
                    \`;
                }
                async function faire Depot() {
                    await fetch('/api/player/depot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, amount: 100 })
                    });
                    loadStats();
                }
                loadStats();
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Jeu lancé sur http://localhost:${PORT}`);
});
