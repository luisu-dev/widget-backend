import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface CreateUserForm {
  tenantSlug: string
  email: string
  password: string
  sendEmail: boolean
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<CreateUserForm>({
    tenantSlug: '',
    email: '',
    password: '',
    sendEmail: true
  })

  // Verificar si el usuario es admin
  const token = localStorage.getItem('zia_token')
  if (!token) {
    navigate('/login')
    return null
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm(prev => ({ ...prev, password }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/v1/admin/create-user-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant: form.tenantSlug,
          email: form.email,
          password: form.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error al crear el usuario')
      }

      setSuccess(`Usuario creado exitosamente para ${form.email}`)

      // Si se debe enviar email, llamar al endpoint correspondiente
      if (form.sendEmail) {
        // TODO: Implementar envío de email
        console.log('Sending credentials email to:', form.email)
      }

      // Limpiar formulario
      setForm({
        tenantSlug: '',
        email: '',
        password: '',
        sendEmail: true
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
            <p className="text-gray-400 mt-1">Crear credenciales manualmente para ventas directas</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            ← Volver al Dashboard
          </button>
        </div>

        {/* Form Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Crear Usuario Sin Pago</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tenant Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tenant Slug *
                </label>
                <input
                  type="text"
                  name="tenantSlug"
                  required
                  value={form.tenantSlug}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                  placeholder="mi-empresa-2024"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Identificador único del cliente (solo letras minúsculas, números y guiones)
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                  placeholder="cliente@empresa.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    placeholder="Contraseña temporal"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition font-medium whitespace-nowrap"
                  >
                    Generar
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  El usuario podrá cambiarla después de iniciar sesión
                </p>
              </div>

              {/* Send Email */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={form.sendEmail}
                  onChange={(e) => setForm(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  className="w-4 h-4 text-cyan-600 bg-gray-900 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                />
                <label htmlFor="sendEmail" className="ml-2 text-sm text-gray-300">
                  Enviar credenciales por correo electrónico
                </label>
              </div>

              {/* Success Message */}
              {success && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-green-300">
                  {success}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-300">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creando Usuario...' : 'Crear Usuario'}
              </button>
            </form>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-300 mb-2">ℹ️ Información</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Este usuario se creará sin pasar por el proceso de pago</li>
                <li>• El cliente podrá conectar sus integraciones (Facebook, WhatsApp, Stripe)</li>
                <li>• Se creará automáticamente un tenant con el slug especificado</li>
                <li>• El usuario tendrá rol de "tenant_admin" con todos los permisos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
