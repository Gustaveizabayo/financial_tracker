const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await query('SELECT id, name, email, avatar FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid token. User not found.' });
        }

        req.user = result.rows[0];
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

// Check if user is a member of a project and has required role
const requireProjectRole = (roles = []) => async (req, res, next) => {
    try {
        const projectId = req.params.projectId || req.params.id || req.body.project_id;
        const userId = req.user.id;

        const result = await query(
            'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
            [projectId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: 'You are not a member of this project.' });
        }

        const { role } = result.rows[0];
        req.projectRole = role;

        if (roles.length > 0 && !roles.includes(role)) {
            return res.status(403).json({ message: `Insufficient permissions. Required: ${roles.join(' or ')}` });
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { authenticate, requireProjectRole };
