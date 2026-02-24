const express = require('express');
const { query } = require('../db/database');
const { authenticate, requireProjectRole } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management and membership
 */

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects for current user
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               total_budget:
 *                 type: number
 *               currency:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Project created
 *       400:
 *         description: Project name required
 */

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get a project by ID
 *     tags: [Projects]
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
 *         description: Project data
 *       404:
 *         description: Project not found
 *   put:
 *     summary: Update project settings
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               total_budget:
 *                 type: number
 *               currency:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
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
 *         description: Project deleted
 */
// Helper: log activity
const logActivity = async (projectId, taskId, userId, action, details = {}) => {
    try {
        await query(
            'INSERT INTO activities (project_id, task_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)',
            [projectId, taskId, userId, action, JSON.stringify(details)]
        );
    } catch (e) { console.error('Activity log error:', e.message); }
};

// GET all projects for current user
router.get('/', authenticate, async (req, res, next) => {
    try {
        const result = await query(`
      SELECT p.*, pm.role as user_role, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') as completed_tasks,
        (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.project_id = p.id) as used_budget,
        (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `, [req.user.id]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET single project
router.get('/:id', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT p.*, pm.role as user_role, u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') as completed_tasks,
        (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.project_id = p.id) as used_budget,
        (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
      JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1
    `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Project not found.' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST create project
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { name, description, total_budget, currency, due_date } = req.body;
        if (!name) return res.status(400).json({ message: 'Project name is required.' });

        const projectResult = await query(
            'INSERT INTO projects (name, description, total_budget, currency, owner_id, due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [name, description, total_budget || 0, currency || 'RWF', req.user.id, due_date || null]
        );
        const project = projectResult.rows[0];

        // Auto-add owner as member
        await query(
            'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
            [project.id, req.user.id, 'owner']
        );

        await logActivity(project.id, null, req.user.id, `Created project "${name}"`);
        res.status(201).json(project);
    } catch (err) { next(err); }
});

// PUT update project
router.put('/:id', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        const { name, description, total_budget, currency, due_date, status } = req.body;
        const result = await query(
            `UPDATE projects SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        total_budget = COALESCE($3, total_budget),
        currency = COALESCE($4, currency),
        due_date = COALESCE($5, due_date),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
            [name, description, total_budget, currency, due_date, status, req.params.id]
        );
        await logActivity(req.params.id, null, req.user.id, `Updated project settings`);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE project
router.delete('/:id', authenticate, requireProjectRole(['owner']), async (req, res, next) => {
    try {
        await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ message: 'Project deleted successfully.' });
    } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/projects/{id}/members:
 *   get:
 *     summary: Get all project members
 *     tags: [Projects]
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
 *         description: List of members
 *   post:
 *     summary: Invite a member to the project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, editor, viewer]
 *     responses:
 *       201:
 *         description: Member invited
 *       404:
 *         description: User not found
 */
// GET project members
router.get('/:id/members', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT u.id, u.name, u.email, u.avatar, pm.role, pm.joined_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at
    `, [req.params.id]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST invite member
router.post('/:id/members', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });

        const validRoles = ['admin', 'editor', 'viewer'];
        const memberRole = validRoles.includes(role) ? role : 'viewer';

        const userResult = await query('SELECT id, name, email, avatar FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'No user found with this email address.' });
        }

        const invitedUser = userResult.rows[0];
        await query(
            'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3',
            [req.params.id, invitedUser.id, memberRole]
        );

        // Notify the invited user
        await query(
            'INSERT INTO notifications (user_id, project_id, type, message) VALUES ($1, $2, $3, $4)',
            [invitedUser.id, req.params.id, 'invite', `${req.user.name} invited you to join a project`]
        );

        await logActivity(req.params.id, null, req.user.id, `Invited ${invitedUser.name} as ${memberRole}`);
        res.status(201).json({ ...invitedUser, role: memberRole });
    } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/projects/{id}/members/{userId}:
 *   put:
 *     summary: Update a member's role
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, editor, viewer]
 *     responses:
 *       200:
 *         description: Role updated
 *   delete:
 *     summary: Remove a member from the project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Member removed
 */
// PUT update member role
router.put('/:id/members/:userId', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }
        await query(
            'UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3',
            [role, req.params.id, req.params.userId]
        );
        await logActivity(req.params.id, null, req.user.id, `Updated member role to ${role}`);
        res.json({ message: 'Role updated.' });
    } catch (err) { next(err); }
});

// DELETE remove member
router.delete('/:id/members/:userId', authenticate, requireProjectRole(['owner', 'admin']), async (req, res, next) => {
    try {
        await query(
            'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
            [req.params.id, req.params.userId]
        );
        await logActivity(req.params.id, null, req.user.id, `Removed a member from project`);
        res.json({ message: 'Member removed.' });
    } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/projects/{id}/activities:
 *   get:
 *     summary: Get recent project activities
 *     tags: [Projects]
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
 *         description: List of activities
 */
// GET project activities
router.get('/:id/activities', authenticate, requireProjectRole(), async (req, res, next) => {
    try {
        const result = await query(`
      SELECT a.*, u.name as user_name, u.avatar as user_avatar
      FROM activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.project_id = $1
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [req.params.id]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

module.exports = router;
