const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);

    if (err.code === '23505') {
        return res.status(409).json({ message: 'A record with this data already exists.' });
    }
    if (err.code === '23503') {
        return res.status(400).json({ message: 'Referenced record does not exist.' });
    }
    if (err.code === '22P02') {
        return res.status(400).json({ message: 'Invalid ID format.' });
    }

    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
