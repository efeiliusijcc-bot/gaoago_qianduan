const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.error || data?.message || data?.details?.[0] || `HTTP ${response.status}`)
  }

  return data
}

export function fetchOpenClawHealth() {
  return request('/openclaw/health')
}

export function createReportJob(body) {
  return request('/report-jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchReportJobs() {
  return request('/report-jobs')
}

export function fetchReportJob(jobId) {
  return request(`/report-jobs/${jobId}`)
}

export function fetchReportResult(jobId) {
  return request(`/report-jobs/${jobId}/result`)
}

export function getDownloadUrl(jobId, format = 'md') {
  return `${API_BASE}/report-jobs/${jobId}/download?format=${format}`
}

export function getJobEventsUrl(jobId) {
  return `${API_BASE}/report-jobs/${jobId}/events`
}
