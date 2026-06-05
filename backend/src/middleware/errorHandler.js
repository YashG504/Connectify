/**
 * Custom error class for operational errors with status codes.
 * Use this to throw predictable errors that the error handler can catch.
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware.
 * Catches all errors thrown in routes/controllers and returns a consistent JSON response.
 * Must be registered AFTER all routes in server.js.
 */
export const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code is set
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal Server Error";

  // Log full error details for debugging (only non-operational / unexpected errors)
  if (!err.isOperational) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
