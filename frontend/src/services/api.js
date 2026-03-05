import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// System / Admin
export const getSystemConfig = () => api.get('/system/config').then(r => r.data)
export const updateSystemConfig = (data) => api.put('/system/config', data).then(r => r.data)
export const testSystemInfluxdb = () => api.post('/system/config/test-influxdb').then(r => r.data)

// Metrics
export const getMetrics = () => api.get('/metrics').then(r => r.data)

// Devices
export const listDevices = () => api.get('/devices').then(r => r.data)
export const createDevice = (data) => api.post('/devices', data).then(r => r.data)
export const getDevice = (id) => api.get(`/devices/${id}`).then(r => r.data)
export const updateDevice = (id, data) => api.put(`/devices/${id}`, data).then(r => r.data)
export const deleteDevice = (id) => api.delete(`/devices/${id}`).then(r => r.data)
export const testDeviceConnection = (id) => api.post(`/devices/${id}/test-connection`).then(r => r.data)
export const testDeviceConnectionRaw = (data) => api.post('/devices/test-connection', data).then(r => r.data)
export const browseNode = (id, nodeId) =>
  api.post(`/devices/${id}/browse`, null, { params: nodeId ? { node_id: nodeId } : {} }).then(r => r.data)
export const startScan = (id) => api.post(`/devices/${id}/scan`).then(r => r.data)
export const getScanStatus = (id) => api.get(`/devices/${id}/scan`).then(r => r.data)
export const clearScan = (id) => api.delete(`/devices/${id}/scan`).then(r => r.data)
export const readTagValues = (id, nodeIds) => api.post(`/devices/${id}/read-values`, nodeIds).then(r => r.data)
export const getDeviceTags = (id) => api.get(`/devices/${id}/tags`).then(r => r.data)
export const saveDeviceTags = (id, tags) => api.put(`/devices/${id}/tags`, { tags }).then(r => r.data)
export const patchTag = (deviceId, tagId, data) =>
  api.patch(`/devices/${deviceId}/tags/${tagId}`, data).then(r => r.data)
export const deleteTag = (deviceId, tagId) =>
  api.delete(`/devices/${deviceId}/tags/${tagId}`).then(r => r.data)

// Node Includes (branch subscriptions)
export const getDeviceNodeIncludes = (id) => api.get(`/devices/${id}/node-includes`).then(r => r.data)
export const createNodeInclude = (deviceId, data) => api.post(`/devices/${deviceId}/node-includes`, data).then(r => r.data)
export const patchNodeInclude = (deviceId, id, data) => api.patch(`/devices/${deviceId}/node-includes/${id}`, data).then(r => r.data)
export const deleteNodeInclude = (deviceId, id) => api.delete(`/devices/${deviceId}/node-includes/${id}`).then(r => r.data)

// Scan Classes
export const listScanClasses = () => api.get('/scan-classes').then(r => r.data)
export const createScanClass = (data) => api.post('/scan-classes', data).then(r => r.data)
export const updateScanClass = (id, data) => api.put(`/scan-classes/${id}`, data).then(r => r.data)
export const deleteScanClass = (id) => api.delete(`/scan-classes/${id}`).then(r => r.data)
export const setDefaultScanClass = (id) => api.post(`/scan-classes/${id}/set-default`).then(r => r.data)
export const clearDefaultScanClass = (id) => api.post(`/scan-classes/${id}/clear-default`).then(r => r.data)

// InfluxDB Configs
export const listInfluxConfigs = () => api.get('/influxdb').then(r => r.data)
export const createInfluxConfig = (data) => api.post('/influxdb', data).then(r => r.data)
export const updateInfluxConfig = (id, data) => api.put(`/influxdb/${id}`, data).then(r => r.data)
export const deleteInfluxConfig = (id) => api.delete(`/influxdb/${id}`).then(r => r.data)
export const testInfluxConfig = (id) => api.post(`/influxdb/${id}/test`).then(r => r.data)
export const testInfluxConnectionRaw = (data) => api.post('/influxdb/test-connection', data).then(r => r.data)
export const listBuckets = (id) => api.get(`/influxdb/${id}/buckets`).then(r => r.data)

// Telegraf
export const getTelegrafConfig = () => api.get('/telegraf/config')
export const previewTelegrafImport = (content) => api.post('/telegraf/import/preview', { content }).then(r => r.data)
export const confirmTelegrafImport = (data) => api.post('/telegraf/import/confirm', data).then(r => r.data)
export const saveTelegrafOverride = (content) => api.put('/telegraf/config/override', { content }).then(r => r.data)
export const revertTelegrafOverride = () => api.delete('/telegraf/config/override').then(r => r.data)

// Telegraf Instances
export const listTelegrafInstances = () => api.get('/telegraf-instances').then(r => r.data)
export const createTelegrafInstance = (data) => api.post('/telegraf-instances', data).then(r => r.data)
export const getTelegrafInstance = (id) => api.get(`/telegraf-instances/${id}`).then(r => r.data)
export const updateTelegrafInstance = (id, data) => api.put(`/telegraf-instances/${id}`, data).then(r => r.data)
export const deleteTelegrafInstance = (id) => api.delete(`/telegraf-instances/${id}`).then(r => r.data)
export const getTelegrafInstanceConfig = (id) => api.get(`/telegraf-instances/${id}/config`)
export const getAllInstanceConfigs = () => api.get('/telegraf-instances/configs').then(r => r.data)
export const autoCreateInstances = () => api.post('/telegraf-instances/auto-create').then(r => r.data)
export const getSplitSuggestions = () => api.get('/telegraf-instances/suggest-splits').then(r => r.data)

// Deployment
export const getDeploymentStatus = () => api.get('/deployment/status').then(r => r.data)
export const deployInstance = (id) => api.post(`/deployment/instances/${id}/deploy`).then(r => r.data)
export const instanceAction = (id, action) => api.post(`/deployment/instances/${id}/action`, { action }).then(r => r.data)
export const getInstanceLogs = (id, tail = 200) => api.get(`/deployment/instances/${id}/logs`, { params: { tail } }).then(r => r.data)
export const deployAll = () => api.post('/deployment/deploy-all').then(r => r.data)
export const getDeploymentSettings = () => api.get('/deployment/settings').then(r => r.data)
export const updateDeploymentSettings = (data) => api.put('/deployment/settings', data).then(r => r.data)
export const testDockerConnection = (data) => api.post('/deployment/test-docker', data).then(r => r.data)

export default api
