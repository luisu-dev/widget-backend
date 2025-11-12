import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'
import AdminWhatsApp from './pages/AdminWhatsApp'
import PrivacyPage from './Privacy'
import TermsPage from './Terms'
import DataDeletionPage from './DataDeletion'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/bienvenida" element={<Welcome />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
