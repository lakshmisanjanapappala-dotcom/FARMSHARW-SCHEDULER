import { supabasePublic, supabaseAdmin, isLiveSupabase, memoryDb } from '../config/supabase.js';
import { AppError } from './error-handler.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication credentials were not provided', 401, 'UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];

    // Development / synthetic testing mock tokens
    if (token.startsWith('mock-token-')) {
      const userId = token.replace('mock-token-', '');
      const user = memoryDb.tables.profiles.find(p => p.id === userId || p.email === userId);
      if (!user) {
        return next(new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN'));
      }
      const roles = memoryDb.tables.user_roles.filter(r => r.user_id === user.id).map(r => r.role);
      req.user = {
        id: user.id,
        email: user.email,
        phone: user.phone_number,
        profile: user,
        roles: roles.length > 0 ? roles : ['renter']
      };
      return next();
    }

    if (isLiveSupabase) {
      const { data, error } = await supabasePublic.auth.getUser(token);
      if (error || !data.user) {
        return next(new AppError('Invalid or expired authentication session', 401, 'INVALID_TOKEN'));
      }

      // Fetch profile & roles from Supabase database with fallback to memoryDb
      let profile = null;
      let roles = [];

      try {
        const client = supabaseAdmin || supabasePublic;
        const [profileRes, rolesRes] = await Promise.all([
          client.from('profiles').select('*').eq('id', data.user.id).maybeSingle(),
          client.from('user_roles').select('role').eq('user_id', data.user.id)
        ]);

        if (profileRes.data) {
          profile = profileRes.data;
        }
        if (rolesRes.data && rolesRes.data.length > 0) {
          roles = rolesRes.data.map(r => r.role);
        }
      } catch (dbErr) {
        // Fallback silently if tables are not yet synced
      }

      if (!profile) {
        profile = memoryDb.tables.profiles.find(p => p.id === data.user.id) || {
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name || 'Farmer',
          phone_number: data.user.phone || null,
          email: data.user.email || null
        };
      }

      if (roles.length === 0) {
        const memRoles = memoryDb.tables.user_roles.filter(r => r.user_id === data.user.id).map(r => r.role);
        roles = memRoles.length > 0 ? memRoles : ['renter'];
      }

      req.user = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        profile,
        roles
      };
      return next();
    }

    // Default development fallback for dev user
    const defaultUser = memoryDb.tables.profiles[0];
    req.user = {
      id: defaultUser.id,
      email: defaultUser.email,
      phone: defaultUser.phone_number,
      profile: defaultUser,
      roles: ['admin', 'owner', 'renter']
    };
    next();
  } catch (err) {
    next(new AppError('Authentication failed', 401, 'AUTH_FAILED', err.message));
  }
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) {
      req.user = null;
    }
    next();
  });
}

