import { AccessToken, TrackSource, RoomServiceClient } from 'livekit-server-sdk';

/**
 * Serverless function for Vercel/Netlify to securely generate LiveKit tokens.
 * Place this file at "/api/get-livekit-token.js" in the root directory.
 */
export default async function handler(req, res) {
  // CORS Headers to allow frontend access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId, userName, roomId, isTeacher } = req.query;

  if (!userId || !roomId) {
    return res.status(400).json({ error: 'Missing userId or roomId' });
  }

  // Load from Vercel environment variables, fallback to your LiveKit Cloud keys
  const API_KEY = process.env.LIVEKIT_API_KEY || 'APIhuKo3YqiNuKu';
  const API_SECRET = process.env.LIVEKIT_API_SECRET || 'lJfbOjfOKFzLkiyzxdAZ9CnpSCWbuiPk5GyPhO0PcKd';

  try {
    // Connect to LiveKit Cloud to list active rooms
    const roomService = new RoomServiceClient('https://iemsms-wynofg38.livekit.cloud', API_KEY, API_SECRET);
    
    // SECURITY: Students cannot join until Teacher starts the room
    if (isTeacher !== 'true') {
      const rooms = await roomService.listRooms();
      const roomExists = rooms.some(r => r.name === roomId);
      if (!roomExists) {
        return res.status(403).json({
          error: 'The teacher has not started this meeting yet. Please wait for them to begin.'
        });
      }
    }

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: userId,
      name: userName || 'Anonymous',
      ttl: 3600,
    });

    const grants = { 
      roomJoin: true, 
      room: roomId, 
      canSubscribe: true, 
      canPublishData: true, 
      canPublish: true 
    };

    if (isTeacher === 'true') {
      grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE];
    } else {
      grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    }

    at.addGrant(grants);
    
    const token = await at.toJwt();
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
