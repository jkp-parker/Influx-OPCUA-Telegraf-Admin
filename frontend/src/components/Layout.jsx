import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Server, Tag, Clock, Database,
  FileCode, Settings, ChevronRight, Activity,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSystemConfig } from '../services/api'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/devices', icon: Server, label: 'OPC UA Devices' },
  { to: '/scan-classes', icon: Clock, label: 'Scan Classes' },
  { to: '/influxdb', icon: Database, label: 'InfluxDB Targets' },
  { to: '/telegraf', icon: FileCode, label: 'Telegraf Config' },
  { to: '/admin', icon: Settings, label: 'Administration' },
]

export default function Layout({ children }) {
  const [title, setTitle] = useState('OPC UA Telegraf Admin')
  const navigate = useNavigate()

  useEffect(() => {
    getSystemConfig()
      .then(cfg => {
        if (!cfg.setup_complete) navigate('/setup')
        else setTitle(cfg.app_title || 'OPC UA Telegraf Admin')
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-700">
          <Activity size={22} className="text-blue-400" />
          <span className="text-white font-semibold text-sm leading-tight">{title}</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
          OPC UA → Telegraf → InfluxDB
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
