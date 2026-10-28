import { AppError } from './error-handler.js';

export function authorize(...requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required to access this resource', 401, 'UNAUTHORIZED'));
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return next();
    }

    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return next(new AppError('Forbidden: you do not possess the required permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
}

