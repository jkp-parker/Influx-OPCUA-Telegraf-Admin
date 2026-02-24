import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Clock } from 'lucide-react'
import Modal from '../components/Modal'
import { listScanClasses, createScanClass, updateScanClass, deleteScanClass } from '../services/api'

const PRESETS = [
  { name: 'Fast', interval_ms: 100, description: 'High-frequency reads (100ms)' },
  { name: 'Normal', interval_ms: 1000, description: 'Standard 1-second polling' },
  { name: 'Slow', interval_ms: 10000, description: 'Low-frequency reads (10s)' },
  { name: 'VeryFast', interval_ms: 50, description: 'Ultra-fast 50ms polling' },
]

function formatInterval(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${ms / 1000}s`
  if (ms < 3600000) return `${ms / 60000}m`
  return `${ms / 3600000}h`
}

const EMPTY = { name: '', interval_ms: 1000, description: '' }

export default function ScanClasses() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => listScanClasses().then(setClasses).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = (preset) => {
    setForm(preset ? { ...preset } : EMPTY)
    setEditTarget(null); setError(''); setModal('form')
  }
  const openEdit = (sc) => {
    setForm({ name: sc.name, interval_ms: sc.interval_ms, description: sc.description })
    setEditTarget(sc); setError(''); setModal('form')
  }

  const handleSave = async () => {
    if (!form.name) { setError('Name is required'); return }
    if (!form.interval_ms || form.interval_ms < 1) { setError('Interval must be at least 1ms'); return }
    setSaving(true); setError('')
    try {
      if (editTarget) await updateScanClass(editTarget.id, form)
      else await createScanClass(form)
      setModal(null); load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this scan class? Tags will be unassigned.')) return
    await deleteScanClass(id); load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan Classes</h1>
          <p className="text-sm text-gray-500 mt-1">Define read-rate groups for OPC UA tags</p>
        </div>
        <button onClick={() => openAdd(null)} className="btn-primary">
          <Plus size={16} /> Add Scan Class
        </button>
      </div>

      {/* Presets */}
      {classes.length === 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick-add presets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => openAdd(p)}
                className="text-left p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                <div className="text-blue-600 font-mono text-xs mt-0.5">{formatInterval(p.interval_ms)}</div>
                <div className="text-gray-400 text-xs mt-1">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Clock className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="font-medium">No scan classes yet</p>
          <p className="text-sm mt-1">Use the presets above or create a custom one</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th text-center">Interval</th>
                <th className="table-th text-center">Tags Assigned</th>
                <th className="table-th">Description</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map(sc => (
                <tr key={sc.id} className="hover:bg-gray-50">
                  <td className="table-td font-semibold text-gray-800">{sc.name}</td>
                  <td className="table-td text-center">
                    <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-sm">
                      {formatInterval(sc.interval_ms)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">({sc.interval_ms}ms)</span>
                  </td>
                  <td className="table-td text-center font-semibold">{sc.tag_count}</td>
                  <td className="table-td text-gray-500 text-sm">{sc.description || '—'}</td>
                  <td className="table-td">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(sc)} className="btn-ghost py-1 px-2"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(sc.id)} className="btn-ghost py-1 px-2 text-red-500 hover:bg-red-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)}
        title={editTarget ? 'Edit Scan Class' : 'New Scan Class'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Fast" />
          </div>
          <div>
            <label className="label">Interval (milliseconds) *</label>
            <input className="input" type="number" min="1" value={form.interval_ms}
              onChange={e => set('interval_ms', Number(e.target.value))} />
            <p className="text-xs text-gray-400 mt-1">
              = {formatInterval(Number(form.interval_ms) || 0)} — maps to Telegraf's <code>interval</code>
            </p>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Standard 1-second polling" />
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
