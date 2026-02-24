import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import ScanClasses from './pages/ScanClasses'
import InfluxConfig from './pages/InfluxConfig'
import TelegrafConfig from './pages/TelegrafConfig'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/devices/:id" element={<DeviceDetail />} />
                <Route path="/scan-classes" element={<ScanClasses />} />
                <Route path="/influxdb" element={<InfluxConfig />} />
                <Route path="/telegraf" element={<TelegrafConfig />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
