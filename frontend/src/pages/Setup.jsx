import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, CheckCircle, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { updateSystemConfig, testSystemInfluxdb } from '../services/api'

const STEPS = ['Welcome', 'InfluxDB Connection', 'Telegraf Settings', 'Finish']

export default function Setup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    app_title: 'OPC UA Telegraf Admin',
    influxdb_url: 'http://influxdb:8086',
    influxdb_token: '',
    influxdb_org: '',
    influxdb_default_bucket: '',
    telegraf_config_path: '/etc/telegraf/telegraf.conf',
    telegraf_reload_command: 'systemctl reload telegraf',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Save first so the backend can use current values
      await updateSystemConfig({ ...form })
      const result = await testSystemInfluxdb()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      await updateSystemConfig({ ...form })
      navigate('/')
    } catch (e) {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={28} className="text-white" />
            <span className="text-white text-xl font-bold">OPC UA Telegraf Admin</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">Initial Setup</h1>
          <p className="text-blue-200 text-sm mt-1">Configure your administration portal</p>
        </div>

        {/* Step indicators */}
        <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    i < step ? 'bg-blue-600 border-blue-600 text-white' :
                    i === step ? 'border-blue-600 text-blue-600' :
                    'border-gray-300 text-gray-400'
                  }`}>
                    {i < step ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 py-6 min-h-64">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Welcome</h2>
              <p className="text-gray-600">
                This portal lets you manage the bridge between your OPC UA devices and InfluxDB
                via Telegraf. You'll be able to:
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  'Configure OPC UA device connections',
                  'Browse and select tags from each device',
                  'Assign scan classes (read rates) to tags',
                  'Generate Telegraf configuration automatically',
                  'Monitor tag counts and connection status',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div>
                <label className="label">Portal Name</label>
                <input className="input" value={form.app_title} onChange={e => set('app_title', e.target.value)}
                  placeholder="OPC UA Telegraf Admin" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">InfluxDB Connection</h2>
              <p className="text-sm text-gray-500">
                Set the default InfluxDB instance this portal will write to. Individual devices
                can override this later.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">InfluxDB URL</label>
                  <input className="input" value={form.influxdb_url} onChange={e => set('influxdb_url', e.target.value)}
                    placeholder="http://influxdb:8086" />
                </div>
                <div className="col-span-2">
                  <label className="label">API Token</label>
                  <input className="input" type="password" value={form.influxdb_token}
                    onChange={e => set('influxdb_token', e.target.value)} placeholder="your-influxdb-token" />
                </div>
                <div>
                  <label className="label">Organisation</label>
                  <input className="input" value={form.influxdb_org} onChange={e => set('influxdb_org', e.target.value)}
                    placeholder="myorg" />
                </div>
                <div>
                  <label className="label">Default Bucket</label>
                  <input className="input" value={form.influxdb_default_bucket}
                    onChange={e => set('influxdb_default_bucket', e.target.value)} placeholder="opcua" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
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
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Telegraf Settings</h2>
              <p className="text-sm text-gray-500">
                Configure where this portal should write the generated Telegraf configuration file
                and how to reload Telegraf after changes.
              </p>
              <div>
                <label className="label">Telegraf Config File Path</label>
                <input className="input" value={form.telegraf_config_path}
                  onChange={e => set('telegraf_config_path', e.target.value)}
                  placeholder="/etc/telegraf/telegraf.conf" />
                <p className="text-xs text-gray-400 mt-1">
                  Full path to the telegraf.conf file that will be managed by this portal.
                </p>
              </div>
              <div>
                <label className="label">Telegraf Reload Command</label>
                <input className="input" value={form.telegraf_reload_command}
                  onChange={e => set('telegraf_reload_command', e.target.value)}
                  placeholder="systemctl reload telegraf" />
                <p className="text-xs text-gray-400 mt-1">
                  Shell command to reload Telegraf after config changes. Examples:
                  <code className="ml-1 bg-gray-100 px-1 rounded text-xs">systemctl reload telegraf</code>,
                  <code className="ml-1 bg-gray-100 px-1 rounded text-xs">docker restart telegraf</code>
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Setup Complete</h2>
              <p className="text-gray-600">
                Your portal is configured and ready to use. You can update any of these settings
                later from the <strong>Administration</strong> page.
              </p>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Portal Name</span><span className="font-medium">{form.app_title}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">InfluxDB URL</span><span className="font-medium">{form.influxdb_url || '(not set)'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Organisation</span><span className="font-medium">{form.influxdb_org || '(not set)'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Default Bucket</span><span className="font-medium">{form.influxdb_default_bucket || '(not set)'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Config Path</span><span className="font-medium">{form.telegraf_config_path}</span></div>
              </div>
              {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="btn-secondary disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={saving} className="btn-primary">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Launch Portal <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
