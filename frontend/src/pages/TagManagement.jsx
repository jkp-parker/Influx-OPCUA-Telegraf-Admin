import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Tag, Search, Loader2, CheckSquare, Square, SortAsc, SortDesc,
  ChevronDown, ChevronRight, Trash2, Power, PowerOff, Filter,
  Plus, GripVertical,
} from 'lucide-react'
import {
  listDevices, getDeviceTags, saveDeviceTags, listScanClasses,
  patchTag, deleteTag, getScanStatus,
} from '../services/api'

function matchGlob(pattern, text) {
  if (!pattern) return true
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i'
  )
  return regex.test(text)
}

// ── Resizable column hook ──
function useResizableColumns(defaultWidths) {
  const [widths, setWidths] = useState(defaultWidths)
  const dragging = useRef(null)

  const onMouseDown = useCallback((colIndex, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widths[colIndex]

    const onMouseMove = (e) => {
      const delta = e.clientX - startX
      setWidths(prev => {
        const next = [...prev]
        next[colIndex] = Math.max(40, startWidth + delta)
        return next
      })
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      dragging.current = null
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    dragging.current = colIndex
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [widths])

  return { widths, onMouseDown }
}

export default function TagManagement() {
  const [searchParams] = useSearchParams()
  const initialDeviceFilter = searchParams.get('device') || ''

  const [devices, setDevices] = useState([])
  const [mergedTags, setMergedTags] = useState([])
  const [scanClasses, setScanClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [savedTagsByDevice, setSavedTagsByDevice] = useState({})

  // View mode
  const [viewMode, setViewMode] = useState('all')

  // Filters
  const [search, setSearch] = useState('')
  const [wildcardPattern, setWildcardPattern] = useState('')
  const [filterDevice, setFilterDevice] = useState(initialDeviceFilter)
  const [filterScanClass, setFilterScanClass] = useState('')
  const [filterDataType, setFilterDataType] = useState('')
  const [filterEnabled, setFilterEnabled] = useState('')
  const [filterNs, setFilterNs] = useState('')

  // Sort
  const [sortKey, setSortKey] = useState('display_name')
  const [sortDir, setSortDir] = useState('asc')

  // Selection
  const [selected, setSelected] = useState(new Set())

  // Bulk actions
  const [bulkScanClass, setBulkScanClass] = useState('')

  // Grouping
  const [groupBy, setGroupBy] = useState('none')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Column resize — default widths in px
  const { widths: colWidths, onMouseDown: onColResize } = useResizableColumns([
    36,   // checkbox
    90,   // status
    120,  // device
    160,  // tag name
    240,  // path
    50,   // ns
    100,  // type
    130,  // measurement
    120,  // scan class
    70,   // enabled
    40,   // actions
  ])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [devs, scs] = await Promise.all([listDevices(), listScanClasses()])
      setDevices(devs)
      setScanClasses(scs)

      const perDevice = await Promise.all(devs.map(async (d) => {
        const [tags, scanResult] = await Promise.all([
          getDeviceTags(d.id),
          getScanStatus(d.id).catch(() => ({ status: 'none', nodes: [] })),
        ])
        return { device: d, tags, scanNodes: scanResult.status === 'complete' ? (scanResult.nodes || []) : [] }
      }))

      const savedByDevice = {}
      const allMerged = []

      for (const { device, tags, scanNodes } of perDevice) {
        const savedByNodeId = new Map(tags.map(t => [t.node_id, t]))
        savedByDevice[device.id] = tags

        // Deduplicate scan nodes by node_id — skip if already seen for this device
        const seenNodeIds = new Set()
        for (const node of scanNodes) {
          if (seenNodeIds.has(node.node_id)) continue
          seenNodeIds.add(node.node_id)

          const saved = savedByNodeId.get(node.node_id)
          allMerged.push({
            node_id: node.node_id,
            device_id: device.id,
            device_name: device.name,
            display_name: node.display_name,
            path: node.path || '',
            namespace: node.namespace,
            identifier: node.identifier,
            identifier_type: node.identifier_type || 's',
            data_type: node.data_type || '',
            is_collected: !!saved,
            saved_tag_id: saved?.id || null,
            measurement_name: saved?.measurement_name || '',
            scan_class_id: saved?.scan_class_id || null,
            scan_class_name: saved?.scan_class_name || '',
            enabled: saved?.enabled ?? false,
          })
        }

        // Add saved tags that weren't in scan results
        for (const tag of tags) {
          if (!seenNodeIds.has(tag.node_id)) {
            allMerged.push({
              node_id: tag.node_id,
              device_id: device.id,
              device_name: device.name,
              display_name: tag.display_name,
              path: tag.path || '',
              namespace: tag.namespace,
              identifier: tag.identifier,
              identifier_type: tag.identifier_type || 's',
              data_type: tag.data_type || '',
              is_collected: true,
              saved_tag_id: tag.id,
              measurement_name: tag.measurement_name || '',
              scan_class_id: tag.scan_class_id || null,
              scan_class_name: tag.scan_class_name || '',
              enabled: tag.enabled,
            })
          }
        }
      }

      setSavedTagsByDevice(savedByDevice)
      setMergedTags(allMerged)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const defaultScanClass = useMemo(() => scanClasses.find(sc => sc.is_default), [scanClasses])

  const namespaces = useMemo(() => [...new Set(mergedTags.map(t => t.namespace))].sort(), [mergedTags])
  const dataTypes = useMemo(() => [...new Set(mergedTags.map(t => t.data_type).filter(Boolean))].sort(), [mergedTags])

  const filtered = useMemo(() => {
    return mergedTags
      .filter(t => {
        if (viewMode === 'collected' && !t.is_collected) return false
        if (viewMode === 'available' && t.is_collected) return false

        if (search) {
          const s = search.toLowerCase()
          if (!t.display_name.toLowerCase().includes(s) &&
              !t.path.toLowerCase().includes(s) &&
              !t.node_id.toLowerCase().includes(s) &&
              !t.measurement_name.toLowerCase().includes(s)) return false
        }
        if (wildcardPattern && !matchGlob(wildcardPattern, t.path || t.display_name)) return false
        if (filterDevice && t.device_id !== Number(filterDevice)) return false
        if (filterScanClass) {
          if (filterScanClass === '__none__' && t.scan_class_id) return false
          if (filterScanClass !== '__none__' && t.scan_class_id !== Number(filterScanClass)) return false
        }
        if (filterDataType && t.data_type !== filterDataType) return false
        if (filterEnabled === 'true' && !t.enabled) return false
        if (filterEnabled === 'false' && t.enabled) return false
        if (filterNs !== '' && t.namespace !== Number(filterNs)) return false
        return true
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [mergedTags, viewMode, search, wildcardPattern, filterDevice, filterScanClass, filterDataType, filterEnabled, filterNs, sortKey, sortDir])

  const groups = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map()
    for (const tag of filtered) {
      let key
      if (groupBy === 'device') key = tag.device_name || `Device ${tag.device_id}`
      else if (groupBy === 'scan_class') key = tag.scan_class_name || 'No Scan Class'
      else if (groupBy === 'namespace') key = `Namespace ${tag.namespace}`
      else if (groupBy === 'data_type') key = tag.data_type || 'Unknown'
      else if (groupBy === 'status') key = tag.is_collected ? 'Collected' : 'Available'
      else key = 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(tag)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupBy])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Use unique key per tag — include index as tiebreaker for any remaining edge cases
  const tKey = (t) => `${t.device_id}:${t.node_id}`

  const toggleSelect = (key) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => tKey(t))))
  }

  const selectByPattern = () => {
    if (!wildcardPattern) return
    const matching = new Set()
    for (const t of filtered) {
      if (matchGlob(wildcardPattern, t.path || t.display_name)) {
        matching.add(tKey(t))
      }
    }
    setSelected(prev => {
      const next = new Set(prev)
      for (const k of matching) next.add(k)
      return next
    })
  }

  // ── Actions for collected tags (patch/delete) ──

  const handlePatch = async (tag, field, value) => {
    if (!tag.saved_tag_id) return
    await patchTag(tag.device_id, tag.saved_tag_id, { [field]: value })
    await loadAll()
  }

  const handleRemoveFromCollection = async (tag) => {
    if (!tag.saved_tag_id) return
    await deleteTag(tag.device_id, tag.saved_tag_id)
    await loadAll()
  }

  // ── Actions for adding tags to collection ──

  const handleAddToCollection = async (tags, scanClassId) => {
    const byDevice = new Map()
    for (const tag of tags) {
      if (tag.is_collected) continue
      if (!byDevice.has(tag.device_id)) byDevice.set(tag.device_id, [])
      byDevice.get(tag.device_id).push(tag)
    }

    for (const [deviceId, newTags] of byDevice) {
      const existing = savedTagsByDevice[deviceId] || []
      const existingNodeIds = new Set(existing.map(t => t.node_id))
      const combined = [...existing]
      const addedNodeIds = new Set() // Prevent duplicates within the batch
      for (const tag of newTags) {
        if (existingNodeIds.has(tag.node_id) || addedNodeIds.has(tag.node_id)) continue
        addedNodeIds.add(tag.node_id)
        combined.push({
          device_id: deviceId,
          node_id: tag.node_id,
          namespace: tag.namespace,
          identifier: tag.identifier,
          identifier_type: tag.identifier_type,
          display_name: tag.display_name,
          path: tag.path,
          data_type: tag.data_type,
          measurement_name: '',
          scan_class_id: scanClassId || null,
          enabled: true,
        })
      }
      await saveDeviceTags(deviceId, combined)
    }
    await loadAll()
  }

  // ── Bulk actions ──

  const getSelectedTags = () => mergedTags.filter(t => selected.has(tKey(t)))

  const handleBulkAddToCollection = async () => {
    const tags = getSelectedTags().filter(t => !t.is_collected)
    if (tags.length === 0) return
    const scId = bulkScanClass && bulkScanClass !== '__none__'
      ? Number(bulkScanClass)
      : (defaultScanClass?.id || null)
    await handleAddToCollection(tags, scId)
    setSelected(new Set())
  }

  const handleBulkScanClass = async () => {
    const scId = bulkScanClass === '__none__' ? null : bulkScanClass ? Number(bulkScanClass) : null
    const tags = getSelectedTags().filter(t => t.is_collected && t.saved_tag_id)
    await Promise.all(tags.map(t => patchTag(t.device_id, t.saved_tag_id, { scan_class_id: scId })))
    setSelected(new Set())
    setBulkScanClass('')
    await loadAll()
  }

  const handleBulkEnable = async (enabled) => {
    const tags = getSelectedTags().filter(t => t.is_collected && t.saved_tag_id)
    await Promise.all(tags.map(t => patchTag(t.device_id, t.saved_tag_id, { enabled })))
    setSelected(new Set())
    await loadAll()
  }

  const handleBulkRemove = async () => {
    const tags = getSelectedTags().filter(t => t.is_collected && t.saved_tag_id)
    if (tags.length === 0) return
    if (!confirm(`Remove ${tags.length} tags from collection?`)) return
    await Promise.all(tags.map(t => deleteTag(t.device_id, t.saved_tag_id)))
    setSelected(new Set())
    await loadAll()
  }

  const toggleGroup = (key) => {
    setCollapsedGroups(s => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <SortAsc size={12} className="text-gray-600" />
    return sortDir === 'asc' ? <SortAsc size={12} className="text-blue-400" /> : <SortDesc size={12} className="text-blue-400" />
  }

  // Stats
  const totalAvailable = mergedTags.length
  const collectedCount = mergedTags.filter(t => t.is_collected).length
  const enabledCount = mergedTags.filter(t => t.is_collected && t.enabled).length
  const devicesWithTags = new Set(mergedTags.map(t => t.device_id)).size
  const selectedCollected = getSelectedTags().filter(t => t.is_collected).length
  const selectedUncollected = getSelectedTags().filter(t => !t.is_collected).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )

  // Resizable column header helper
  const ResizeTh = ({ index, children, className = '' }) => (
    <th className={`table-th relative ${className}`} style={{ width: colWidths[index], minWidth: 40 }}>
      {children}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/40 z-20"
        onMouseDown={(e) => onColResize(index, e)}
      />
    </th>
  )

  const renderTagRow = (tag, idx) => {
    const key = tKey(tag)
    return (
      <tr key={`${key}:${idx}`} className={`hover:bg-gray-800/50 ${selected.has(key) ? 'bg-blue-900/20' : ''}`}>
        <td className="table-td" style={{ width: colWidths[0] }}>
          <button onClick={() => toggleSelect(key)}>
            {selected.has(key)
              ? <CheckSquare size={14} className="text-blue-400" />
              : <Square size={14} className="text-gray-500" />}
          </button>
        </td>
        <td className="table-td text-center" style={{ width: colWidths[1] }}>
          {tag.is_collected ? (
            <span className="badge badge-green">Collected</span>
          ) : (
            <span className="badge badge-gray">Available</span>
          )}
        </td>
        {groupBy !== 'device' && (
          <td className="table-td text-xs text-gray-400 truncate" style={{ width: colWidths[2] }}>{tag.device_name}</td>
        )}
        <td className="table-td font-medium text-gray-200 truncate" style={{ width: colWidths[3] }} title={tag.display_name}>{tag.display_name}</td>
        <td className="table-td text-xs text-gray-400 font-mono truncate" style={{ width: colWidths[4] }} title={tag.path}>{tag.path || `ns=${tag.namespace};${tag.identifier_type}=${tag.identifier}`}</td>
        {groupBy !== 'namespace' && (
          <td className="table-td text-center" style={{ width: colWidths[5] }}><span className="badge badge-gray">{tag.namespace}</span></td>
        )}
        {groupBy !== 'data_type' && (
          <td className="table-td text-xs text-gray-400 truncate" style={{ width: colWidths[6] }} title={tag.data_type}>{tag.data_type || '—'}</td>
        )}
        {tag.is_collected ? (
          <>
            <td className="table-td" style={{ width: colWidths[7] }}>
              <input className="input py-0.5 text-xs w-full"
                defaultValue={tag.measurement_name}
                onBlur={e => { if (e.target.value !== tag.measurement_name) handlePatch(tag, 'measurement_name', e.target.value) }}
                placeholder={tag.display_name} />
            </td>
            <td className="table-td" style={{ width: colWidths[8] }}>
              <select className="input py-0.5 text-xs w-full"
                value={tag.scan_class_id || ''}
                onChange={e => handlePatch(tag, 'scan_class_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">None</option>
                {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </td>
            <td className="table-td text-center" style={{ width: colWidths[9] }}>
              <input type="checkbox" checked={tag.enabled}
                onChange={e => handlePatch(tag, 'enabled', e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500" />
            </td>
            <td className="table-td text-right" style={{ width: colWidths[10] }}>
              <button onClick={() => handleRemoveFromCollection(tag)} className="text-red-400 hover:text-red-300 p-1" title="Remove from collection">
                <Trash2 size={12} />
              </button>
            </td>
          </>
        ) : (
          <>
            <td className="table-td text-gray-600 text-xs" style={{ width: colWidths[7] }}>—</td>
            <td className="table-td text-gray-600 text-xs" style={{ width: colWidths[8] }}>—</td>
            <td className="table-td text-center text-gray-600" style={{ width: colWidths[9] }}>—</td>
            <td className="table-td text-right" style={{ width: colWidths[10] }}>
              <button onClick={() => handleAddToCollection([tag], defaultScanClass?.id || null)} className="text-green-400 hover:text-green-300 p-1" title="Add to collection">
                <Plus size={12} />
              </button>
            </td>
          </>
        )}
      </tr>
    )
  }

  const tableHeaders = (
    <tr>
      <ResizeTh index={0}>
        <button onClick={toggleAll}>
          {selected.size === filtered.length && filtered.length > 0
            ? <CheckSquare size={14} className="text-blue-400" />
            : <Square size={14} className="text-gray-500" />}
        </button>
      </ResizeTh>
      <ResizeTh index={1} className="cursor-pointer text-center">
        <span className="flex items-center justify-center gap-1" onClick={() => toggleSort('is_collected')}>Status <SortIcon k="is_collected" /></span>
      </ResizeTh>
      {groupBy !== 'device' && (
        <ResizeTh index={2} className="cursor-pointer">
          <span className="flex items-center gap-1" onClick={() => toggleSort('device_name')}>Device <SortIcon k="device_name" /></span>
        </ResizeTh>
      )}
      <ResizeTh index={3} className="cursor-pointer">
        <span className="flex items-center gap-1" onClick={() => toggleSort('display_name')}>Tag Name <SortIcon k="display_name" /></span>
      </ResizeTh>
      <ResizeTh index={4} className="cursor-pointer">
        <span className="flex items-center gap-1" onClick={() => toggleSort('path')}>Path <SortIcon k="path" /></span>
      </ResizeTh>
      {groupBy !== 'namespace' && (
        <ResizeTh index={5} className="cursor-pointer text-center">
          <span className="flex items-center justify-center gap-1" onClick={() => toggleSort('namespace')}>NS <SortIcon k="namespace" /></span>
        </ResizeTh>
      )}
      {groupBy !== 'data_type' && (
        <ResizeTh index={6} className="cursor-pointer">
          <span className="flex items-center gap-1" onClick={() => toggleSort('data_type')}>Type <SortIcon k="data_type" /></span>
        </ResizeTh>
      )}
      <ResizeTh index={7}>Measurement</ResizeTh>
      <ResizeTh index={8} className="cursor-pointer">
        <span className="flex items-center gap-1" onClick={() => toggleSort('scan_class_name')}>Scan Class <SortIcon k="scan_class_name" /></span>
      </ResizeTh>
      <ResizeTh index={9} className="text-center cursor-pointer">
        <span className="flex items-center justify-center gap-1" onClick={() => toggleSort('enabled')}>Enabled <SortIcon k="enabled" /></span>
      </ResizeTh>
      <th className="table-th" style={{ width: colWidths[10], minWidth: 40 }}></th>
    </tr>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Tag Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            {totalAvailable} discovered across {devicesWithTags} device{devicesWithTags !== 1 ? 's' : ''} · {collectedCount} collected · {enabledCount} enabled
          </p>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-0 -mb-px">
          {[
            { id: 'all', label: `All Tags (${totalAvailable})` },
            { id: 'collected', label: `Collected (${collectedCount})` },
            { id: 'available', label: `Available (${totalAvailable - collectedCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setViewMode(tab.id); setSelected(new Set()) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                viewMode === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filter toolbar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-8 py-1.5 text-sm" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="Search tags..." />
          </div>
          <div className="relative flex-1 min-w-48">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-8 py-1.5 text-sm font-mono" value={wildcardPattern}
              onChange={e => setWildcardPattern(e.target.value)} placeholder="Wildcard: Channel1.*.Temperature" />
          </div>
          {wildcardPattern && (
            <button onClick={selectByPattern} className="btn-secondary py-1.5 text-xs">
              Select Matching
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <select className="input py-1.5 text-sm w-40" value={filterDevice} onChange={e => setFilterDevice(e.target.value)}>
            <option value="">All Devices</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input py-1.5 text-sm w-36" value={filterScanClass} onChange={e => setFilterScanClass(e.target.value)}>
            <option value="">All Scan Classes</option>
            <option value="__none__">No Scan Class</option>
            {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
          <select className="input py-1.5 text-sm w-36" value={filterDataType} onChange={e => setFilterDataType(e.target.value)}>
            <option value="">All Data Types</option>
            {dataTypes.map(dt => <option key={dt} value={dt}>{dt}</option>)}
          </select>
          <select className="input py-1.5 text-sm w-28" value={filterNs} onChange={e => setFilterNs(e.target.value)}>
            <option value="">All NS</option>
            {namespaces.map(ns => <option key={ns} value={ns}>NS {ns}</option>)}
          </select>
          {viewMode !== 'available' && (
            <select className="input py-1.5 text-sm w-28" value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)}>
              <option value="">All States</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          )}
          <div className="border-l border-gray-700 h-6 mx-1" />
          <select className="input py-1.5 text-sm w-36" value={groupBy} onChange={e => { setGroupBy(e.target.value); setCollapsedGroups(new Set()) }}>
            <option value="none">No Grouping</option>
            <option value="device">Group by Device</option>
            <option value="scan_class">Group by Scan Class</option>
            <option value="namespace">Group by Namespace</option>
            <option value="data_type">Group by Data Type</option>
            <option value="status">Group by Status</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{filtered.length} / {totalAvailable}</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-900/30 rounded-lg border border-blue-800">
          <span className="text-sm font-medium text-blue-400">{selected.size} selected</span>

          {selectedUncollected > 0 && (
            <>
              <div className="border-l border-blue-700 h-5" />
              <select className="input py-1 text-sm w-44" value={bulkScanClass} onChange={e => setBulkScanClass(e.target.value)}>
                <option value="">{defaultScanClass ? `Default: ${defaultScanClass.name}` : 'Scan Class...'}</option>
                {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}{sc.is_default ? ' (default)' : ''}</option>)}
              </select>
              <button onClick={handleBulkAddToCollection} className="btn-success py-1 text-xs">
                <Plus size={12} /> Collect {selectedUncollected} Tag{selectedUncollected !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {selectedCollected > 0 && (
            <>
              <div className="border-l border-blue-700 h-5" />
              {selectedUncollected === 0 && (
                <>
                  <select className="input py-1 text-sm w-36" value={bulkScanClass} onChange={e => setBulkScanClass(e.target.value)}>
                    <option value="">Set Scan Class...</option>
                    <option value="__none__">None</option>
                    {scanClasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </select>
                  <button onClick={handleBulkScanClass} disabled={!bulkScanClass} className="btn-primary py-1 text-xs">Apply</button>
                  <div className="border-l border-blue-700 h-5" />
                </>
              )}
              <button onClick={() => handleBulkEnable(true)} className="btn-secondary py-1 text-xs">
                <Power size={12} /> Enable
              </button>
              <button onClick={() => handleBulkEnable(false)} className="btn-secondary py-1 text-xs">
                <PowerOff size={12} /> Disable
              </button>
              <div className="border-l border-blue-700 h-5" />
              <button onClick={handleBulkRemove} className="btn-danger py-1 text-xs">
                <Trash2 size={12} /> Remove {selectedCollected}
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {mergedTags.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <Tag className="mx-auto mb-3 text-gray-600" size={40} />
          <p className="font-medium text-gray-300">No tags discovered</p>
          <p className="text-sm mt-1">Scan devices from the OPC UA Devices page to discover available tags</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
            <table className="w-full text-sm table-fixed" key={`${viewMode}-${groupBy}`}>
              <thead className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-10">
                {tableHeaders}
              </thead>
              {groups ? (
                groups.map(([groupName, groupTags]) => {
                  const isCollapsed = collapsedGroups.has(groupName)
                  const groupCollected = groupTags.filter(t => t.is_collected).length
                  return (
                    <tbody key={groupName} className="divide-y divide-gray-800">
                      <tr className="bg-gray-800/70 cursor-pointer hover:bg-gray-800" onClick={() => toggleGroup(groupName)}>
                        <td colSpan={99} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                            <span className="font-medium text-gray-200">{groupName}</span>
                            <span className="badge badge-gray">{groupTags.length} tags</span>
                            <span className="badge badge-green">{groupCollected} collected</span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && groupTags.map((tag, idx) => renderTagRow(tag, idx))}
                    </tbody>
                  )
                })
              ) : (
                <tbody className="divide-y divide-gray-800">
                  {filtered.map((tag, idx) => renderTagRow(tag, idx))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={99} className="table-td text-center text-gray-500 py-8">No tags match the filters</td></tr>
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
