import { memoryDb } from '../config/supabase.js';

export async function logAuditEvent({ actorId, action, entityType, entityId, oldData, newData, req }) {
  try {
    const auditRecord = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      actor_id: actorId || (req?.user?.id ?? null),
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_data: oldData || null,
      new_data: newData || null,
      ip_address: req?.ip || req?.socket?.remoteAddress || '127.0.0.1',
      user_agent: req?.headers ? req.headers['user-agent'] : 'internal',
      created_at: new Date().toISOString()
    };

    memoryDb.tables.audit_logs.push(auditRecord);
    return auditRecord;
  } catch (err) {
    console.error('Failed to write audit log:', err);
    return null;
  }
}

