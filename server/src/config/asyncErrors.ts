/**
 * Enables automatic async error handling for Express 4.
 * Catches rejected promises in async route handlers and middleware,
 * passing them directly to next(err) so AppError and errorHandler work properly
 * without crashing the Node.js process.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require('express/lib/router/layer');

Object.defineProperty(Layer.prototype, 'handle', {
  enumerable: true,
  get: function () {
    return this.__handle;
  },
  set: function (fn: any) {
    if (typeof fn === 'function') {
      if (fn.length === 4) {
        // Error-handling middleware (err, req, res, next)
        this.__handle = function (err: any, req: any, res: any, next: any) {
          const ret = fn.call(this, err, req, res, next);
          if (ret && typeof ret.catch === 'function') {
            ret.catch(next);
          }
          return ret;
        };
      } else {
        // Standard middleware or route handler (req, res, next)
        this.__handle = function (req: any, res: any, next: any) {
          const ret = fn.call(this, req, res, next);
          if (ret && typeof ret.catch === 'function') {
            ret.catch(next);
          }
          return ret;
        };
      }
    } else {
      this.__handle = fn;
    }
  },
});
