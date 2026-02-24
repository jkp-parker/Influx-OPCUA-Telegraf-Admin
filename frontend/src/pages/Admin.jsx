import { useEffect, useState } from 'react'
import { Settings, Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react'
import { getSystemConfig, updateSystemConfig, testSystemInfluxdb } from '../services/api'

export default function Admin() {
  const [form, setForm] = useState({
    app_title: '',
    influxdb_url: '',
    influxdb_token: '',
    influxdb_org: '',
    influxdb_default_bucket: '',
    telegraf_config_path: '',
    telegraf_reload_command: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getSystemConfig().then(cfg => {
      setForm({
        app_title: cfg.app_title || '',
        influxdb_url: cfg.influxdb_url || '',
        influxdb_token: cfg.influxdb_token || '',
        influxdb_org: cfg.influxdb_org || '',
        influxdb_default_bucket: cfg.influxdb_default_bucket || '',
        telegraf_config_path: cfg.telegraf_config_path || '',
        telegraf_reload_command: cfg.telegraf_reload_command || '',
      })
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setSaveResult(null)
    try {
      await updateSystemConfig(form)
      setSaveResult({ success: true, message: 'Configuration saved successfully' })
    } catch {
      setSaveResult({ success: false, message: 'Failed to save configuration' })
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      await updateSystemConfig(form) // save first so backend uses current values
      const result = await testSystemInfluxdb()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Request failed' })
    } finally { setTesting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-500 mt-1">System-wide settings for this portal</p>
      </div>

      {/* Portal settings */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Settings size={16} className="text-blue-500" /> Portal Settings
        </h2>
        <div>
          <label className="label">Portal Name</label>
          <input className="input" value={form.app_title} onChange={e => set('app_title', e.target.value)}
            placeholder="OPC UA Telegraf Admin" />
          <p className="text-xs text-gray-400 mt-1">Shown in the sidebar and browser tab</p>
        </div>
      </div>

      {/* InfluxDB */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-blue-500">⬡</span> Default InfluxDB Connection
        </h2>
        <p className="text-sm text-gray-500 -mt-3">
          Used as the fallback when a device has no specific InfluxDB target assigned.
        </p>
        <div>
          <label className="label">InfluxDB URL</label>
          <input className="input font-mono" value={form.influxdb_url} onChange={e => set('influxdb_url', e.target.value)}
            placeholder="http://influxdb:8086" />
        </div>
        <div>
          <label className="label">API Token</label>
          <input className="input" type="password" value={form.influxdb_token}
            onChange={e => set('influxdb_token', e.target.value)} placeholder="your-influxdb-api-token" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Organisation</label>
            <input className="input" value={form.influxdb_org} onChange={e => set('influxdb_org', e.target.value)} placeholder="myorg" />
          </div>
          <div>
            <label className="label">Default Bucket</label>
            <input className="input" value={form.influxdb_default_bucket}
              onChange={e => set('influxdb_default_bucket', e.target.value)} placeholder="opcua" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleTest} disabled={testing} className="btn-secondary">
            {testing && <Loader2 size={14} className="animate-spin" />}
            Test Connection
          </button>
          {testResult && (
            <span className={`text-sm flex items-center gap-1.5 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {testResult.message}
            </span>
          )}
        </div>
      </div>

      {/* Telegraf */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-blue-500">⚙</span> Telegraf Instance
        </h2>
        <div>
          <label className="label">Config File Path</label>
          <input className="input font-mono" value={form.telegraf_config_path}
            onChange={e => set('telegraf_config_path', e.target.value)}
            placeholder="/etc/telegraf/telegraf.conf" />
          <p className="text-xs text-gray-400 mt-1">
            Full filesystem path of the telegraf.conf this portal manages
          </p>
        </div>
        <div>
          <label className="label">Reload Command</label>
          <input className="input font-mono" value={form.telegraf_reload_command}
            onChange={e => set('telegraf_reload_command', e.target.value)}
            placeholder="systemctl reload telegraf" />
          <p className="text-xs text-gray-400 mt-1">
            Shell command to reload Telegraf after config changes. Examples:
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              'systemctl reload telegraf',
              'docker restart telegraf',
              'kill -HUP $(pidof telegraf)',
            ].map(cmd => (
              <button key={cmd} onClick={() => set('telegraf_reload_command', cmd)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded font-mono transition-colors">
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </button>
        {saveResult && (
          <span className={`text-sm flex items-center gap-1.5 ${saveResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {saveResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  )
}
