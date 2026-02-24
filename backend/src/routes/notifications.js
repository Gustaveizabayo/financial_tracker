const express = require('express');
const { query } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Real-time user alerts and dashboard summaries
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 */

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success message
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success message
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success message
 */

/**
 * @swagger
 * /api/notifications/dashboard:
 *   get:
 *     summary: Get dashboard summary (projects, tasks due soon, budget warnings)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary data
 */
// GET all notifications for current user
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await query(`
      SELECT n.*, p.name as project_name
      FROM notifications n
      LEFT JOIN projects p ON p.id = n.project_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 30
    `, [req.user.id]);

        const unreadCount = result.rows.filter(n => !n.is_read).length;
        res.json({ notifications: result.rows, unread_count: unreadCount });
    } catch (err) { next(err); }
});

// PUT mark all as read
router.put('/read-all', authenticate, async (req, res, next) => {
    try {
        await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
        res.json({ message: 'All notifications marked as read.' });
    } catch (err) { next(err); }
});

// PUT mark single notification as read
router.put('/:id/read', authenticate, async (req, res, next) => {
    try {
        await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Notification marked as read.' });
    } catch (err) { next(err); }
});

// DELETE notification
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Notification deleted.' });
    } catch (err) { next(err); }
});

// GET dashboard summary
router.get('/dashboard', authenticate, async (req, res, next) => {
    try {
        const [projectCount, tasksDue, budgetWarnings] = await Promise.all([
            query(`SELECT COUNT(*) FROM project_members WHERE user_id = $1`, [req.user.id]),
            query(`
        SELECT t.title, t.due_date, t.status, p.name as project_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
        WHERE t.status != 'completed' AND t.due_date <= CURRENT_DATE + INTERVAL '3 days'
        ORDER BY t.due_date ASC
        LIMIT 5
      `, [req.user.id]),
            query(`
        SELECT p.name, p.total_budget, COALESCE(SUM(e.amount), 0) as used
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
        LEFT JOIN expenses e ON e.project_id = p.id
        WHERE p.total_budget > 0
        GROUP BY p.id, p.name, p.total_budget
        HAVING COALESCE(SUM(e.amount), 0) / p.total_budget >= 0.75
      `, [req.user.id]),
        ]);

        res.json({
            project_count: parseInt(projectCount.rows[0].count),
            tasks_due_soon: tasksDue.rows,
            budget_warnings: budgetWarnings.rows,
        });
    } catch (err) { next(err); }
});

module.exports = router;
