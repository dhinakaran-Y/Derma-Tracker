import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { doctorOnly } from '../middleware/roleMiddleware';
import { tunnelManager } from '../config/tunnelManager';

const router = Router();

/**
 * POST /api/tunnel/start
 * Doctor-authenticated endpoint to start the Cloudflare tunnel.
 * Returns the public tunnel URL once ready.
 */
router.post('/start', authMiddleware, doctorOnly, async (_req: AuthRequest, res: Response) => {
  try {
    // Check if cloudflared is available
    if (!tunnelManager.isCloudflaredAvailable()) {
      res.json({
        success: true,
        data: {
          status: 'unavailable',
          url: null,
          message: 'cloudflared is not installed. Cross-network pairing requires cloudflared. Falling back to same-network mode.',
        },
      });
      return;
    }

    // Start or get existing tunnel — tunnels port 3000 (Next.js) so the mobile
    // page + its /api proxy rewrites all go through one public URL.
    const clientPort = parseInt(process.env.CLIENT_PORT || '3000', 10);
    const tunnelUrl = await tunnelManager.ensureTunnel(clientPort);

    res.json({
      success: true,
      data: {
        status: 'running',
        url: tunnelUrl,
      },
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        status: 'error',
        url: null,
        message: err.message || 'Failed to start tunnel',
      },
    });
  }
});

router.post('/restart', authMiddleware, doctorOnly, async (_req: AuthRequest, res: Response) => {
  try {
    tunnelManager.stopTunnel();
    const clientPort = parseInt(process.env.CLIENT_PORT || '3000', 10);
    const tunnelUrl = await tunnelManager.ensureTunnel(clientPort);
    res.json({
      success: true,
      data: {
        status: 'running',
        url: tunnelUrl,
      },
    });
  } catch (err: any) {
    res.json({
      success: false,
      error: err?.message || 'Failed to restart tunnel',
    });
  }
});

/**
 * GET /api/tunnel/status
 * Returns current tunnel status (running/stopped/error) and URL.
 */
router.get('/status', authMiddleware, doctorOnly, async (_req: AuthRequest, res: Response) => {
  const status = tunnelManager.getStatus();
  const available = tunnelManager.isCloudflaredAvailable();

  res.json({
    success: true,
    data: {
      ...status,
      cloudflaredInstalled: available,
    },
  });
});

export default router;
