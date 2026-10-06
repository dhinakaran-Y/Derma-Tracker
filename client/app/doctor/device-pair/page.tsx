'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { Panel } from '../../../components/Panel';
import { Badge } from '../../../components/Badge';
import { QrBox } from '../../../components/QrBox';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import {
  QrCode,
  Smartphone,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  Trash2,
  Clock,
  Monitor,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Globe,
  Wifi,
  Zap,
  AlertTriangle,
  ExternalLink,
  X,
  Pencil,
  Check,
} from 'lucide-react';

interface PairedDevice {
  _id: string;
  token: string;
  deviceName: string;
  isCustomName?: boolean;
  isPasswordVerified: boolean;
  connectionStatus: 'active' | 'idle' | 'offline';
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  mobileUrl?: string;
  lanUrl?: string;
  tunnelUrl?: string;
  isTunnelActive?: boolean;
}

interface TunnelStatus {
  status: 'stopped' | 'starting' | 'running' | 'error' | 'unavailable';
  url: string | null;
  cloudflaredInstalled: boolean;
}

export default function DevicePairPage() {
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [newPairingUrl, setNewPairingUrl] = useState<string | null>(null);
  const [newPairingLanUrl, setNewPairingLanUrl] = useState<string | null>(null);
  const [newPairingTunnelUrl, setNewPairingTunnelUrl] = useState<string | null>(null);
  const [newPairingToken, setNewPairingToken] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const [qrModalDevice, setQrModalDevice] = useState<PairedDevice | null>(null);
  const [isTunnelActive, setIsTunnelActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [tunnelStarting, setTunnelStarting] = useState(false);
  const [networkMode, setNetworkMode] = useState<'lan' | 'tunnel'>('lan');
  const [restartingTunnel, setRestartingTunnel] = useState(false);

  // Device renaming state
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [savingRename, setSavingRename] = useState(false);

  // Helper to compute or get exact mobile URL for a paired device
  const getDeviceMobileUrl = useCallback(
    (device: PairedDevice, mode: 'lan' | 'tunnel' = networkMode) => {
      if (mode === 'lan' && device.lanUrl) return device.lanUrl;
      if (mode === 'tunnel') {
        if (device.tunnelUrl) return device.tunnelUrl;
        if (tunnelStatus?.url && tunnelStatus.status === 'running') {
          return `${tunnelStatus.url.replace(/\/+$/, '')}/mobile/${device.token}`;
        }
      }
      if (device.mobileUrl) return device.mobileUrl;
      if (typeof window !== 'undefined') {
        return `${window.location.origin}/mobile/${device.token}`;
      }
      return `/mobile/${device.token}`;
    },
    [networkMode, tunnelStatus]
  );

  // Restart Cloudflare tunnel if edge is stuck or giving Error 1033
  const handleRestartTunnel = async () => {
    setRestartingTunnel(true);
    try {
      const res = await api.post('/tunnel/restart');
      if (res.data?.success && res.data.data?.url) {
        toast.success('Cloudflare tunnel restarted with fresh URL!');
        setTunnelStatus({ status: 'running', url: res.data.data.url, cloudflaredInstalled: true });
        setIsTunnelActive(true);
        setNewPairingTunnelUrl(`${res.data.data.url.replace(/\/+$/, '')}/mobile/${newPairingToken || ''}`);
        fetchDevices();
      } else {
        toast.error('Failed to restart tunnel: ' + (res.data?.error || 'Unknown error'));
      }
    } catch {
      toast.error('Error restarting Cloudflare tunnel');
    } finally {
      setRestartingTunnel(false);
    }
  };

  // Handle clicking on an existing device card to show its QR code
  const handleSelectDevice = useCallback(
    (device: PairedDevice) => {
      setSelectedDevice(device);
      setNewPairingToken(device.token);
      setNewPairingLanUrl(device.lanUrl || null);
      setNewPairingTunnelUrl(device.tunnelUrl || null);
      const url = getDeviceMobileUrl(device, networkMode);
      setNewPairingUrl(url);
      setIsTunnelActive(device.isTunnelActive ?? (tunnelStatus?.status === 'running'));
      setQrModalDevice(device);
    },
    [getDeviceMobileUrl, networkMode, tunnelStatus]
  );

  // Fetch paired devices
  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/device-pairing/my-devices');
      setDevices(res.data.data || []);
    } catch {
      // Silently fail on polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tunnel status on mount
  const fetchTunnelStatus = useCallback(async () => {
    try {
      const res = await api.get('/tunnel/status');
      if (res.data?.success) {
        setTunnelStatus(res.data.data);
        if (res.data.data.status === 'running' && res.data.data.url) {
          setIsTunnelActive(true);
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchTunnelStatus();
    // Auto-refresh devices every 10 seconds
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchTunnelStatus]);

  // Start tunnel and generate QR in one step
  const handleGeneratePairing = async () => {
    try {
      setSelectedDevice(null);
      setGenerating(true);
      setTunnelStarting(true);

      // Step 1: Start tunnel (if not already running)
      let tunnelActive = isTunnelActive;
      if (!tunnelActive) {
        try {
          const tunnelRes = await api.post('/tunnel/start');
          if (tunnelRes.data?.success && tunnelRes.data.data) {
            const td = tunnelRes.data.data;
            if (td.status === 'running' && td.url) {
              tunnelActive = true;
              setIsTunnelActive(true);
              setTunnelStatus({ status: 'running', url: td.url, cloudflaredInstalled: true });
            } else if (td.status === 'unavailable') {
              // cloudflared not installed — will fall back to LAN mode
              setTunnelStatus({ status: 'unavailable', url: null, cloudflaredInstalled: false });
            }
          }
        } catch {
          // Tunnel failed — will fall back to LAN mode
        }
      }
      setTunnelStarting(false);

      // Step 2: Generate pairing QR (backend auto-uses tunnel URL if available)
      const res = await api.post('/device-pairing', {});
      if (res.data?.success && res.data.data) {
        setNewPairingUrl(res.data.data.mobileUrl);
        setNewPairingLanUrl(res.data.data.lanUrl || null);
        setNewPairingTunnelUrl(res.data.data.tunnelUrl || null);
        setNewPairingToken(res.data.data.token);
        setIsTunnelActive(!!res.data.data.isTunnelActive);

        if (res.data.data.isTunnelActive) {
          toast.success('Cross-network QR generated — scan from any mobile');
        } else {
          toast.success('QR generated — scan from same Wi-Fi network');
        }
        fetchDevices();
      }
    } catch {
      toast.error('Failed to generate pairing QR');
    } finally {
      setGenerating(false);
      setTunnelStarting(false);
    }
  };

  const [confirmRemoveToken, setConfirmRemoveToken] = useState<string | null>(null);

  // Remove a device
  const handleRemoveDevice = async (token: string) => {
    if (confirmRemoveToken !== token) {
      setConfirmRemoveToken(token);
      setTimeout(() => setConfirmRemoveToken(null), 4000);
      return;
    }

    try {
      setRemovingToken(token);
      setConfirmRemoveToken(null);
      await api.delete(`/device-pairing/${token}`);
      toast.success('Device disconnected');
      setDevices((prev) => prev.filter((d) => d.token !== token));
      // If the removed device was the newly generated or selected one, clear it
      if (token === newPairingToken || selectedDevice?.token === token) {
        setNewPairingUrl(null);
        setNewPairingToken(null);
        setSelectedDevice(null);
        if (qrModalDevice?.token === token) {
          setQrModalDevice(null);
        }
      }
    } catch {
      toast.error('Failed to remove device');
    } finally {
      setRemovingToken(null);
    }
  };

  // Start renaming a device
  const handleStartRename = (device: PairedDevice) => {
    setEditingToken(device.token);
    setEditingName(device.deviceName);
  };

  // Save renamed device
  const handleSaveRename = async (token: string) => {
    if (!editingName.trim()) {
      toast.error('Device name cannot be empty');
      return;
    }
    try {
      setSavingRename(true);
      const res = await api.patch(`/device-pairing/${token}/rename`, {
        deviceName: editingName.trim(),
      });
      if (res.data?.success) {
        const updatedName = res.data.data.deviceName;
        setDevices((prev) =>
          prev.map((d) => (d.token === token ? { ...d, deviceName: updatedName, isCustomName: true } : d))
        );
        if (selectedDevice?.token === token) {
          setSelectedDevice((prev) => (prev ? { ...prev, deviceName: updatedName, isCustomName: true } : null));
        }
        if (qrModalDevice?.token === token) {
          setQrModalDevice((prev) => (prev ? { ...prev, deviceName: updatedName, isCustomName: true } : null));
        }
        toast.success(`Device renamed to "${updatedName}"`);
        setEditingToken(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to rename device');
    } finally {
      setSavingRename(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-400';
      case 'idle': return 'bg-amber-400';
      case 'offline': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'idle': return 'Idle';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warn' | 'neutral' => {
    switch (status) {
      case 'active': return 'success';
      case 'idle': return 'warn';
      default: return 'neutral';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <AppShell
      navGroups={[
        {
          items: [
            { id: 'workbench', label: 'Doctor Workbench', icon: ArrowLeft },
            { id: 'pair', label: 'Device Pairing', icon: QrCode },
          ],
        },
      ]}
      activeTab="pair"
      onTabChange={(tab) => {
        if (tab === 'workbench') {
          window.location.href = '/doctor';
        }
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor"
              className="p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors border border-[var(--border)]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[var(--text)] font-mono flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[var(--brass)]" />
                Mobile Device Management
              </h1>
              <p className="text-xs text-[var(--text-dim)]">
                Pair mobile devices for scalp photo capture • Works across any network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={devices.filter(d => d.connectionStatus === 'active').length > 0 ? 'success' : 'neutral'}>
              {devices.filter(d => d.connectionStatus === 'active').length} Active Device{devices.filter(d => d.connectionStatus === 'active').length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Generate New Pairing QR (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <Panel
              title={selectedDevice ? "Revisit Device QR" : "Pair New Device"}
              subtitle={
                selectedDevice
                  ? `Scan to reconnect ${selectedDevice.deviceName} without typing password`
                  : "Generate a QR code and scan with any mobile phone"
              }
            >
              <div className="flex flex-col items-center justify-center p-4 space-y-4">
                {selectedDevice && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brass)]/15 border border-[var(--brass)]/30 text-[var(--brass)] text-xs font-mono font-semibold">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Revisit QR: {selectedDevice.deviceName}</span>
                    <button
                      type="button"
                      onClick={() => handleStartRename(selectedDevice)}
                      className="p-0.5 hover:text-white transition-colors cursor-pointer"
                      title="Rename device"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {newPairingUrl ? (
                  <>
                    {/* Network Mode Switcher */}
                    <div className="w-full flex items-center justify-center p-1 bg-[var(--surface-3)] rounded-xl border border-[var(--border)] gap-1">
                      <button
                        type="button"
                        onClick={() => setNetworkMode('lan')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all ${
                          networkMode === 'lan'
                            ? 'bg-[var(--brass)] text-black shadow-md'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Clinic Wi-Fi (Direct)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNetworkMode('tunnel')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all ${
                          networkMode === 'tunnel'
                            ? 'bg-emerald-500 text-black shadow-md'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Cloudflare (Mobile Data)</span>
                      </button>
                    </div>

                    {/* Mode Guidance */}
                    {networkMode === 'lan' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono">
                        <Wifi className="w-3 h-3" />
                        <span>Same Wi-Fi • 100% Reliable • No Error 1033</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
                          <Globe className="w-3 h-3" />
                          <span>Any Network • 4G / 5G Cellular</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRestartTunnel}
                          disabled={restartingTunnel}
                          className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${restartingTunnel ? 'animate-spin' : ''}`} />
                          <span>{restartingTunnel ? 'Restarting tunnel...' : 'Fix Error 1033: Restart Cloudflare Tunnel'}</span>
                        </button>
                      </div>
                    )}

                    {/* QR Code */}
                    {(() => {
                      const activeDisplayUrl = (networkMode === 'lan'
                        ? (selectedDevice?.lanUrl || newPairingLanUrl)
                        : (selectedDevice?.tunnelUrl || newPairingTunnelUrl))
                        || newPairingUrl;

                      return (
                        <>
                          <div className="relative group p-3 bg-white rounded-xl shadow-lg border-2 border-[var(--brass)]/50">
                            <QrBox value={activeDisplayUrl} label={selectedDevice ? "SCAN TO REVISIT" : "SCAN TO PAIR"} />
                          </div>

                          {/* Direct URL copy box */}
                          <div className="flex items-center justify-between gap-2 w-full p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs">
                            <span className="truncate font-mono text-[var(--text)] text-[11px] select-all max-w-[260px]">
                              {activeDisplayUrl}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(activeDisplayUrl);
                                  toast.success('Mobile URL copied to clipboard');
                                }}
                                className="p-1.5 text-[var(--brass)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)] transition-colors flex items-center gap-1 font-semibold text-xs"
                                title="Copy link"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={activeDisplayUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-[var(--brass)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                                title="Open URL in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      {selectedDevice && (
                        <button
                          type="button"
                          onClick={() => setQrModalDevice(selectedDevice)}
                          className="text-xs font-mono text-[var(--brass)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <QrCode className="w-3 h-3" />
                          Enlarge QR
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGeneratePairing}
                        disabled={generating}
                        className="text-xs font-mono text-[var(--brass)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        {selectedDevice ? "Pair A New Device (New QR)" : "Generate Another QR"}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleGeneratePairing}
                    disabled={generating}
                    className="btn-brass px-6 py-3 rounded-xl text-sm font-mono font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {tunnelStarting ? 'Starting Secure Tunnel...' : 'Generating...'}
                      </>
                    ) : (
                      <><QrCode className="w-4 h-4" /> Generate Pairing QR Code</>
                    )}
                  </button>
                )}
              </div>

              {/* Instructions */}
              <div className="p-3 bg-[var(--surface-2)]/60 rounded-md border border-[var(--border)] space-y-2 text-xs">
                <strong className="block text-[var(--brass)] font-semibold font-mono text-[11px] uppercase tracking-wider">
                  📱 How It Works:
                </strong>
                <ol className="list-decimal list-inside space-y-1 text-[var(--text-dim)] text-[11px]">
                  <li>Click <strong className="text-[var(--text)]">&quot;Generate Pairing QR&quot;</strong> above.</li>
                  <li>Scan the QR with your phone camera — <strong className="text-[var(--text)]">any network works</strong> (Wi-Fi, 4G, 5G).</li>
                  <li>Enter your doctor password on the phone to authenticate.</li>
                  <li>Device stays paired for <strong className="text-[var(--text)]">30 days</strong> — no re-scanning needed.</li>
                  <li>Phone auto-detects the active patient and enables camera.</li>
                </ol>
              </div>

              {/* Tunnel Status Indicator */}
              {tunnelStatus && (
                <div className={`mt-3 p-2.5 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
                  tunnelStatus.status === 'running'
                    ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                    : tunnelStatus.status === 'unavailable'
                      ? 'bg-amber-500/5 border-amber-500/15 text-amber-400'
                      : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-dim)]'
                }`}>
                  {tunnelStatus.status === 'running' ? (
                    <>
                      <Zap className="w-3 h-3" />
                      <span>Secure tunnel active — QR works on any network</span>
                    </>
                  ) : tunnelStatus.status === 'unavailable' ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>cloudflared not installed — same Wi-Fi only</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3 h-3" />
                      <span>Tunnel will start when you generate a QR</span>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </div>

          {/* Right Column: Connected Devices List (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <Panel
              title="Connected Devices"
              subtitle={
                devices.length === 1
                  ? "1 device paired • Click card or button to display QR code"
                  : `${devices.length} devices paired • Click any card to display its QR code`
              }
            >
              <div className="space-y-3">
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-6 h-6 text-[var(--brass)] animate-spin mx-auto mb-2" />
                    <p className="text-xs text-[var(--text-dim)]">Loading devices...</p>
                  </div>
                ) : devices.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--surface-2)]/40 rounded-lg border border-[var(--border)] border-dashed space-y-2">
                    <Monitor className="w-10 h-10 text-[var(--text-dim)] mx-auto opacity-40" />
                    <p className="text-xs font-mono text-[var(--text-dim)]">No devices paired yet.</p>
                    <p className="text-[10px] text-[var(--text-dim)]">
                      Generate a QR code on the left and scan with your mobile phone.
                    </p>
                  </div>
                ) : (
                  devices.map((device) => (
                    <div
                      key={device.token}
                      onClick={() => handleSelectDevice(device)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer group hover:border-[var(--brass)]/80 hover:shadow-md ${
                        selectedDevice?.token === device.token
                          ? 'ring-2 ring-[var(--brass)] border-[var(--brass)] bg-[var(--brass)]/5 dark:bg-[var(--brass)]/10'
                          : device.connectionStatus === 'active'
                            ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-900/10'
                            : device.connectionStatus === 'idle'
                              ? 'bg-amber-500/5 border-amber-500/20 dark:bg-amber-900/10'
                              : 'bg-[var(--surface-2)] border-[var(--border)]'
                      }`}
                      title="Click card to view QR code & revisit mobile session"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Device Info */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            device.connectionStatus === 'active'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'
                              : device.connectionStatus === 'idle'
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                                : 'bg-[var(--surface-3)] text-[var(--text-dim)] border border-[var(--border)]'
                          }`}>
                            <Smartphone className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {editingToken === device.token ? (
                                <div
                                  className="flex items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRename(device.token);
                                      if (e.key === 'Escape') setEditingToken(null);
                                    }}
                                    placeholder="e.g. Realme 7, Oppo A23"
                                    className="px-2 py-0.5 text-xs font-semibold bg-[var(--surface-1)] border border-[var(--brass)] rounded text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] w-44 shadow-xs"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRename(device.token)}
                                    disabled={savingRename}
                                    className="p-1 rounded bg-[var(--brass)] text-black hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
                                    title="Save name"
                                  >
                                    {savingRename ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingToken(null)}
                                    className="p-1 rounded bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group/name">
                                  <h4 className="text-sm font-bold text-[var(--text)] truncate">
                                    {device.deviceName}
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRename(device);
                                    }}
                                    className="p-1 rounded hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--brass)] transition-colors cursor-pointer opacity-70 group-hover/name:opacity-100"
                                    title="Rename this device"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              <Badge variant={getStatusVariant(device.connectionStatus)}>
                                <span className="flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(device.connectionStatus)} ${device.connectionStatus === 'active' ? 'animate-pulse' : ''}`} />
                                  {getStatusLabel(device.connectionStatus)}
                                </span>
                              </Badge>
                              {device.isPasswordVerified ? (
                                <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
                                  <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                                  <ShieldAlert className="w-3 h-3" /> Awaiting Auth
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-[var(--brass)] font-mono flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100">
                              <QrCode className="w-3 h-3" /> Click card to show revisit QR code
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-dim)] font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last active: {formatTimeAgo(device.lastActiveAt)}
                              </span>
                              <span>
                                Paired: {new Date(device.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span>
                                Expires: {new Date(device.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDevice(device);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--brass)]/15 hover:bg-[var(--brass)]/25 text-[var(--brass)] border border-[var(--brass)]/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm group-hover:bg-[var(--brass)] group-hover:text-black"
                            title="Show old generated QR code to revisit"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Revisit QR</span>
                          </button>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDevice(device.token);
                            }}
                            disabled={removingToken === device.token}
                            className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                              confirmRemoveToken === device.token
                                ? 'bg-red-600 text-white px-2.5 py-1 text-xs font-bold animate-pulse'
                                : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                            }`}
                            title={confirmRemoveToken === device.token ? "Click again to permanently disconnect" : "Remove device"}
                          >
                            {removingToken === device.token ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : confirmRemoveToken === device.token ? (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Disconnect?</span>
                              </>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Auto-refresh indicator */}
              {devices.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-dim)] font-mono">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Auto-refreshing every 10s
                  </span>
                  <button
                    type="button"
                    onClick={fetchDevices}
                    className="text-[var(--brass)] hover:underline cursor-pointer"
                  >
                    Refresh Now
                  </button>
                </div>
              )}
            </Panel>

            {/* Back to workbench */}
            <div className="flex justify-end">
              <Link
                href="/doctor"
                className="btn-brass px-4 py-2 rounded text-xs font-mono font-semibold flex items-center gap-1.5"
              >
                Return to Doctor Workbench
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ================= REVISIT QR MODAL ================= */}
      {qrModalDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setQrModalDevice(null)}
        >
          <div
            className="relative w-full max-w-md bg-[var(--surface-1)] border-2 border-[var(--brass)]/60 rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--brass)]/15 border border-[var(--brass)]/30 flex items-center justify-center text-[var(--brass)] shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                    {qrModalDevice.deviceName}
                  </h3>
                  <p className="text-xs text-[var(--text-dim)] font-mono">
                    Revisit Mobile Session • No re-pairing needed
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalDevice(null)}
                className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(qrModalDevice.connectionStatus)}>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(qrModalDevice.connectionStatus)}`} />
                  {getStatusLabel(qrModalDevice.connectionStatus)}
                </span>
              </Badge>
              {qrModalDevice.isPasswordVerified ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                  <ShieldCheck className="w-3 h-3" /> Already Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
                  <ShieldAlert className="w-3 h-3" /> Awaiting Auth
                </span>
              )}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                (qrModalDevice.isTunnelActive ?? isTunnelActive)
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              }`}>
                {(qrModalDevice.isTunnelActive ?? isTunnelActive) ? (
                  <>
                    <Globe className="w-3 h-3" />
                    <span>Cross-Network</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Same Wi-Fi</span>
                  </>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
              <div className="p-3 bg-white rounded-xl shadow-lg border-2 border-[var(--brass)]/60">
                <QrBox
                  value={getDeviceMobileUrl(qrModalDevice)}
                  size={190}
                  label="SCAN TO REVISIT"
                />
              </div>

              <p className="mt-3 text-xs text-center text-[var(--text-dim)] max-w-xs leading-relaxed">
                Scan this QR code with your mobile camera to reopen the mobile capture workbench without searching your browser history.
              </p>
            </div>

            {/* Direct Link Box */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs">
              <span className="truncate font-mono text-[var(--text)] text-[11px] select-all max-w-[260px]">
                {getDeviceMobileUrl(qrModalDevice)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getDeviceMobileUrl(qrModalDevice));
                    toast.success('Mobile URL copied to clipboard');
                  }}
                  className="p-1.5 text-[var(--brass)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href={getDeviceMobileUrl(qrModalDevice)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-[var(--brass)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                  title="Open URL in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-[var(--text-dim)]">
              <span>Expires: {new Date(qrModalDevice.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <button
                type="button"
                onClick={() => setQrModalDevice(null)}
                className="btn-brass px-4 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
