const express = require('express');
const session = require('express-session');
const path = require('path');
const router = require('./routes/Interaction');
const { safeScenario } = require('./scenario');
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
    const templateType = safeScenario?.templateType;
    if (templateType == "chatlog-view") {
        res.render("chat", {
            scenario: safeScenario
        });
    }
    else if (templateType == "panel-view") {
        res.render("panel", {
            scenario: safeScenario
        });
    }
    else {
        res.json("Error. No such template");
    }

})

app.get('/chat', (req, res) => {
    safeScenario.templateType = "chatlog-view"
    res.render("chat", {
        scenario: safeScenario
    });
})

app.get('/panel', (req, res) => {
    safeScenario.templateType = "panel-view"
    res.render("panel", {
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
