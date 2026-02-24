require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startReminderWorker } = require('./workers/reminderWorker');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const expenseRoutes = require('./routes/expenses');
const notificationRoutes = require('./routes/notifications');
const errorHandler = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');


const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.json({
    message: 'Welcome to Valantine Financial API',
    docs: '/api-docs',
    health: '/health',
    version: '1.0.0'
}));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Swagger Documentation ────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects/:projectId/expenses', expenseRoutes);
app.use('/api/notifications', notificationRoutes);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n Financial API running on http://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV}`);
    console.log(`  Database:    ${process.env.DATABASE_URL?.substring(0, 40)}...`);

    // Start background reminder worker
    startReminderWorker();
});

module.exports = app;
