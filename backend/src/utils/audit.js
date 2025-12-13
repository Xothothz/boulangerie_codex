import prisma from '../config/db.js';

function toPlain(details) {
  if (details === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(details));
  } catch (err) {
    return {
      note: 'serialization_failed',
      message: err?.message || String(err),
    };
  }
}

function resolveActor(userLike) {
  if (!userLike) return {};
  const id = userLike.id ?? userLike.userId ?? null;
  return {
    userId: id,
    userEmail: userLike.email || null,
    userRole: userLike.role || null,
    magasinId: userLike.magasinId ?? null,
  };
}

/**
 * Enregistre un événement d'audit. Ne lève jamais d'erreur applicative.
 */
export async function logAudit({
  req,
  user,
  action,
  resourceType,
  resourceId,
  magasinId,
  success = true,
  statusCode,
  details,
}) {
  try {
    const actor = resolveActor(user || req?.user);
    const data = {
      action,
      resourceType: resourceType || null,
      resourceId: resourceId ?? null,
      magasinId: magasinId ?? actor.magasinId ?? null,
      success: !!success,
      statusCode: statusCode ?? null,
      method: req?.method || null,
      path: req?.originalUrl || req?.url || null,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      requestId: req?.requestId || null,
      ...actor,
      details: toPlain(details),
    };

    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}
