export class RoadGuardAPI {
  constructor(base = 'http://127.0.0.1:8000', key = '') {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter an HTTP(S) API base URL without credentials, query, or fragment.');
    this.base = url.href.replace(/\/$/, '');
    this.key = key;
  }
  async request(path, { method = 'GET', body, timeout = 15000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const headers = this.key ? {'X-API-Key':this.key} : {};
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    try {
      const r = await fetch(this.base+path, {method, headers, body, signal:controller.signal});
      const text = await r.text();
      let data; try {data = JSON.parse(text);} catch { throw new Error('Backend returned a non-JSON response. Check the API URL.'); }
      if (!r.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? data);
        throw new Error(r.status === 401 ? 'API key required or incorrect. Update Connection settings.' : `HTTP ${r.status}: ${detail}`);
      }
      return data;
    } catch(e) {
      if (e.name === 'AbortError') throw new Error('Request timed out. Check the backend terminal; the first model load can take longer.');
      if (e instanceof TypeError) throw new Error('Cannot reach FastAPI. Check that it is running and this frontend origin is allowed by CORS.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  health() { return this.request('/health'); }
  list(status='', limit=20, offset=0) { const q=new URLSearchParams({limit,offset}); if(status)q.set('status',status);return this.request('/api/potholes?'+q); }
  detect(file, confidence) {const form=new FormData();form.append('file',file);return this.request('/api/detections?confidence='+confidence,{method:'POST',body:form,timeout:120000});}
  report(body) {return this.request('/api/potholes',{method:'POST',body});}
  status(id,status,note) {return this.request('/api/potholes/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:{status,note}});}
  nearby(latitude,longitude,radius_m) {return this.request('/api/alerts/nearby?'+new URLSearchParams({latitude,longitude,radius_m}));}
}
