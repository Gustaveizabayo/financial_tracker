const express = require('express');
const { query } = require('../db/database');
const { authenticate, requireProjectRole } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management, comments, and specific expenses
 */

/**
 * @swagger
 * /api/projects/{projectId}/tasks:
 *   get:
 *     summary: Get all tasks for a project
 *     tags: [Tasks]
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
 *         description: List of tasks
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [todo, in_progress, completed]
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *               due_date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               position:
 *                 type: number
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Task title required
 */

/**
 * @swagger
 * /api/projects/{projectId}/tasks/{taskId}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
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
 *         name: taskId
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [todo, in_progress, completed]
 *               progress:
 *                 type: number
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *               due_date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               position:
 *                 type: number
 *     responses:
 *       200:
 *         description: Task updated
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
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
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task deleted
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

// GET all tasks for a project
router.get('/', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT t.*,
        u.name as assigned_to_name, u.avatar as assigned_to_avatar,
        c.name as created_by_name,
        (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.task_id = t.id) as cost_used,
        (SELECT COUNT(*) FROM comments cm WHERE cm.task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users c ON c.id = t.created_by
      WHERE t.project_id = $1
      ORDER BY t.status, t.position, t.created_at
    `, [req.params.projectId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST create task
router.post('/', authenticate, requireProjectRole(['owner', 'admin', 'editor']), async (req, res, next) => {
    try {
        const { title, description, status, assigned_to, due_date, priority, position } = req.body;
        if (!title) return res.status(400).json({ message: 'Task title is required.' });

        const validStatuses = ['todo', 'in_progress', 'completed'];
        const taskStatus = validStatuses.includes(status) ? status : 'todo';

        const result = await query(
            `INSERT INTO tasks (project_id, title, description, status, assigned_to, due_date, priority, position, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [req.params.projectId, title, description, taskStatus, assigned_to || null, due_date || null, priority || 'medium', position || 0, req.user.id]
        );

        const task = result.rows[0];

        // Notify assigned user
        if (assigned_to && assigned_to !== req.user.id) {
            await query(
                'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
                [assigned_to, req.params.projectId, 'task_assigned', `${req.user.name} assigned you a task: "${title}"`]
            );
        }

        await logActivity(req.params.projectId, task.id, req.user.id, `Created task "${title}"`);
        res.status(201).json(task);
    } catch (err) { next(err); }
});

// PUT update task
router.put('/:taskId', authenticate, requireProjectRole(['owner', 'admin', 'editor']), async (req, res, next) => {
    try {
        const { title, description, status, progress, assigned_to, due_date, priority, position } = req.body;

        // Get old task for activity log
        const oldTask = await query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
        if (oldTask.rows.length === 0) return res.status(404).json({ message: 'Task not found.' });

        const result = await query(
            `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        progress = COALESCE($4, progress),
        assigned_to = COALESCE($5, assigned_to),
        due_date = COALESCE($6, due_date),
        priority = COALESCE($7, priority),
        position = COALESCE($8, position),
        updated_at = NOW()
       WHERE id = $9 AND project_id = $10 RETURNING *`,
            [title, description, status, progress, assigned_to, due_date, priority, position, req.params.taskId, req.params.projectId]
        );

        const task = result.rows[0];
        const old = oldTask.rows[0];

        if (old.status !== task.status) {
            await logActivity(req.params.projectId, task.id, req.user.id, `Moved "${task.title}" to ${task.status.replace('_', ' ')}`);
        } else if (old.progress !== task.progress) {
            await logActivity(req.params.projectId, task.id, req.user.id, `Updated progress of "${task.title}" to ${task.progress}%`);
        }

        res.json(task);
    } catch (err) { next(err); }
});

// DELETE task
router.delete('/:taskId', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        const taskResult = await query('SELECT title FROM tasks WHERE id = $1', [req.params.taskId]);
        await query('DELETE FROM tasks WHERE id = $1 AND project_id = $2', [req.params.taskId, req.params.projectId]);
        if (taskResult.rows[0]) {
            await logActivity(req.params.projectId, null, req.user.id, `Deleted task "${taskResult.rows[0].title}"`);
        }
        res.json({ message: 'Task deleted.' });
    } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/{taskId}/comments:
 *   get:
 *     summary: Get all comments for a task
 *     tags: [Tasks]
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
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of comments
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Tasks]
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
 *         name: taskId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 */
// GET comments for a task
router.get('/:taskId/comments', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT c.*, u.name as user_name, u.avatar as user_avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.taskId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST add comment
router.post('/:taskId/comments', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ message: 'Comment content is required.' });

        const taskResult = await query('SELECT title FROM tasks WHERE id = $1', [req.params.taskId]);
        const result = await query(
            'INSERT INTO comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
            [req.params.taskId, req.user.id, content]
        );

        if (taskResult.rows[0]) {
            await logActivity(req.params.projectId, req.params.taskId, req.user.id, `Commented on "${taskResult.rows[0].title}"`);
        }

        res.status(201).json({ ...result.rows[0], user_name: req.user.name, user_avatar: req.user.avatar });
    } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/{taskId}/expenses:
 *   get:
 *     summary: Get all expenses linked to a task
 *     tags: [Tasks]
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
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of expenses
 */
// GET expenses for a task
router.get('/:taskId/expenses', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT e.*, u.name as created_by_name
      FROM expenses e
      JOIN users u ON u.id = e.created_by
      WHERE e.task_id = $1
      ORDER BY e.date DESC
    `, [req.params.taskId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

module.exports = router;

