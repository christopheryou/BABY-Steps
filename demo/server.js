const express = require('express');
const session = require('express-session');
const path = require('path');
const router = require('./routes/Interaction');
const { safeScenario } = require('./scenario.js');
const app = express();
require('dotenv').config(); // Load variables into process.env


// ===== App Config =====
app.set('view engine', 'ejs');

// ===== Static & Public Files =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Body Parsers =====
app.use(express.json());

// ===== Session =====
app.use(session({
    secret: process.env.SESSION_KEY, // Make sure SESSION_KEY is in your .env
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 20, // Session lasts for 20 minutes
    }
}));

// <--- Routes --->
app.get('/', (req, res) => {
    res.render("chat", {
        scenario: safeScenario
    });
})

app.use('/Interaction', (req, res, next) => {
    next();
}, router);



process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Decide whether to keep the process alive or shut it down
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally handle cleanup or decide to shut down gracefully
});


app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});
