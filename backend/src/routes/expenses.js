const express = require('express');
const { query } = require('../db/database');
const { authenticate, requireProjectRole } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Financial tracking and budget summaries
 */

/**
 * @swagger
 * /api/projects/{projectId}/expenses:
 *   get:
 *     summary: Get all expenses for a project
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of expenses and budget summary
 *   post:
 *     summary: Record a new expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               task_id:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Expense recorded
 *       400:
 *         description: Amount and description required
 */

/**
 * @swagger
 * /api/projects/{projectId}/expenses/{expenseId}:
 *   put:
 *     summary: Update an expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               task_id:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Expense updated
 *   delete:
 *     summary: Delete an expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Expense deleted
 */

/**
 * @swagger
 * /api/projects/{projectId}/expenses/summary/categories:
 *   get:
 *     summary: Get expense summary by categories
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of categories with totals
 */
// Helper: log activity
const logActivity = async (projectId, taskId, userId, action, details = {}) => {
    try {
        await query(
            'INSERT INTO activities (project_id, task_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)',
            [projectId, taskId, userId, action, JSON.stringify(details)]
        );
    } catch (e) { }
};

// GET all expenses for a project
router.get('/', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT e.*, u.name as created_by_name, u.avatar as created_by_avatar,
        t.title as task_title
      FROM expenses e
      JOIN users u ON u.id = e.created_by
      LEFT JOIN tasks t ON t.id = e.task_id
      WHERE e.project_id = $1
      ORDER BY e.date DESC, e.created_at DESC
    `, [req.params.projectId]);

        // Budget summary
        const summary = await query(`
      SELECT 
        p.total_budget,
        COALESCE(SUM(e.amount), 0) as used_budget
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.total_budget
    `, [req.params.projectId]);

        const budgetData = summary.rows[0] || { total_budget: 0, used_budget: 0 };
        const remaining = budgetData.total_budget - budgetData.used_budget;
        const percentUsed = budgetData.total_budget > 0
            ? Math.round((budgetData.used_budget / budgetData.total_budget) * 100)
            : 0;

        res.json({
            expenses: result.rows,
            summary: {
                total_budget: parseFloat(budgetData.total_budget),
                used_budget: parseFloat(budgetData.used_budget),
                remaining: parseFloat(remaining),
                percent_used: percentUsed,
            }
        });
    } catch (err) { next(err); }
});

// POST create expense
router.post('/', authenticate, requireProjectRole(['owner', 'admin', 'editor']), async (req, res, next) => {
    try {
        const { amount, description, category, task_id, date } = req.body;
        if (!amount || !description) {
            return res.status(400).json({ message: 'Amount and description are required.' });
        }
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number.' });
        }

        const result = await query(
            'INSERT INTO expenses (project_id, task_id, amount, description, category, created_by, date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [req.params.projectId, task_id || null, parseFloat(amount), description, category || 'General', req.user.id, date || new Date().toISOString().split('T')[0]]
        );

        const expense = result.rows[0];

        // Check if budget is nearing limit
        const budgetCheck = await query(`
      SELECT p.total_budget, COALESCE(SUM(e.amount), 0) as used
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.total_budget
    `, [req.params.projectId]);

        if (budgetCheck.rows[0]) {
            const { total_budget, used } = budgetCheck.rows[0];
            const pct = total_budget > 0 ? (used / total_budget) * 100 : 0;

            if (pct >= 80 && pct < 100) {
                // Notify all project admins/owners
                const admins = await query(
                    "SELECT user_id FROM project_members WHERE project_id = $1 AND role IN ('owner', 'admin')",
                    [req.params.projectId]
                );
                for (const admin of admins.rows) {
                    await query(
                        'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
                        [admin.user_id, req.params.projectId, 'budget_warning', `⚠️ Budget is ${Math.round(pct)}% used`]
                    );
                }
            }
        }

        await logActivity(req.params.projectId, task_id || null, req.user.id, `Added expense: ${description} (${amount})`);
        res.status(201).json({ ...expense, created_by_name: req.user.name });
    } catch (err) { next(err); }
});

// PUT update expense
router.put('/:expenseId', authenticate, requireProjectRole(['owner', 'admin', 'editor']), async (req, res, next) => {
    try {
        const { amount, description, category, task_id, date } = req.body;
        const result = await query(
            `UPDATE expenses SET
        amount = COALESCE($1, amount),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        task_id = COALESCE($4, task_id),
        date = COALESCE($5, date),
        updated_at = NOW()
       WHERE id = $6 AND project_id = $7 RETURNING *`,
            [amount, description, category, task_id, date, req.params.expenseId, req.params.projectId]
        );
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE expense
router.delete('/:expenseId', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        const exp = await query('SELECT description, amount FROM expenses WHERE id = $1', [req.params.expenseId]);
        await query('DELETE FROM expenses WHERE id = $1 AND project_id = $2', [req.params.expenseId, req.params.projectId]);
        if (exp.rows[0]) {
            await logActivity(req.params.projectId, null, req.user.id, `Deleted expense: ${exp.rows[0].description}`);
        }
        res.json({ message: 'Expense deleted.' });
    } catch (err) { next(err); }
});

// GET expense categories summary
router.get('/summary/categories', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      WHERE project_id = $1
      GROUP BY category
      ORDER BY total DESC
    `, [req.params.projectId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

module.exports = router;
