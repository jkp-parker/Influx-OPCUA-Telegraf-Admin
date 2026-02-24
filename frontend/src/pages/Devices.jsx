import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Wifi, WifiOff, ChevronRight,
  Loader2, AlertCircle, CheckCircle, Tag,
} from 'lucide-react'
import Modal from '../components/Modal'
import {
  listDevices, createDevice, updateDevice, deleteDevice,
  testDeviceConnection, listInfluxConfigs,
} from '../services/api'

const SECURITY_POLICIES = [
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128_Sha256_RsaOaep',
  'Aes256_Sha256_RsaPss',
]

const EMPTY_FORM = {
  name: '', endpoint_url: '', username: '', password: '',
  security_policy: 'None', influxdb_config_id: '', enabled: true,
}

function DeviceForm({ form, setForm, influxConfigs }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Device Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="PLC Line 1" />
        </div>
        <div className="col-span-2">
          <label className="label">OPC UA Endpoint URL *</label>
          <input className="input font-mono text-sm" value={form.endpoint_url}
            onChange={e => set('endpoint_url', e.target.value)} placeholder="opc.tcp://192.168.1.100:4840" />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="(anonymous)" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
        <div>
          <label className="label">Security Policy</label>
          <select className="input" value={form.security_policy} onChange={e => set('security_policy', e.target.value)}>
            {SECURITY_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">InfluxDB Target</label>
          <select className="input" value={form.influxdb_config_id} onChange={e => set('influxdb_config_id', e.target.value ? Number(e.target.value) : '')}>
            <option value="">Use system default</option>
            {influxConfigs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="rounded" />
          <label htmlFor="enabled" className="text-sm text-gray-700">Device enabled</label>
        </div>
      </div>
    </div>
  )
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [influxConfigs, setInfluxConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResults, setTestResults] = useState({})
  const [testingId, setTestingId] = useState(null)

  const load = () => {
    Promise.all([listDevices(), listInfluxConfigs()])
      .then(([devs, influx]) => { setDevices(devs); setInfluxConfigs(influx) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setModal('add') }
  const openEdit = (d) => {
    setForm({
      name: d.name, endpoint_url: d.endpoint_url, username: d.username || '',
      password: d.password || '', security_policy: d.security_policy || 'None',
      influxdb_config_id: d.influxdb_config_id || '', enabled: d.enabled,
    })
    setEditTarget(d)
    setError('')
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name || !form.endpoint_url) { setError('Name and endpoint URL are required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, influxdb_config_id: form.influxdb_config_id || null }
      if (modal === 'add') await createDevice(payload)
      else await updateDevice(editTarget.id, payload)
      setModal(null)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this device and all its tags?')) return
    await deleteDevice(id)
    load()
  }

  const handleTest = async (d) => {
    setTestingId(d.id)
    try {
      const result = await testDeviceConnection(d.id)
      setTestResults(r => ({ ...r, [d.id]: result }))
    } catch {
      setTestResults(r => ({ ...r, [d.id]: { success: false, message: 'Request failed' } }))
    } finally {
      setTestingId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OPC UA Devices</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your OPC UA data sources</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add Device
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Server className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="font-medium">No devices configured</p>
          <p className="text-sm mt-1">Add an OPC UA device to get started</p>
          <button onClick={openAdd} className="btn-primary mt-4 mx-auto">
            <Plus size={16} /> Add Device
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Endpoint</th>
                <th className="table-th">Security</th>
                <th className="table-th text-center">Tags</th>
                <th className="table-th">InfluxDB</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map(d => {
                const tr = testResults[d.id]
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="table-td">
                      <Link to={`/devices/${d.id}`} className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        {d.name} <ChevronRight size={14} />
                      </Link>
                    </td>
                    <td className="table-td font-mono text-xs text-gray-500">{d.endpoint_url}</td>
                    <td className="table-td text-xs text-gray-500">{d.security_policy}</td>
                    <td className="table-td text-center">
                      <span className="flex items-center justify-center gap-1 text-sm">
                        <Tag size={12} className="text-gray-400" />
                        <span className="font-semibold">{d.enabled_tag_count}</span>
                        <span className="text-gray-400">/ {d.tag_count}</span>
                      </span>
                    </td>
                    <td className="table-td text-xs text-gray-500">{d.influxdb_name || <span className="text-gray-300">system default</span>}</td>
                    <td className="table-td">
                      {tr ? (
                        <span className={`badge ${tr.success ? 'badge-green' : 'badge-red'} flex items-center gap-1`}>
                          {tr.success ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {tr.success ? 'OK' : 'Failed'}
                        </span>
                      ) : (
                        <span className={`badge ${d.enabled ? 'badge-blue' : 'badge-gray'}`}>
                          {d.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleTest(d)}
                          disabled={testingId === d.id}
                          className="btn-ghost py-1 px-2 text-xs"
                          title="Test connection"
                        >
                          {testingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                        </button>
                        <button onClick={() => openEdit(d)} className="btn-ghost py-1 px-2" title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(d.id)} className="btn-ghost py-1 px-2 text-red-500 hover:bg-red-50" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add OPC UA Device' : 'Edit Device'}
      >
        <DeviceForm form={form} setForm={setForm} influxConfigs={influxConfigs} />
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

function Server({ size, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
      <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
    </svg>
  )
}
