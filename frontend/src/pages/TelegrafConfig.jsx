import { useEffect, useState } from 'react'
import { Download, RefreshCw, Loader2, FileCode, Copy, CheckCircle } from 'lucide-react'
import { getTelegrafConfig } from '../services/api'

export default function TelegrafConfig() {
  const [config, setConfig] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = () => {
    setLoading(true)
    getTelegrafConfig().then(setConfig).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([config], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'telegraf.conf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const lineCount = config.split('\n').length

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telegraf Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-generated config based on your devices and tag selections
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Regenerate
          </button>
          <button onClick={handleCopy} className="btn-secondary">
            {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleDownload} className="btn-primary">
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileCode size={14} />
            <span className="font-mono">telegraf.conf</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">{lineCount} lines</span>
          </div>
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <pre className="p-5 text-xs font-mono text-gray-800 bg-gray-950 text-green-400 overflow-auto max-h-[70vh] leading-relaxed whitespace-pre-wrap">
            {config || '# No devices or tags configured yet.'}
          </pre>
        )}
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Usage</h3>
        <p className="text-sm text-blue-700 mb-2">
          Download this file and place it at your configured Telegraf config path. Then reload Telegraf:
        </p>
        <code className="block bg-blue-100 rounded px-3 py-2 text-xs font-mono text-blue-900">
          systemctl reload telegraf
        </code>
        <p className="text-xs text-blue-600 mt-2">
          You can configure the config path and reload command in <strong>Administration</strong>.
        </p>
      </div>
    </div>
  )
}
