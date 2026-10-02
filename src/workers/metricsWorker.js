const API_BASE_URL = 'http://localhost:3001/api';

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  
  try {
    if (type === 'DASHBOARD_METRICS') {
      const res = await fetch(`${API_BASE_URL}/metrics/dashboard`);
      const data = await res.json();
      self.postMessage({ type: 'DASHBOARD_METRICS_RESULT', payload: data });
    } 
    else if (type === 'REPORT_METRICS') {
      const { range } = payload;
      const res = await fetch(`${API_BASE_URL}/metrics/reports?from=${range.from}&to=${range.to}`);
      const data = await res.json();
      self.postMessage({ type: 'REPORT_METRICS_RESULT', payload: data });
    } 
    else if (type === 'MONTHLY_RECORDS_METRICS') {
      const res = await fetch(`${API_BASE_URL}/metrics/monthly`);
      const data = await res.json();
      self.postMessage({ type: 'MONTHLY_RECORDS_METRICS_RESULT', payload: data });
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: error.message });
  }
};
