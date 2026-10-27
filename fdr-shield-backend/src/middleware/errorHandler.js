const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle PostgreSQL specific error codes
  if (err.code === '23505') {
    statusCode = 409;
    message = `Duplicate record violation: ${err.detail || 'A record with this unique identifier already exists.'}`;
  } else if (err.code === '23503') {
    statusCode = 400;
    message = `Invalid reference: ${err.detail || 'Referenced parent record does not exist.'}`;
  } else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid ID or data type format in request.';
  }

  // Handle Multer file upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `File upload error: ${err.message}`;
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  if (process.env.NODE_ENV === 'development' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;