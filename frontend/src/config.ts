const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

export const API_BASE = import.meta.env.VITE_API_BASE
  || import.meta.env.VITE_API_URL
  || (isLocalhost ? 'http://localhost:10000' : 'https://widget-backend-1-pip5.onrender.com')
