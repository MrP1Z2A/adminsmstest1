import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import url from 'url';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'livekit-token-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
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

              if (isTeacher) {
                grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE];
              } else {
                grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
              }

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
