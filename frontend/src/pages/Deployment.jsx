import { useEffect, useState, useCallback } from 'react'
import {
  Play, Square, RotateCcw, Trash2, Loader2, CheckCircle, XCircle,
  AlertTriangle, Container, Settings, RefreshCw, Rocket, ScrollText,
  Server, Tag, ChevronDown, ChevronUp, Save, X, Wifi, Shield
} from 'lucide-react'
import {
  getDeploymentStatus, deployInstance, instanceAction, getInstanceLogs,
  deployAll, getDeploymentSettings, updateDeploymentSettings, testDockerConnection
} from '../services/api'
import Modal from '../components/Modal'

const STATUS_BADGES = {
  running: 'bg-green-900/50 text-green-400 border-green-700/50',
  exited: 'bg-red-900/50 text-red-400 border-red-700/50',
  stopped: 'bg-gray-800 text-gray-400 border-gray-700',
  not_created: 'bg-gray-800 text-gray-500 border-gray-700',
  created: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  restarting: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  error: 'bg-red-900/50 text-red-400 border-red-700/50',
}

export default function Deployment() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [deployingAll, setDeployingAll] = useState(false)

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({})
  const [settingsForm, setSettingsForm] = useState({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // Logs
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsInstance, setLogsInstance] = useState(null)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)

  // Expanded rows
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDeploymentStatus()
      setStatus(data)
      setSettings(data.settings || {})
    } catch (e) {
      console.error('Failed to load deployment status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeploy = async (instanceId) => {
    setActionLoading(prev => ({ ...prev, [instanceId]: 'deploy' }))
    try {
      await deployInstance(instanceId)
      await load()
    } catch (e) {
      console.error('Deploy failed:', e)
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceId]: null }))
    }
  }

  const handleAction = async (instanceId, action) => {
    setActionLoading(prev => ({ ...prev, [instanceId]: action }))
    try {
      await instanceAction(instanceId, action)
      await load()
    } catch (e) {
      console.error(`Action ${action} failed:`, e)
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceId]: null }))
    }
  }

  const handleDeployAll = async () => {
    setDeployingAll(true)
    try {
      await deployAll()
      await load()
    } catch (e) {
      console.error('Deploy all failed:', e)
    } finally {
      setDeployingAll(false)
    }
  }

  const openLogs = async (container) => {
    setLogsInstance(container)
    setLogsOpen(true)
    setLogsLoading(true)
    try {
      const data = await getInstanceLogs(container.instance_id, 500)
      setLogs(data.logs || 'No logs available.')
    } catch {
      setLogs('Failed to fetch logs.')
    } finally {
      setLogsLoading(false)
    }
  }

  const refreshLogs = async () => {
    if (!logsInstance) return
    setLogsLoading(true)
    try {
      const data = await getInstanceLogs(logsInstance.instance_id, 500)
      setLogs(data.logs || 'No logs available.')
    } catch {
      setLogs('Failed to fetch logs.')
    } finally {
      setLogsLoading(false)
    }
  }

  const openSettings = () => {
    setSettingsForm({
      docker_enabled: settings.docker_enabled || false,
      telegraf_image: settings.telegraf_image || 'telegraf:1.32',
      telegraf_config_host_path: settings.telegraf_config_host_path || '',
      docker_connection_mode: settings.docker_connection_mode || 'local',
      docker_remote_host: settings.docker_remote_host || '',
      docker_tls_verify: settings.docker_tls_verify || false,
      docker_tls_ca_path: settings.docker_tls_ca_path || '',
      docker_tls_cert_path: settings.docker_tls_cert_path || '',
      docker_tls_key_path: settings.docker_tls_key_path || '',
    })
    setTestResult(null)
    setSettingsOpen(true)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const updated = await updateDeploymentSettings(settingsForm)
      setSettings(updated)
      setSettingsOpen(false)
      await load()
    } catch (e) {
      console.error('Save settings failed:', e)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const result = await testDockerConnection({
        docker_connection_mode: settingsForm.docker_connection_mode,
        docker_remote_host: settingsForm.docker_remote_host,
        docker_tls_verify: settingsForm.docker_tls_verify,
        docker_tls_ca_path: settingsForm.docker_tls_ca_path,
        docker_tls_cert_path: settingsForm.docker_tls_cert_path,
        docker_tls_key_path: settingsForm.docker_tls_key_path,
      })
      setTestResult(result)
    } catch (e) {
      setTestResult({ success: false, error: e.response?.data?.detail || e.message })
    } finally {
      setTestingConnection(false)
    }
  }

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const containers = status?.containers || []
  const dockerAvailable = status?.docker_available || false
  const runningCount = containers.filter(c => c.status === 'running').length
  const isRemote = settingsForm.docker_connection_mode === 'remote'
  const connectionLabel = settings.docker_connection_mode === 'remote'
    ? settings.docker_remote_host || 'Remote'
    : 'Local Socket'

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Deployment</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage Telegraf container deployments via Docker
            {settings.docker_connection_mode === 'remote' && settings.docker_remote_host && (
              <span className="ml-2 text-blue-400">({connectionLabel})</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openSettings} className="btn-secondary">
            <Settings size={14} /> Settings
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleDeployAll}
            disabled={deployingAll || !dockerAvailable || !settings.telegraf_config_host_path}
            className="btn-primary"
          >
            {deployingAll ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            Deploy All
          </button>
        </div>
      </div>

      {/* Docker status banner */}
      {!dockerAvailable && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50">
          <XCircle size={18} className="text-red-400" />
          <div className="text-sm text-red-300">
            <strong>Docker is not available.</strong>{' '}
            {settings.docker_connection_mode === 'remote'
              ? <>Cannot connect to remote Docker host at <code className="text-red-400">{settings.docker_remote_host}</code>. Check the host address and network connectivity.</>
              : <>Make sure the Docker socket is mounted at <code className="text-red-400">/var/run/docker.sock</code> in the FluxForge container, or configure a remote Docker host in Settings.</>
            }
          </div>
        </div>
      )}

      {dockerAvailable && !settings.telegraf_config_host_path && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <AlertTriangle size={16} />
            <span>
              <strong>Config host path not set.</strong> Configure the host path for Telegraf config files in Settings before deploying.
            </span>
          </div>
          <button onClick={openSettings} className="btn-secondary text-xs !py-1 !px-3 border-amber-600 text-amber-300 hover:bg-amber-900/50">
            <Settings size={12} /> Configure
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Container size={14} />
            Total Instances
          </div>
          <div className="text-2xl font-bold text-gray-100">{containers.length}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <CheckCircle size={14} className="text-green-400" />
            Running
          </div>
          <div className="text-2xl font-bold text-green-400">{runningCount}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <XCircle size={14} className="text-gray-500" />
            Stopped / Not Created
          </div>
          <div className="text-2xl font-bold text-gray-400">{containers.length - runningCount}</div>
        </div>
      </div>

      {/* Container list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
          <h2 className="text-sm font-semibold text-gray-200">Telegraf Containers</h2>
        </div>
        {containers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No Telegraf instances found. Create instances in the Telegraf Instances management.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {containers.map(c => {
              const isLoading = actionLoading[c.instance_id]
              const isExpanded = expanded[c.instance_id]
              const badgeClass = STATUS_BADGES[c.status] || STATUS_BADGES.error

              return (
                <div key={c.instance_id}>
                  <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/30 transition-colors">
                    <button
                      onClick={() => toggleExpand(c.instance_id)}
                      className="btn-ghost p-1 rounded"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{c.instance_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {c.status}
                        </span>
                      </div>
                      {c.container_name && (
                        <span className="text-xs text-gray-500 font-mono">{c.container_name}</span>
                      )}
                    </div>

                    {c.image && (
                      <span className="text-xs text-gray-500 hidden md:block">{c.image}</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeploy(c.instance_id)}
                        disabled={!!isLoading || !dockerAvailable || !settings.telegraf_config_host_path}
                        className="btn-primary !py-1 !px-2 text-xs"
                        title="Deploy / Redeploy"
                      >
                        {isLoading === 'deploy' ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
                        Deploy
                      </button>

                      {c.status === 'running' && (
                        <button
                          onClick={() => handleAction(c.instance_id, 'restart')}
                          disabled={!!isLoading}
                          className="btn-secondary !py-1 !px-2 text-xs"
                          title="Restart"
                        >
                          {isLoading === 'restart' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        </button>
                      )}

                      {c.status === 'running' && (
                        <button
                          onClick={() => handleAction(c.instance_id, 'stop')}
                          disabled={!!isLoading}
                          className="btn-secondary !py-1 !px-2 text-xs"
                          title="Stop"
                        >
                          {isLoading === 'stop' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                        </button>
                      )}

                      {c.status !== 'not_created' && (
                        <button
                          onClick={() => handleAction(c.instance_id, 'remove')}
                          disabled={!!isLoading}
                          className="btn-secondary !py-1 !px-2 text-xs text-red-400 hover:text-red-300"
                          title="Remove container"
                        >
                          {isLoading === 'remove' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      )}

                      {c.status !== 'not_created' && (
                        <button
                          onClick={() => openLogs(c)}
                          className="btn-secondary !py-1 !px-2 text-xs"
                          title="View logs"
                        >
                          <ScrollText size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-12 pb-3 text-xs text-gray-400 space-y-1">
                      <div className="flex gap-6">
                        <span>Container: <span className="text-gray-300 font-mono">{c.container_name || 'N/A'}</span></span>
                        <span>Image: <span className="text-gray-300">{c.image || 'N/A'}</span></span>
                        <span>Health: <span className="text-gray-300">{c.health || 'N/A'}</span></span>
                      </div>
                      {c.started_at && (
                        <div>Started: <span className="text-gray-300">{c.started_at}</span></div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Deployment Settings" size="lg">
        <div className="space-y-5">
          {/* General */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.docker_enabled || false}
                onChange={(e) => setSettingsForm(f => ({ ...f, docker_enabled: e.target.checked }))}
                className="checkbox checkbox-sm"
              />
              Enable Docker deployment
            </label>
          </div>

          {/* Connection Mode */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <Wifi size={14} /> Docker Connection
            </h3>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="radio"
                  name="connection_mode"
                  value="local"
                  checked={settingsForm.docker_connection_mode === 'local'}
                  onChange={() => setSettingsForm(f => ({ ...f, docker_connection_mode: 'local' }))}
                  className="radio radio-sm"
                />
                Local Socket
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="radio"
                  name="connection_mode"
                  value="remote"
                  checked={settingsForm.docker_connection_mode === 'remote'}
                  onChange={() => setSettingsForm(f => ({ ...f, docker_connection_mode: 'remote' }))}
                  className="radio radio-sm"
                />
                Remote Host
              </label>
            </div>

            {settingsForm.docker_connection_mode === 'local' && (
              <p className="text-xs text-gray-500">
                Uses the Docker socket at <code className="text-gray-400">/var/run/docker.sock</code>.
                Ensure it is bind-mounted into the FluxForge container.
              </p>
            )}

            {isRemote && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Remote Docker Host</label>
                  <input
                    type="text"
                    value={settingsForm.docker_remote_host || ''}
                    onChange={(e) => setSettingsForm(f => ({ ...f, docker_remote_host: e.target.value }))}
                    className="input w-full"
                    placeholder="tcp://192.168.1.100:2376"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Docker daemon TCP address. Use port 2375 for unencrypted or 2376 for TLS.
                  </p>
                </div>

                {/* TLS Settings */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.docker_tls_verify || false}
                      onChange={(e) => setSettingsForm(f => ({ ...f, docker_tls_verify: e.target.checked }))}
                      className="checkbox checkbox-sm"
                    />
                    <Shield size={14} />
                    Enable TLS verification
                  </label>

                  {settingsForm.docker_tls_verify && (
                    <div className="space-y-3 pl-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">CA Certificate Path</label>
                        <input
                          type="text"
                          value={settingsForm.docker_tls_ca_path || ''}
                          onChange={(e) => setSettingsForm(f => ({ ...f, docker_tls_ca_path: e.target.value }))}
                          className="input w-full text-sm"
                          placeholder="/path/to/ca.pem"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Certificate Path</label>
                        <input
                          type="text"
                          value={settingsForm.docker_tls_cert_path || ''}
                          onChange={(e) => setSettingsForm(f => ({ ...f, docker_tls_cert_path: e.target.value }))}
                          className="input w-full text-sm"
                          placeholder="/path/to/cert.pem"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Key Path</label>
                        <input
                          type="text"
                          value={settingsForm.docker_tls_key_path || ''}
                          onChange={(e) => setSettingsForm(f => ({ ...f, docker_tls_key_path: e.target.value }))}
                          className="input w-full text-sm"
                          placeholder="/path/to/key.pem"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Paths are relative to the FluxForge container. Mount your TLS certificates as a volume.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="mt-3">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || (isRemote && !settingsForm.docker_remote_host)}
                className="btn-secondary text-sm"
              >
                {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Test Connection
              </button>

              {testResult && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-900/30 border border-green-700/50 text-green-300'
                    : 'bg-red-900/30 border border-red-700/50 text-red-300'
                }`}>
                  {testResult.success ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">Connected successfully</span>
                        <div className="text-xs mt-1 text-green-400/80">
                          Docker {testResult.server_version} &middot; {testResult.os} &middot; {testResult.containers} containers &middot; {testResult.images} images
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">Connection failed</span>
                        <div className="text-xs mt-1 text-red-400/80 font-mono">{testResult.error}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Container Settings */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Container Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Telegraf Docker Image</label>
              <input
                type="text"
                value={settingsForm.telegraf_image || ''}
                onChange={(e) => setSettingsForm(f => ({ ...f, telegraf_image: e.target.value }))}
                className="input w-full"
                placeholder="telegraf:1.32"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Config Host Path</label>
              <input
                type="text"
                value={settingsForm.telegraf_config_host_path || ''}
                onChange={(e) => setSettingsForm(f => ({ ...f, telegraf_config_host_path: e.target.value }))}
                className="input w-full"
                placeholder="/path/to/fluxforge/data/telegraf-configs"
              />
              <p className="text-xs text-gray-500 mt-1">
                The host-side path where Telegraf config files are stored.
                {isRemote
                  ? ' This path must exist on the remote Docker host.'
                  : <> This must match where <code className="text-gray-400">/app/data/telegraf-configs</code> is mapped on the Docker host.</>
                }
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-700">
            <button onClick={() => setSettingsOpen(false)} className="btn-secondary">
              <X size={14} /> Cancel
            </button>
            <button onClick={saveSettings} disabled={savingSettings} className="btn-primary">
              {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Settings
            </button>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`Logs: ${logsInstance?.instance_name || ''}`} size="xl">
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={refreshLogs} disabled={logsLoading} className="btn-secondary text-xs">
              <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <pre className="p-4 text-xs font-mono text-gray-300 bg-gray-950 rounded-lg overflow-auto max-h-[60vh] leading-relaxed whitespace-pre-wrap">
              {logs}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  )
}
