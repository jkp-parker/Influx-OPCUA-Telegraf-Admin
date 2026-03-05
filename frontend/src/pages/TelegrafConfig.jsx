import { useEffect, useState, useRef } from 'react'
import {
  Download, RefreshCw, Loader2, FileCode, Copy, CheckCircle,
  Upload, AlertTriangle, Database, Server, Tag, FileText,
  ArrowLeft, Check, Layers
} from 'lucide-react'
import {
  getAllInstanceConfigs, previewTelegrafImport, confirmTelegrafImport,
  listTelegrafInstances
} from '../services/api'
import Modal from '../components/Modal'

export default function TelegrafConfig() {
  const [configs, setConfigs] = useState([])
  const [instances, setInstances] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Import modal
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState(1)
  const [importContent, setImportContent] = useState('')
  const [importPreview, setImportPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [skipExisting, setSkipExisting] = useState(true)
  const fileInputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cfgs, insts] = await Promise.all([
        getAllInstanceConfigs(),
        listTelegrafInstances(),
      ])
      setConfigs(cfgs)
      setInstances(insts)
      if (cfgs.length > 0 && !activeTab) {
        setActiveTab(cfgs[0].instance_id)
      }
    } catch {
      setConfigs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeConfig = configs.find(c => c.instance_id === activeTab)
  const configText = activeConfig?.config || ''
  const lineCount = configText.split('\n').length

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!activeConfig) return
    const blob = new Blob([configText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telegraf-${activeConfig.instance_name}.conf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadAll = () => {
    for (const cfg of configs) {
      const blob = new Blob([cfg.config], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `telegraf-${cfg.instance_name}.conf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Import handlers
  const openImport = () => {
    setImportOpen(true)
    setImportStep(1)
    setImportContent('')
    setImportPreview(null)
    setImportResult(null)
  }

  const closeImport = () => {
    setImportOpen(false)
    if (importResult) load()
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportContent(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  const handlePreview = async () => {
    setImporting(true)
    try {
      const result = await previewTelegrafImport(importContent)
      setImportPreview(result)
      setImportStep(2)
    } catch (e) {
      console.error('Preview failed:', e)
    } finally {
      setImporting(false)
    }
  }

  const handleConfirm = async () => {
    setImporting(true)
    try {
      const result = await confirmTelegrafImport({
        influxdb_configs: importPreview.influxdb_configs,
        devices: importPreview.devices,
        passthrough_sections: importPreview.passthrough_sections,
        skip_existing: skipExisting,
      })
      setImportResult(result)
      setImportStep(3)
    } catch (e) {
      console.error('Import confirm failed:', e)
    } finally {
      setImporting(false)
    }
  }

  const totalImportTags = importPreview?.devices?.reduce((sum, d) => sum + d.tags.length, 0) || 0
  const totalTags = configs.reduce((sum, c) => sum + c.tag_count, 0)
  const totalDevices = configs.reduce((sum, c) => sum + c.device_count, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Telegraf Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            {configs.length > 0
              ? `${configs.length} instance${configs.length !== 1 ? 's' : ''} \u00b7 ${totalDevices} device${totalDevices !== 1 ? 's' : ''} \u00b7 ${totalTags} tag${totalTags !== 1 ? 's' : ''}`
              : 'Auto-generated configs for each Telegraf instance'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openImport} className="btn-secondary">
            <Upload size={14} /> Import
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Regenerate
          </button>
          {configs.length > 1 && (
            <button onClick={handleDownloadAll} className="btn-secondary">
              <Download size={14} /> Download All
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      {configs.length > 0 && (
        <div className="flex gap-1 border-b border-gray-700 overflow-x-auto">
          {configs.map(cfg => (
            <button
              key={cfg.instance_id}
              onClick={() => setActiveTab(cfg.instance_id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === cfg.instance_id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              <Layers size={14} />
              {cfg.instance_name}
              <span className="text-xs text-gray-500">
                {cfg.device_count}d / {cfg.tag_count}t
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Config viewer */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : configs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileCode size={40} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Configs Available</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            No enabled Telegraf instances with devices found. Add devices and assign them to instances to generate configs.
          </p>
        </div>
      ) : activeConfig && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <FileCode size={14} />
              <span className="font-mono">telegraf-{activeConfig.instance_name}.conf</span>
              <span className="text-gray-600">&middot;</span>
              <span className="text-gray-500">{lineCount} lines</span>
              <span className="text-gray-600">&middot;</span>
              <span className="text-gray-500">{activeConfig.device_count} devices</span>
              <span className="text-gray-600">&middot;</span>
              <span className="text-gray-500">{activeConfig.tag_count} tags</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="btn-secondary !py-1 !px-2 text-xs">
                {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} className="btn-primary !py-1 !px-2 text-xs">
                <Download size={12} /> Download
              </button>
            </div>
          </div>
          <pre className="p-5 text-xs font-mono text-green-400 bg-gray-950 overflow-auto max-h-[70vh] leading-relaxed whitespace-pre-wrap">
            {configText || '# No devices or tags configured for this instance.'}
          </pre>
        </div>
      )}

      {/* Import Modal */}
      <Modal open={importOpen} onClose={closeImport} title="Import Telegraf Config" size="lg">
        {importStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Paste or upload an existing <code className="text-blue-400">telegraf.conf</code> to automatically create
              InfluxDB targets, OPC-UA devices, and tags. Non-OPC-UA sections will be preserved as passthrough config.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Config Content</label>
              <textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder="Paste your telegraf.conf content here..."
                className="w-full h-64 p-3 text-xs font-mono bg-gray-800 text-gray-200 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".conf,.toml,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-sm"
                >
                  <Upload size={14} /> Upload File
                </button>
              </div>
              <button
                onClick={handlePreview}
                disabled={!importContent.trim() || importing}
                className="btn-primary"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Preview Import
              </button>
            </div>
          </div>
        )}

        {importStep === 2 && importPreview && (
          <div className="space-y-4">
            {importPreview.warnings.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 space-y-1">
                {importPreview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-3">
                <Database size={16} className="text-purple-400" />
                <span>InfluxDB Targets</span>
                <span className="badge badge-primary ml-auto">{importPreview.influxdb_configs.length}</span>
              </div>
              {importPreview.influxdb_configs.length === 0 ? (
                <p className="text-sm text-gray-500">No InfluxDB outputs found</p>
              ) : (
                <div className="space-y-2">
                  {importPreview.influxdb_configs.map((cfg, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-gray-200 font-medium">{cfg.name}</span>
                      <span className="text-gray-500">{cfg.url}</span>
                      <span className="text-gray-500">&rarr; {cfg.bucket}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-3">
                <Server size={16} className="text-blue-400" />
                <span>OPC-UA Devices</span>
                <span className="badge badge-primary ml-auto">{importPreview.devices.length}</span>
              </div>
              {importPreview.devices.length === 0 ? (
                <p className="text-sm text-gray-500">No OPC-UA inputs found</p>
              ) : (
                <div className="space-y-2">
                  {importPreview.devices.map((dev, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-gray-900/50 rounded px-3 py-2">
                      <span className="text-gray-200 font-medium">{dev.name}</span>
                      <span className="text-gray-500 truncate">{dev.endpoint_url}</span>
                      <span className="badge badge-secondary ml-auto">
                        <Tag size={10} /> {dev.tags.length} tags
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {importPreview.passthrough_sections.trim() && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
                  <FileText size={16} className="text-green-400" />
                  <span>Passthrough Sections</span>
                </div>
                <p className="text-sm text-gray-400">
                  Non-OPC-UA config sections will be preserved and appended to the generated config.
                </p>
                <pre className="mt-2 p-2 text-xs font-mono text-gray-400 bg-gray-900/50 rounded max-h-32 overflow-auto">
                  {importPreview.passthrough_sections.trim().substring(0, 500)}
                  {importPreview.passthrough_sections.trim().length > 500 && '...'}
                </pre>
              </div>
            )}

            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <p className="text-sm text-gray-300">
                This will create <strong>{importPreview.influxdb_configs.length}</strong> InfluxDB target(s),{' '}
                <strong>{importPreview.devices.length}</strong> device(s), and{' '}
                <strong>{totalImportTags}</strong> tag(s).
              </p>
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                Skip devices and InfluxDB targets that already exist (by name)
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setImportStep(1)} className="btn-secondary">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleConfirm} disabled={importing} className="btn-primary">
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm Import
              </button>
            </div>
          </div>
        )}

        {importStep === 3 && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center">
                <CheckCircle size={20} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Import Complete</h3>
                <p className="text-sm text-gray-400">Your config has been imported successfully.</p>
              </div>
            </div>

            <div className="space-y-2">
              {importResult.influxdb_created > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Database size={14} className="text-purple-400" />
                  Created {importResult.influxdb_created} InfluxDB target(s)
                  {importResult.influxdb_skipped > 0 && (
                    <span className="text-gray-500">({importResult.influxdb_skipped} skipped)</span>
                  )}
                </div>
              )}
              {importResult.influxdb_skipped > 0 && importResult.influxdb_created === 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Database size={14} className="text-gray-500" />
                  {importResult.influxdb_skipped} InfluxDB target(s) skipped
                </div>
              )}
              {importResult.devices_created > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Server size={14} className="text-blue-400" />
                  Created {importResult.devices_created} device(s) with {importResult.tags_created} tag(s)
                  {importResult.devices_skipped > 0 && (
                    <span className="text-gray-500">({importResult.devices_skipped} skipped)</span>
                  )}
                </div>
              )}
              {importResult.devices_skipped > 0 && importResult.devices_created === 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Server size={14} className="text-gray-500" />
                  {importResult.devices_skipped} device(s) skipped
                </div>
              )}
              {importResult.passthrough_saved && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <FileText size={14} className="text-green-400" />
                  Passthrough sections saved
                </div>
              )}
            </div>

            {importResult.warnings?.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 space-y-1">
                {importResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={closeImport} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
