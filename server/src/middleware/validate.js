import { AppError } from './error-handler.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        const errorDetails = result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        return next(new AppError('Validation failed on request data', 422, 'VALIDATION_ERROR', errorDetails));
      }
      req[source] = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

