import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Tag, Clock, Database, Activity, ArrowRight, Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getMetrics } from '../services/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function StatCard({ icon: Icon, label, value, sub, color = 'blue', to }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  const inner = (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function DeviceRow({ device }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="table-td">
        <Link to={`/devices/${device.id}`} className="font-medium text-blue-600 hover:text-blue-800">
          {device.name}
        </Link>
      </td>
      <td className="table-td text-gray-500 font-mono text-xs">{device.endpoint_url}</td>
      <td className="table-td">
        <span className={`badge ${device.enabled ? 'badge-green' : 'badge-gray'}`}>
          {device.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </td>
      <td className="table-td text-center font-semibold">{device.enabled_tag_count}</td>
      <td className="table-td text-gray-500 text-xs">{device.influxdb_name || '—'}</td>
    </tr>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMetrics().then(setMetrics).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!metrics) return <p className="text-red-500">Failed to load metrics.</p>

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your OPC UA → Telegraf → InfluxDB pipeline</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="OPC UA Devices" value={metrics.total_devices}
          sub={`${metrics.enabled_devices} enabled`} color="blue" to="/devices" />
        <StatCard icon={Tag} label="Active Tags" value={metrics.enabled_tags}
          sub={`${metrics.total_tags} total configured`} color="green" to="/devices" />
        <StatCard icon={Clock} label="Scan Classes" value={metrics.scan_class_count}
          color="yellow" to="/scan-classes" />
        <StatCard icon={Database} label="InfluxDB Targets" value={metrics.influxdb_count}
          color="purple" to="/influxdb" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tags by scan class chart */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-blue-500" /> Tags by Scan Class
          </h2>
          {metrics.tags_by_scan_class.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              No scan classes configured.{' '}
              <Link to="/scan-classes" className="text-blue-500 hover:underline">Add one</Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.tags_by_scan_class} barSize={36}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(val, _name, props) => [val, `Tags (${props.payload.interval_ms}ms)`]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="tag_count" radius={[4, 4, 0, 0]}>
                  {metrics.tags_by_scan_class.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* InfluxDB targets */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database size={16} className="text-blue-500" /> InfluxDB Targets
          </h2>
          {metrics.influx_summary.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              No InfluxDB targets configured.{' '}
              <Link to="/influxdb" className="text-blue-500 hover:underline">Add one</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.influx_summary.map(cfg => (
                <div key={cfg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{cfg.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{cfg.url}</p>
                    <p className="text-xs text-gray-400">{cfg.org} / {cfg.bucket}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">{cfg.device_count}</span>
                    <p className="text-xs text-gray-400">devices</p>
                    {cfg.is_default && <span className="badge badge-blue mt-1">default</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Device table */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Devices</h2>
          <Link to="/devices" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            Manage <ArrowRight size={14} />
          </Link>
        </div>
        {metrics.device_summary.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">
            No devices configured.{' '}
            <Link to="/devices" className="text-blue-500 hover:underline">Add a device</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Endpoint</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-center">Active Tags</th>
                  <th className="table-th">InfluxDB Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.device_summary.map(d => <DeviceRow key={d.id} device={d} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
