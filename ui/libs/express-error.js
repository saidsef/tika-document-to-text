'use strict';

/** Build an Error carrying a browser-safe message and an HTTP status. */
export const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  // Multer rejects oversized uploads before the route runs.
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || 500;
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'That file is too large to convert.'
    : err.expose ? err.message : 'Something went wrong converting that file.';

  console.error({ status, method: req.method, url: req.originalUrl, err: err.message });
  res.status(status).render('index', { error: message });
};
