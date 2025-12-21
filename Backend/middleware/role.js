/**
 * Role-based access control middleware
 * @param {...number} allowedRoles - role_ids allowed to access the route
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role_id) {
      return res.status(403).json({ error: 'Role not found' });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      return res.status(403).json({ error: 'Access denied: insufficient role' });
    }

    next();
  };
}
