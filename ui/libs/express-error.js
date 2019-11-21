'use strict';

function errorHandler (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render("index", {
    text: err
  });
}

module.exports = errorHandler;