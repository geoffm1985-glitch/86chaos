import { getMessaging } from 'firebase-admin/messaging';
import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let authContext;
  try {
    authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
  } catch (error) {
    return res.status(403).json({ error: `Alert authorization failed: ${error.message}` });
  }

  try {
    const { token, title, body } = req.body || {};
    if (!token) throw new Error('Missing user device token in request body.');

    const response = await getMessaging(authContext.app).send({
      notification: {
        title: title || '86 Chaos',
        body: body || 'Test alert triggered!'
      },
      token
    });

    return res.status(200).json({ success: true, messageId: response, firebaseProject: authContext.projectId });
  } catch (error) {
    console.error('Alert send error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Alert delivery failed.' });
  }
}
