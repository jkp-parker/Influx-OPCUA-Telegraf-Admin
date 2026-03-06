import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Clock, Star, Check, Server, Tag } from 'lucide-react'
import Modal from '../components/Modal'
import {
  listScanClasses, createScanClass, updateScanClass, deleteScanClass,
  setDefaultScanClass, clearDefaultScanClass,
  listTelegrafInstances, createTelegrafInstance, updateTelegrafInstance, deleteTelegrafInstance,
} from '../services/api'

const PRESETS = [
  { name: 'VeryFast', interval_ms: 50, description: 'Ultra-fast 50ms polling' },
  { name: 'Fast', interval_ms: 100, description: 'High-frequency reads (100ms)' },
  { name: 'Normal', interval_ms: 1000, description: 'Standard 1-second polling' },
  { name: 'Slow', interval_ms: 5000, description: 'Low-frequency reads (5s)' },
  { name: 'VerySlow', interval_ms: 10000, description: 'Very slow 10-second polling' },
  { name: 'Minute', interval_ms: 60000, description: 'Once per minute' },
]

const PRESET_NAMES = new Set(PRESETS.map(p => p.name))

function formatInterval(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${ms / 1000}s`
  if (ms < 3600000) return `${ms / 60000}m`
  return `${ms / 3600000}h`
}

const EMPTY = { name: '', interval_ms: 1000, description: '' }
const EMPTY_INSTANCE = { name: '', description: '', enabled: true }

export default function ScanClasses() {
  const [classes, setClasses] = useState([])
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [instForm, setInstForm] = useState(EMPTY_INSTANCE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState(null)

  const load = () => Promise.all([
    listScanClasses(),
    listTelegrafInstances(),
  ]).then(([sc, inst]) => { setClasses(sc); setInstances(inst) })
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setInst = (k, v) => setInstForm(f => ({ ...f, [k]: v }))

  const classByName = Object.fromEntries(classes.map(c => [c.name, c]))
  const customClasses = classes.filter(c => !PRESET_NAMES.has(c.name))
  const defaultClass = classes.find(c => c.is_default)

  // Scan class handlers
  const openAdd = () => { setForm(EMPTY); setEditTarget(null); setError(''); setModal('form') }
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

  const handleTogglePreset = async (preset) => {
    const existing = classByName[preset.name]
    setToggling(preset.name)
    try {
      if (existing) await deleteScanClass(existing.id)
      else await createScanClass(preset)
      await load()
    } finally { setToggling(null) }
  }

  const handleSetDefault = async (sc) => {
    if (sc.is_default) await clearDefaultScanClass(sc.id)
    else await setDefaultScanClass(sc.id)
    await load()
  }

  // Telegraf instance handlers
  const openAddInstance = () => { setInstForm(EMPTY_INSTANCE); setEditTarget(null); setError(''); setModal('instance') }
  const openEditInstance = (inst) => {
    setInstForm({ name: inst.name, description: inst.description, enabled: inst.enabled })
    setEditTarget(inst); setError(''); setModal('instance')
  }

  const handleSaveInstance = async () => {
    if (!instForm.name) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      if (editTarget) await updateTelegrafInstance(editTarget.id, instForm)
      else await createTelegrafInstance(instForm)
      setModal(null); load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDeleteInstance = async (id) => {
    if (!confirm('Delete this Telegraf instance? Tags will become unassigned.')) return
    await deleteTelegrafInstance(id); load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Ingestion Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure read-rate groups and Telegraf container instances.
          {defaultClass && (
            <span className="ml-1">
              Default scan class: <span className="text-blue-400 font-medium">{defaultClass.name}</span> ({formatInterval(defaultClass.interval_ms)})
            </span>
          )}
        </p>
      </div>

      {/* Telegraf Instances */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-300">Telegraf Instances</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Define Telegraf containers. Assign tags to instances on the Tag Management page.
            </p>
          </div>
          <button onClick={openAddInstance} className="btn-primary py-1.5 text-sm">
            <Plus size={14} /> Add Instance
          </button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Server className="mx-auto mb-2 text-gray-600" size={32} />
            <p className="text-sm">No Telegraf instances defined</p>
            <p className="text-xs text-gray-600 mt-1">Create at least one instance to generate configs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Description</th>
                  <th className="table-th text-center">Devices</th>
                  <th className="table-th text-center">Tags</th>
                  <th className="table-th text-center">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {instances.map(inst => (
                  <tr key={inst.id} className="hover:bg-gray-800/50">
                    <td className="table-td font-semibold text-gray-200">
                      <span className="flex items-center gap-2">
                        <Server size={14} className="text-blue-400" />
                        {inst.name}
                      </span>
                    </td>
                    <td className="table-td text-gray-400 text-sm">{inst.description || '—'}</td>
                    <td className="table-td text-center font-semibold">{inst.device_count}</td>
                    <td className="table-td text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Tag size={12} className="text-gray-500" />
                        <span className="font-semibold">{inst.tag_count}</span>
                      </span>
                    </td>
                    <td className="table-td text-center">
                      <span className={`badge ${inst.enabled ? 'badge-green' : 'badge-gray'}`}>
                        {inst.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditInstance(inst)} className="btn-ghost py-1 px-2"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteInstance(inst.id)} className="btn-ghost py-1 px-2 text-red-400 hover:bg-red-900/30">
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
      </div>

      {/* Preset scan classes */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Preset Scan Classes</h2>
        <p className="text-xs text-gray-500 mb-4">Toggle presets to enable them. Enabled presets are available for tag assignment.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PRESETS.map(preset => {
            const existing = classByName[preset.name]
            const enabled = !!existing
            const isToggling = toggling === preset.name
            return (
              <div
                key={preset.name}
                className={`relative rounded-lg border-2 p-3 transition-all ${
                  enabled
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-700 bg-gray-800/50 opacity-60 hover:opacity-100'
                }`}
              >
                <button
                  onClick={() => handleTogglePreset(preset)}
                  disabled={isToggling || (enabled && existing.tag_count > 0)}
                  title={enabled && existing.tag_count > 0 ? `${existing.tag_count} tags assigned — remove tags first` : enabled ? 'Click to disable' : 'Click to enable'}
                  className={`absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    enabled
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-600 text-transparent hover:border-gray-400'
                  } ${enabled && existing.tag_count > 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isToggling ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                </button>

                {enabled && (
                  <button
                    onClick={() => handleSetDefault(existing)}
                    title={existing.is_default ? 'Remove as default' : 'Set as default for new tags'}
                    className="absolute top-2 left-2"
                  >
                    <Star size={14} className={existing.is_default ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-yellow-400'} />
                  </button>
                )}

                <div className="mt-4">
                  <div className="font-semibold text-gray-200 text-sm">{preset.name}</div>
                  <div className="text-blue-400 font-mono text-xs mt-0.5">{formatInterval(preset.interval_ms)}</div>
                  <div className="text-gray-500 text-xs mt-1">{preset.description}</div>
                  {enabled && (
                    <div className="text-xs text-gray-400 mt-2">
                      {existing.tag_count} tag{existing.tag_count !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom scan classes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-300">Custom Scan Classes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create scan classes with custom intervals</p>
          </div>
          <button onClick={openAdd} className="btn-primary py-1.5 text-sm">
            <Plus size={14} /> Add Custom
          </button>
        </div>

        {customClasses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="mx-auto mb-2 text-gray-600" size={32} />
            <p className="text-sm">No custom scan classes yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="table-th w-8"></th>
                  <th className="table-th">Name</th>
                  <th className="table-th text-center">Interval</th>
                  <th className="table-th text-center">Tags</th>
                  <th className="table-th">Description</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {customClasses.map(sc => (
                  <tr key={sc.id} className="hover:bg-gray-800/50">
                    <td className="table-td">
                      <button onClick={() => handleSetDefault(sc)} title={sc.is_default ? 'Remove as default' : 'Set as default'}>
                        <Star size={14} className={sc.is_default ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-yellow-400'} />
                      </button>
                    </td>
                    <td className="table-td font-semibold text-gray-200">{sc.name}</td>
                    <td className="table-td text-center">
                      <span className="font-mono text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded text-sm">
                        {formatInterval(sc.interval_ms)}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">({sc.interval_ms}ms)</span>
                    </td>
                    <td className="table-td text-center font-semibold">{sc.tag_count}</td>
                    <td className="table-td text-gray-400 text-sm">{sc.description || '—'}</td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(sc)} className="btn-ghost py-1 px-2"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(sc.id)} className="btn-ghost py-1 px-2 text-red-400 hover:bg-red-900/30">
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
      </div>

      {/* All enabled classes summary */}
      {classes.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Active Scan Classes Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="table-th w-8"></th>
                  <th className="table-th">Name</th>
                  <th className="table-th text-center">Interval</th>
                  <th className="table-th text-center">Tags Assigned</th>
                  <th className="table-th">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {classes.map(sc => (
                  <tr key={sc.id} className={`hover:bg-gray-800/50 ${sc.is_default ? 'bg-yellow-900/10' : ''}`}>
                    <td className="table-td">
                      <button onClick={() => handleSetDefault(sc)} title={sc.is_default ? 'Remove as default' : 'Set as default'}>
                        <Star size={14} className={sc.is_default ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-yellow-400'} />
                      </button>
                    </td>
                    <td className="table-td font-semibold text-gray-200">
                      {sc.name}
                      {sc.is_default && <span className="ml-2 badge badge-yellow">Default</span>}
                    </td>
                    <td className="table-td text-center">
                      <span className="font-mono text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded text-sm">
                        {formatInterval(sc.interval_ms)}
                      </span>
                    </td>
                    <td className="table-td text-center font-semibold">{sc.tag_count}</td>
                    <td className="table-td text-gray-400 text-sm">{sc.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scan class modal */}
      <Modal open={modal === 'form'} onClose={() => setModal(null)}
        title={editTarget ? 'Edit Scan Class' : 'New Custom Scan Class'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Custom5s" />
          </div>
          <div>
            <label className="label">Interval (milliseconds) *</label>
            <input className="input" type="number" min="1" value={form.interval_ms}
              onChange={e => set('interval_ms', Number(e.target.value))} />
            <p className="text-xs text-gray-500 mt-1">
              = {formatInterval(Number(form.interval_ms) || 0)} — maps to Telegraf's <code className="text-blue-400">interval</code>
            </p>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Custom polling interval" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400 mt-3 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-700">
          <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </Modal>

      {/* Telegraf instance modal */}
      <Modal open={modal === 'instance'} onClose={() => setModal(null)}
        title={editTarget ? 'Edit Telegraf Instance' : 'New Telegraf Instance'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Instance Name *</label>
            <input className="input" value={instForm.name} onChange={e => setInst('name', e.target.value)}
              placeholder="e.g. telegraf-plc-line1" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={instForm.description} onChange={e => setInst('description', e.target.value)}
              placeholder="Tags from PLC line 1" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="inst-enabled" checked={instForm.enabled}
              onChange={e => setInst('enabled', e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-blue-500" />
            <label htmlFor="inst-enabled" className="text-sm text-gray-300">Instance enabled</label>
          </div>
        </div>
        {error && <p className="text-sm text-red-400 mt-3 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-700">
          <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveInstance} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </Modal>
    </div>
  )
}
