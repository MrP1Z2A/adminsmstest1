import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import url from 'url';

// Simple in-memory rate limiting map
// Maps IP addresses to an object containing the request count and the reset timestamp
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 20; // Allow 20 requests per minute per IP

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'livekit-token-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Apply rate limiting to all /api/ endpoints
          if (req.url && req.url.startsWith('/api/')) {
            const ip = req.socket?.remoteAddress || 'unknown-ip';
            const now = Date.now();
            const limit = rateLimit.get(ip);

            if (limit) {
              if (now > limit.resetTime) {
                // Window expired, reset count
                rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
              } else {
                if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
                  res.writeHead(429, { 
                    'Content-Type': 'application/json',
                    'Retry-After': Math.ceil((limit.resetTime - now) / 1000).toString()
                  });
                  res.end(JSON.stringify({ error: 'Too many requests, please try again later.' }));
                  return; // Stop processing this request
                }
                limit.count++;
              }
            } else {
              rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
            }
          }

          if (req.url && req.url.startsWith('/api/get-livekit-token')) {
            const parsedUrl = url.parse(req.url, true);
            const query = parsedUrl.query;

            const userId = (query.userId as string) || 'dev-user';
            const userName = (query.userName as string) || 'Dev User';
            const roomId = (query.roomId as string) || 'dev-room';
            const isTeacher = query.isTeacher === 'true';

            const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
            const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

            try {
              const at = new AccessToken(apiKey, apiSecret, {
                identity: userId,
                name: userName,
                ttl: 60 * 60,
              });

              const grants: any = {
                roomJoin: true,
                room: roomId,
                canSubscribe: true,
                canPublishData: true,
                canPublish: true,
              };

              // Allow all users to screen share
              grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE];

              at.addGrant(grants);
              
              at.toJwt().then((token) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token }));
              }).catch((err) => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              });
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
