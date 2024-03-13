'use strict';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).render("index", {
    text: err
  });
};
