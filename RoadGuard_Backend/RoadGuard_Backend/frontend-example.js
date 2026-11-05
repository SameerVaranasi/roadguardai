// Set API base URL to the laptop API during local development.
export function roadGuardClient(baseURL = 'http://127.0.0.1:8000', apiKey = '') {
  async function request(path, options = {}) {
    const response = await fetch(baseURL + path, {
      ...options,
      headers: { ...(apiKey ? {'X-API-Key': apiKey} : {}), ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data.detail ?? data));
    return data;
  }
  return {
    listReports: (status = '') => request('/api/potholes' + (status ? '?status='+encodeURIComponent(status) : '')),
    detect: (file, confidence = 0.25) => {
      const form = new FormData();
      form.append('file', file);
      return request('/api/detections?confidence='+confidence, {method: 'POST', body: form});
    },
    report: (body) => request('/api/potholes', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    }),
    setStatus: (id, status, note) => request('/api/potholes/'+encodeURIComponent(id)+'/status', {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status,note})
    }),
    nearby: (latitude, longitude, radius_m = 100) => request('/api/alerts/nearby?'+new URLSearchParams({latitude,longitude,radius_m})),
  };
}
