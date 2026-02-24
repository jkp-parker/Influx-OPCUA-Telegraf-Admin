import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, ChevronDown, Tag, Search, Filter, Loader2,
  RefreshCw, Save, CheckSquare, Square, AlertCircle, CheckCircle,
  SortAsc, SortDesc, Sliders,
} from 'lucide-react'
import {
  getDevice, getDeviceTags, saveDeviceTags, listScanClasses,
  browseNode, startScan, getScanStatus, clearScan, patchTag, deleteTag,
} from '../services/api'

const VIEW = { TREE: 'tree', SCAN: 'scan', SAVED: 'saved' }

// ────────── Tree view ──────────
function TreeNode({ node, deviceId, onSelect, scanClasses, savedNodeIds }) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)

  const expand = async () => {
    if (open) { setOpen(false); return }
    if (!children) {
      setLoading(true)
      try {
        const res = await browseNode(deviceId, node.node_id)
        setChildren(res.nodes)
      } catch {
        setChildren([])
      } finally {
        setLoading(false)
      }
    }
    setOpen(true)
  }

  const isSaved = savedNodeIds.has(node.node_id)

  return (
    <div>
      <div className="flex items-center gap-1 py-0.5 px-2 rounded hover:bg-gray-100 group">
        {node.is_variable ? (
          <span className="w-4 flex-shrink-0" />
        ) : (
          <button onClick={expand} className="w-4 h-4 flex-shrink-0 text-gray-400 hover:text-gray-700">
            {loading ? <Loader2 size={12} className="animate-spin" /> :
              open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        <Tag size={12} className={`flex-shrink-0 ${node.is_variable ? 'text-blue-500' : 'text-gray-400'}`} />
        <span className={`text-sm flex-1 ${node.is_variable ? 'text-gray-800' : 'text-gray-600'}`}>
          {node.display_name}
        </span>
        {node.is_variable && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isSaved && <span className="badge badge-green text-xs">saved</span>}
            <button onClick={() => onSelect(node)} className="btn-primary py-0.5 px-2 text-xs">
              {isSaved ? 'Update' : 'Add'}
            </button>
          </div>
        )}
      </div>
      {open && children && (
        <div className="ml-5 border-l border-gray-200 pl-1">
          {children.map(child => (
            <TreeNode key={child.node_id} node={child} deviceId={deviceId}
              onSelect={onSelect} scanClasses={scanClasses} savedNodeIds={savedNodeIds} />
          ))}
          {children.length === 0 && <p className="text-xs text-gray-400 py-1 px-2">No children</p>}
        </div>
      )}
    </div>
  )
}

