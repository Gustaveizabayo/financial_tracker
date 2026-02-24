const cron = require('node-cron');
const { query } = require('../db/database');

const startReminderWorker = () => {
    console.log('⏰ Reminder worker started');

    // Run every day at 8 AM
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Running daily reminder check...');
        await checkOverdueTasks();
        await checkUpcomingDeadlines();
        await checkBudgetLimits();
    });

    // Check every hour in dev mode for testing
    if (process.env.NODE_ENV === 'development') {
        // Skip auto-running in dev to avoid noise, but function is available
    }
};

const checkOverdueTasks = async () => {
    try {
        const result = await query(`
      SELECT t.id, t.title, t.assigned_to, t.project_id, p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.status != 'completed' AND t.due_date < CURRENT_DATE
      AND t.assigned_to IS NOT NULL
    `);

        for (const task of result.rows) {
            // Check if notification was already sent today
            const existing = await query(`
        SELECT id FROM notifications
        WHERE user_id = $1 AND type = 'overdue' AND message LIKE $2
        AND created_at > CURRENT_DATE
      `, [task.assigned_to, `%${task.title}%`]);

            if (existing.rows.length === 0) {
                await query(
                    'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
                    [task.assigned_to, task.project_id, 'overdue', `🔴 Task "${task.title}" in "${task.project_name}" is overdue!`]
                );
            }
        }
        console.log(`✅ Checked ${result.rows.length} overdue tasks`);
    } catch (err) {
        console.error('❌ Error checking overdue tasks:', err.message);
    }
};

const checkUpcomingDeadlines = async () => {
    try {
        const result = await query(`
      SELECT t.id, t.title, t.assigned_to, t.project_id, t.due_date, p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.status != 'completed'
      AND t.due_date = CURRENT_DATE + INTERVAL '1 day'
      AND t.assigned_to IS NOT NULL
    `);

        for (const task of result.rows) {
            await query(
                'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
                [task.assigned_to, task.project_id, 'due_soon', `⚠️ Task "${task.title}" is due tomorrow in "${task.project_name}"`]
            );
        }
        console.log(`✅ Sent ${result.rows.length} deadline reminders`);
    } catch (err) {
        console.error('❌ Error checking upcoming deadlines:', err.message);
    }
};

const checkBudgetLimits = async () => {
    try {
        const result = await query(`
      SELECT p.id, p.name, p.total_budget, p.owner_id, COALESCE(SUM(e.amount), 0) as used
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.total_budget > 0
      GROUP BY p.id, p.name, p.total_budget, p.owner_id
      HAVING COALESCE(SUM(e.amount), 0) / p.total_budget >= 0.80
    `);

        for (const project of result.rows) {
            const pct = Math.round((project.used / project.total_budget) * 100);
            await query(
                'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
                [project.owner_id, project.id, 'budget_warning', `⚠️ Budget for "${project.name}" is ${pct}% used`]
            );
        }
        console.log(`✅ Checked ${result.rows.length} budget limits`);
    } catch (err) {
        console.error('❌ Error checking budget limits:', err.message);
    }
};

module.exports = { startReminderWorker };
