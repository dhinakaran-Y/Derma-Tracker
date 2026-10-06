import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * TunnelManager — Singleton service that auto-starts and manages a Cloudflare
 * Quick Tunnel (cloudflared) process. Provides a persistent public URL so
 * mobile devices on any network can reach the local Next.js dev server.
 *
 * Usage:
 *   const url = await tunnelManager.ensureTunnel();  // starts if needed, returns URL
 *   tunnelManager.getTunnelUrl();                     // returns cached URL or null
 *   tunnelManager.stopTunnel();                       // kills cloudflared process
 */

interface TunnelState {
  process: ChildProcess | null;
  url: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error: string | null;
  startedAt: Date | null;
}

// Known paths where cloudflared binary may exist
const CLOUDFLARED_PATHS = [
  '/tmp/cloudflared',                                     // Downloaded / temporary binary
  path.join(process.cwd(), 'cloudflared'),                // Project root or cwd
  path.join(process.cwd(), '..', 'cloudflared'),           // Workspace root if cwd is server/
  path.resolve(__dirname, '../../../cloudflared'),         // Root relative to dist/config or src/config
  path.resolve(__dirname, '../../../../cloudflared'),        // Root relative to compiled js
  '/home/dhinakaran/Projects/Derma-tracker/cloudflared',   // Absolute workspace location
  '/usr/local/bin/cloudflared',                           // Common install location
  '/usr/bin/cloudflared',                                 // Package manager install
];

class TunnelManager {
  private state: TunnelState = {
    process: null,
    url: null,
    status: 'stopped',
    error: null,
    startedAt: null,
  };

  private resolveQueue: Array<{
    resolve: (url: string) => void;
    reject: (err: Error) => void;
  }> = [];

  private startTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Find the cloudflared binary path.
   * Returns null if not found.
   */
  findCloudflaredBinary(): string | null {
    for (const binPath of CLOUDFLARED_PATHS) {
      if (existsSync(binPath)) return binPath;
    }
    // Check if bare 'cloudflared' command exists in PATH
    try {
      const { execSync } = require('child_process');
      const stdout = execSync('which cloudflared', { stdio: 'pipe' }).toString().trim();
      if (stdout && existsSync(stdout)) return stdout;
    } catch {
      // not in PATH
    }
    return null;
  }

  /**
   * Returns the current tunnel URL or null if not running.
   */
  getTunnelUrl(): string | null {
    return this.state.url;
  }

  /**
   * Returns the current tunnel status.
   */
  getStatus(): { status: string; url: string | null; error: string | null; uptime: number | null } {
    return {
      status: this.state.status,
      url: this.state.url,
      error: this.state.error,
      uptime: this.state.startedAt ? Math.floor((Date.now() - this.state.startedAt.getTime()) / 1000) : null,
    };
  }

  /**
   * Ensures the tunnel is running. Returns the public URL.
   * If already running, returns cached URL instantly.
   * If starting, queues the caller until URL is available.
   * If stopped, starts a new tunnel.
   */
  async ensureTunnel(targetPort: number = 3000): Promise<string> {
    // Already running — return cached URL
    if (this.state.status === 'running' && this.state.url) {
      return this.state.url;
    }

    // Currently starting — queue this caller
    if (this.state.status === 'starting') {
      return new Promise<string>((resolve, reject) => {
        this.resolveQueue.push({ resolve, reject });
      });
    }

    // Start new tunnel
    return this.startTunnel(targetPort);
  }