// ────────── Scan results ──────────
function ScanResults({ nodes, deviceId, scanClasses, savedNodeIds, onAddTags }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('path')
  const [sortDir, setSortDir] = useState('asc')
  const [filterNs, setFilterNs] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkScanClass, setBulkScanClass] = useState('')

  const namespaces = [...new Set(nodes.map(n => n.namespace))].sort()
  const dataTypes = [...new Set(nodes.map(n => n.data_type).filter(Boolean))].sort()

  const filtered = nodes
    .filter(n => {
      if (search && !n.display_name.toLowerCase().includes(search.toLowerCase()) &&
          !n.path.toLowerCase().includes(search.toLowerCase()) &&
          !n.identifier.toLowerCase().includes(search.toLowerCase())) return false
      if (filterNs !== '' && n.namespace !== Number(filterNs)) return false
      if (filterType && n.data_type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const toggleSelect = (nodeId) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(n => n.node_id)))
  }

  const handleAddSelected = () => {
    const toAdd = filtered.filter(n => selected.has(n.node_id))
    onAddTags(toAdd, bulkScanClass ? Number(bulkScanClass) : null)
    setSelected(new Set())
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <SortAsc size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <SortAsc size={12} className="text-blue-500" /> : <SortDesc size={12} className="text-blue-500" />
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 py-1.5 text-sm" value={search}
            onChange={e => setSearch(e.target.value)} placeholder="Search tags…" />
        </div>
        <select className="input py-1.5 text-sm w-36" value={filterNs} onChange={e => setFilterNs(e.target.value)}>
          <option value="">All Namespaces</option>
          {namespaces.map(ns => <option key={ns} value={ns}>NS {ns}</option>)}
        </select>
        <select className="input py-1.5 text-sm w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Data Types</option>
          {dataTypes.map(dt => <option key={dt} value={dt}>{dt}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} / {nodes.length}</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <select className="input py-1 text-sm w-44" value={bulkScanClass}
            onChange={e => setBulkScanClass(e.target.value)}>
            <option value="">No scan class</option>
            {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name} ({sc.interval_ms}ms)</option>)}
          </select>
          <button onClick={handleAddSelected} className="btn-primary py-1 text-xs">
            <Save size={12} /> Add to Saved Tags
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="table-th w-8">
                  <button onClick={toggleAll}>
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare size={14} className="text-blue-600" />
                      : <Square size={14} className="text-gray-400" />}
                  </button>
                </th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('display_name')}>
                  <span className="flex items-center gap-1">Name <SortIcon k="display_name" /></span>
                </th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('path')}>
                  <span className="flex items-center gap-1">Path <SortIcon k="path" /></span>
                </th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('namespace')}>
                  <span className="flex items-center gap-1">NS <SortIcon k="namespace" /></span>
                </th>
                <th className="table-th">Identifier</th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('data_type')}>
                  <span className="flex items-center gap-1">Type <SortIcon k="data_type" /></span>
                </th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(node => (
                <tr key={node.node_id}
                  className={`hover:bg-gray-50 cursor-pointer ${selected.has(node.node_id) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleSelect(node.node_id)}
                >
                  <td className="table-td">
                    {selected.has(node.node_id)
                      ? <CheckSquare size={14} className="text-blue-600" />
                      : <Square size={14} className="text-gray-400" />}
                  </td>
                  <td className="table-td font-medium">{node.display_name}</td>
                  <td className="table-td text-gray-500 text-xs font-mono max-w-xs truncate">{node.path}</td>
                  <td className="table-td text-center"><span className="badge badge-gray">{node.namespace}</span></td>
                  <td className="table-td font-mono text-xs text-gray-500 max-w-xs truncate">{node.identifier}</td>
                  <td className="table-td text-xs text-gray-500">{node.data_type || '—'}</td>
                  <td className="table-td">
                    {savedNodeIds.has(node.node_id)
                      ? <span className="badge badge-green">Saved</span>
                      : <span className="badge badge-gray">Not added</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-td text-center text-gray-400 py-8">No tags match the filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ────────── Saved tags ──────────
function SavedTags({ deviceId, tags, scanClasses, onRefresh }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('display_name')
  const [sortDir, setSortDir] = useState('asc')

  const filtered = tags
    .filter(t => !search || t.display_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.path || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const handlePatch = async (tagId, field, value) => {
    await patchTag(deviceId, tagId, { [field]: value })
    onRefresh()
  }

  const handleDelete = async (tagId) => {
    await deleteTag(deviceId, tagId)
    onRefresh()
  }

  const SortIcon = ({ k }) => sortKey === k
    ? (sortDir === 'asc' ? <SortAsc size={12} className="text-blue-500" /> : <SortDesc size={12} className="text-blue-500" />)
    : <SortAsc size={12} className="text-gray-300" />

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-8 py-1.5 text-sm" value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Search saved tags…" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('display_name')}>
                  <span className="flex items-center gap-1">Tag Name <SortIcon k="display_name" /></span>
                </th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('path')}>
                  <span className="flex items-center gap-1">Path <SortIcon k="path" /></span>
                </th>
                <th className="table-th">Measurement Name</th>
                <th className="table-th cursor-pointer" onClick={() => toggleSort('scan_class_name')}>
                  <span className="flex items-center gap-1">Scan Class <SortIcon k="scan_class_name" /></span>
                </th>
                <th className="table-th">Enabled</th>
                <th className="table-th text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(tag => (
                <tr key={tag.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{tag.display_name}</td>
                  <td className="table-td text-xs text-gray-500 font-mono max-w-xs truncate">{tag.path || `ns=${tag.namespace};${tag.identifier_type}=${tag.identifier}`}</td>
                  <td className="table-td">
                    <input className="input py-0.5 text-xs w-36"
                      defaultValue={tag.measurement_name}
                      onBlur={e => { if (e.target.value !== tag.measurement_name) handlePatch(tag.id, 'measurement_name', e.target.value) }}
                      placeholder={tag.display_name} />
                  </td>
                  <td className="table-td">
                    <select className="input py-0.5 text-xs w-36"
                      value={tag.scan_class_id || ''}
                      onChange={e => handlePatch(tag.id, 'scan_class_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">None</option>
                      {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                    </select>
                  </td>
                  <td className="table-td">
                    <input type="checkbox" checked={tag.enabled}
                      onChange={e => handlePatch(tag.id, 'enabled', e.target.checked)} className="rounded" />
                  </td>
                  <td className="table-td text-right">
                    <button onClick={() => handleDelete(tag.id)} className="text-red-400 hover:text-red-600 p-1">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="table-td text-center text-gray-400 py-8">No saved tags</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ────────── Main page ──────────
export default function DeviceDetail() {
  const { id } = useParams()
  const deviceId = Number(id)

  const [device, setDevice] = useState(null)
  const [scanClasses, setScanClasses] = useState([])
  const [savedTags, setSavedTags] = useState([])
  const [view, setView] = useState(VIEW.TREE)
  const [rootNodes, setRootNodes] = useState(null)
  const [scanStatus, setScanStatus] = useState(null)
  const [scanNodes, setScanNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const pollRef = useRef(null)

  const savedNodeIds = new Set(savedTags.map(t => t.node_id))

  const loadSaved = useCallback(() =>
    getDeviceTags(deviceId).then(setSavedTags), [deviceId])

  useEffect(() => {
    Promise.all([
      getDevice(deviceId),
      listScanClasses(),
      getDeviceTags(deviceId),
    ]).then(([dev, scs, tags]) => {
      setDevice(dev); setScanClasses(scs); setSavedTags(tags)
    }).finally(() => setLoading(false))

    // Resume scan if in progress
    getScanStatus(deviceId).then(s => {
      if (s.status === 'complete') { setScanStatus(s); setScanNodes(s.nodes) }
      else if (s.status === 'scanning') { setScanStatus(s); startPolling() }
    })
    return () => clearInterval(pollRef.current)
  }, [deviceId])

  const startPolling = () => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      getScanStatus(deviceId).then(s => {
        setScanStatus(s)
        if (s.status !== 'scanning') {
          clearInterval(pollRef.current)
          if (s.status === 'complete') setScanNodes(s.nodes)
        }
      })
    }, 1500)
  }

  const handleLoadTree = async () => {
    if (rootNodes) return
    setTreeLoading(true)
    try {
      const res = await browseNode(deviceId, null)
      setRootNodes(res.nodes)
    } catch {
      setRootNodes([])
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    if (view === VIEW.TREE && !rootNodes) handleLoadTree()
  }, [view])

  const handleStartScan = async () => {
    setScanNodes([])
    await startScan(deviceId)
    setScanStatus({ status: 'scanning' })
    setView(VIEW.SCAN)
    startPolling()
  }

  const handleAddTags = async (nodes, scanClassId) => {
    const existing = new Map(savedTags.map(t => [t.node_id, t]))
    const combined = [...savedTags]
    for (const node of nodes) {
      if (!existing.has(node.node_id)) {
        combined.push({
          device_id: deviceId,
          node_id: node.node_id,
          namespace: node.namespace,
          identifier: node.identifier,
          identifier_type: node.identifier_type || 's',
          display_name: node.display_name,
          path: node.path || '',
          data_type: node.data_type || '',
          measurement_name: '',
          scan_class_id: scanClassId || null,
          enabled: true,
        })
      }
    }
    await saveDeviceTags(deviceId, combined)
    await loadSaved()
    setView(VIEW.SAVED)
  }

  const handleSelectSingle = async (node) => {
    await handleAddTags([node], null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  if (!device) return <p className="text-red-500">Device not found</p>

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/devices" className="btn-ghost py-1 px-2">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">{device.endpoint_url}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{device.enabled_tag_count}</span> active tags
          </span>
          <button
            onClick={handleStartScan}
            disabled={scanStatus?.status === 'scanning'}
            className="btn-primary"
          >
            {scanStatus?.status === 'scanning'
              ? <><Loader2 size={14} className="animate-spin" /> Scanning…</>
              : <><RefreshCw size={14} /> Scan All Tags</>}
          </button>
        </div>
      </div>

      {/* Scan status banner */}
      {scanStatus?.status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} /> Scan failed: {scanStatus.error}
        </div>
      )}
      {scanStatus?.status === 'complete' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle size={14} /> Found {scanNodes.length} variable tags
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {[
            { id: VIEW.TREE, label: 'Browse Tree' },
            { id: VIEW.SCAN, label: `Scan Results${scanNodes.length ? ` (${scanNodes.length})` : ''}` },
            { id: VIEW.SAVED, label: `Saved Tags (${savedTags.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {view === VIEW.TREE && (
        <div className="card p-4">
          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500 text-sm">Connecting to device…</span>
            </div>
          ) : rootNodes?.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">No nodes found or could not connect</p>
          ) : (
            <div className="space-y-0.5">
              {rootNodes?.map(node => (
                <TreeNode key={node.node_id} node={node} deviceId={deviceId}
                  onSelect={handleSelectSingle} scanClasses={scanClasses} savedNodeIds={savedNodeIds} />
              ))}
            </div>
          )}
        </div>
      )}

      {view === VIEW.SCAN && (
        scanStatus?.status === 'scanning' ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-gray-500">Scanning all tags on device…</p>
            <p className="text-xs text-gray-400">This may take a moment for large node trees</p>
          </div>
        ) : scanNodes.length > 0 ? (
          <ScanResults
            nodes={scanNodes} deviceId={deviceId} scanClasses={scanClasses}
            savedNodeIds={savedNodeIds} onAddTags={handleAddTags}
          />
        ) : (
          <div className="text-center text-gray-400 py-16">
            <RefreshCw size={32} className="mx-auto mb-3 text-gray-300" />
            <p>No scan results yet.</p>
            <button onClick={handleStartScan} className="btn-primary mt-4 mx-auto">
              <RefreshCw size={14} /> Start Scan
            </button>
          </div>
        )
      )}

      {view === VIEW.SAVED && (
        <SavedTags
          deviceId={deviceId} tags={savedTags}
          scanClasses={scanClasses} onRefresh={loadSaved}
        />
      )}
    </div>
  )
}
