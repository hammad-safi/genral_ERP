export const logAudit = async (userId, userName, action, moduleName, details = '') => {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        action,
        module: moduleName,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};