  /**
   * Starts the cloudflared tunnel process.
   */
  private startTunnel(targetPort: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.resolveQueue.push({ resolve, reject });
      this.state.status = 'starting';
      this.state.error = null;
      this.state.url = null;

      const binary = this.findCloudflaredBinary();
      if (!binary) {
        this.failAll(new Error(
          'cloudflared not found. Install it: curl -L --output /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /tmp/cloudflared'
        ));
        return;
      }

      console.log(`🌐 [Tunnel] Starting cloudflared tunnel → localhost:${targetPort}...`);

      const proc = spawn(binary, ['tunnel', '--url', `http://localhost:${targetPort}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.state.process = proc;

      // Set a 30-second timeout for URL extraction
      this.startTimeout = setTimeout(() => {
        if (this.state.status === 'starting') {
          console.error('🌐 [Tunnel] Timeout — cloudflared did not produce a URL within 30 seconds');
          this.failAll(new Error('Tunnel startup timed out after 30 seconds'));
          this.killProcess();
        }
      }, 30000);

      let stderrBuffer = '';

      // cloudflared prints the URL to stderr
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuffer += text;

        // Look for the trycloudflare.com URL in the output
        const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
          || stderrBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);

        if (urlMatch && this.state.status === 'starting') {
          const tunnelUrl = urlMatch[0];
          console.log(`🌐 [Tunnel] ✅ Public URL ready: ${tunnelUrl}`);

          this.state.url = tunnelUrl;
          this.state.status = 'running';
          this.state.startedAt = new Date();

          if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
          }

          // Resolve all queued callers
          this.resolveAll(tunnelUrl);
        }
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        // Also check stdout just in case
        const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (urlMatch && this.state.status === 'starting') {
          const tunnelUrl = urlMatch[0];
          console.log(`🌐 [Tunnel] ✅ Public URL ready (stdout): ${tunnelUrl}`);

          this.state.url = tunnelUrl;
          this.state.status = 'running';
          this.state.startedAt = new Date();

          if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
          }

          this.resolveAll(tunnelUrl);
        }
      });

      proc.on('error', (err) => {
        console.error(`🌐 [Tunnel] Process error:`, err.message);
        this.state.status = 'error';
        this.state.error = err.message.includes('ENOENT')
          ? 'cloudflared binary not found. Please install cloudflared.'
          : err.message;

        if (this.startTimeout) {
          clearTimeout(this.startTimeout);
          this.startTimeout = null;
        }

        this.failAll(new Error(this.state.error!));
      });

      proc.on('exit', (code, signal) => {
        console.log(`🌐 [Tunnel] Process exited (code=${code}, signal=${signal})`);

        const wasRunning = this.state.status === 'running';
        this.state.process = null;
        this.state.status = 'stopped';
        this.state.url = null;

        if (this.startTimeout) {
          clearTimeout(this.startTimeout);
          this.startTimeout = null;
        }

        // If it was still starting, fail the queue
        if (!wasRunning) {
          this.failAll(new Error(`cloudflared exited unexpectedly (code=${code})`));
        }
      });
    });
  }

  /**
   * Resolve all queued promises with the tunnel URL.
   */
  private resolveAll(url: string) {
    const queue = this.resolveQueue.splice(0);
    for (const { resolve } of queue) {
      resolve(url);
    }
  }

  /**
   * Reject all queued promises with an error.
   */
  private failAll(err: Error) {
    this.state.status = 'error';
    this.state.error = err.message;
    const queue = this.resolveQueue.splice(0);
    for (const { reject } of queue) {
      reject(err);
    }
  }

  /**
   * Kill the cloudflared process.
   */
  private killProcess() {
    if (this.state.process) {
      try {
        this.state.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.state.process = null;
    }
  }

  /**
   * Stop the tunnel and clean up.
   */
  stopTunnel() {
    console.log('🌐 [Tunnel] Stopping tunnel...');
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    this.killProcess();
    this.state.status = 'stopped';
    this.state.url = null;
    this.state.error = null;
    this.state.startedAt = null;
  }

  /**
   * Check if cloudflared binary is available on this system.
   */
  isCloudflaredAvailable(): boolean {
    return this.findCloudflaredBinary() !== null;
  }
}

// Export singleton instance
export const tunnelManager = new TunnelManager();
