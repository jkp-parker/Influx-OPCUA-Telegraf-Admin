import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle, Database,
  Star, RefreshCw,
} from 'lucide-react'
import Modal from '../components/Modal'
import {
  listInfluxConfigs, createInfluxConfig, updateInfluxConfig,
  deleteInfluxConfig, testInfluxConfig, listBuckets,
} from '../services/api'

const EMPTY = { name: '', url: 'http://influxdb:8086', token: '', org: '', bucket: '', is_default: false }

export default function InfluxConfig() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResults, setTestResults] = useState({})
  const [testingId, setTestingId] = useState(null)
  const [buckets, setBuckets] = useState({})
  const [loadingBuckets, setLoadingBuckets] = useState(null)

  const load = () => listInfluxConfigs().then(setConfigs).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setForm(EMPTY); setEditTarget(null); setError(''); setModal('form') }
  const openEdit = (cfg) => {
    setForm({ name: cfg.name, url: cfg.url, token: cfg.token, org: cfg.org, bucket: cfg.bucket, is_default: cfg.is_default })
    setEditTarget(cfg); setError(''); setModal('form')
  }

  const handleSave = async () => {
    if (!form.name || !form.url || !form.token || !form.org || !form.bucket) {
      setError('All fields are required'); return
    }
    setSaving(true); setError('')
    try {
      if (editTarget) await updateInfluxConfig(editTarget.id, form)
      else await createInfluxConfig(form)
      setModal(null); load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this InfluxDB configuration?')) return
    await deleteInfluxConfig(id); load()
  }

  const handleTest = async (id) => {
    setTestingId(id)
    try {
      const result = await testInfluxConfig(id)
      setTestResults(r => ({ ...r, [id]: result }))
    } catch {
      setTestResults(r => ({ ...r, [id]: { success: false, message: 'Request failed' } }))
    } finally { setTestingId(null) }
  }

  const handleListBuckets = async (id) => {
    setLoadingBuckets(id)
    try {
      const result = await listBuckets(id)
      setBuckets(b => ({ ...b, [id]: result.buckets }))
    } catch (e) {
      setBuckets(b => ({ ...b, [id]: [] }))
    } finally { setLoadingBuckets(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">InfluxDB Targets</h1>
          <p className="text-sm text-gray-500 mt-1">Configure InfluxDB connections for your devices</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Connection
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Database className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="font-medium">No InfluxDB targets configured</p>
          <p className="text-sm mt-1">Add a connection to route device data to InfluxDB</p>
          <button onClick={openAdd} className="btn-primary mt-4 mx-auto"><Plus size={16} /> Add Connection</button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => {
            const tr = testResults[cfg.id]
            const cfgBuckets = buckets[cfg.id]
            return (
              <div key={cfg.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{cfg.name}</h3>
                      {cfg.is_default && (
                        <span className="badge badge-yellow flex items-center gap-1">
                          <Star size={10} /> Default
                        </span>
                      )}
                      <span className="badge badge-gray">{cfg.device_count} devices</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">URL</span>
                        <p className="font-mono text-gray-700 text-xs break-all">{cfg.url}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Organisation</span>
                        <p className="text-gray-700">{cfg.org}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Bucket</span>
                        <p className="text-gray-700 font-medium">{cfg.bucket}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Token</span>
                        <p className="text-gray-500 font-mono text-xs">{'•'.repeat(12)}</p>
                      </div>
                    </div>

                    {tr && (
                      <div className={`mt-3 text-sm flex items-center gap-1.5 ${tr.success ? 'text-green-600' : 'text-red-600'}`}>
                        {tr.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {tr.message}
                      </div>
                    )}

                    {cfgBuckets && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {cfgBuckets.length === 0
                          ? <span className="text-xs text-gray-400">No buckets found</span>
                          : cfgBuckets.map(b => (
                              <span key={b} className={`badge ${b === cfg.bucket ? 'badge-blue' : 'badge-gray'}`}>{b}</span>
                            ))
                        }
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-1 ml-4">
                    <button onClick={() => handleTest(cfg.id)} disabled={testingId === cfg.id} className="btn-secondary py-1 text-xs">
                      {testingId === cfg.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Test
                    </button>
                    <button onClick={() => handleListBuckets(cfg.id)} disabled={loadingBuckets === cfg.id} className="btn-secondary py-1 text-xs">
                      {loadingBuckets === cfg.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Buckets
                    </button>
                    <button onClick={() => openEdit(cfg)} className="btn-ghost py-1 px-2"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(cfg.id)} className="btn-ghost py-1 px-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)}
        title={editTarget ? 'Edit InfluxDB Connection' : 'Add InfluxDB Connection'}>
        <div className="space-y-4">
          <div>
            <label className="label">Connection Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Production InfluxDB" />
          </div>
          <div>
            <label className="label">InfluxDB URL *</label>
            <input className="input font-mono" value={form.url} onChange={e => set('url', e.target.value)} placeholder="http://influxdb:8086" />
          </div>
          <div>
            <label className="label">API Token *</label>
            <input className="input" type="password" value={form.token} onChange={e => set('token', e.target.value)} placeholder="your-api-token" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Organisation *</label>
              <input className="input" value={form.org} onChange={e => set('org', e.target.value)} placeholder="myorg" />
            </div>
            <div>
              <label className="label">Default Bucket *</label>
              <input className="input" value={form.bucket} onChange={e => set('bucket', e.target.value)} placeholder="opcua" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_default" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} className="rounded" />
            <label htmlFor="is_default" className="text-sm text-gray-700">Set as default for new devices</label>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-3 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </Modal>
    </div>
  )
}
