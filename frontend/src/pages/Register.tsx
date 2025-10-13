import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface RegisterForm {
  fullName: string
  phone: string
  email: string
  businessName: string
  whatsappNumber: string
  website: string
  plan: 'starter' | 'meta'
}

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    phone: '',
    email: '',
    businessName: '',
    whatsappNumber: '',
    website: '',
    plan: 'starter'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/v1/pre-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
          email: form.email,
          business_name: form.businessName,
          whatsapp_number: form.whatsappNumber,
          website: form.website,
          plan: form.plan
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Error al crear el registro')
      }

      const data = await response.json()
      // Redirigir a Stripe checkout
      window.location.href = data.checkout_url
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Acid IA
          </h1>
          <p className="text-xl text-purple-200">
            Registra tu negocio y comienza a automatizar tus conversaciones
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 text-purple-200 hover:text-white transition-colors"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        </div>

        {/* Form */}
        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos de Contacto */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Datos de Contacto</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={form.fullName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="+52 999 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="juan@ejemplo.com"
                  />
                </div>
              </div>
            </div>

            {/* Datos del Negocio */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Datos del Negocio</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Nombre del Negocio *
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    required
                    value={form.businessName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="Mi Tienda"
                  />
                  <p className="mt-1 text-xs text-purple-300">
                    Se generará un identificador único para tu cuenta basado en este nombre
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Número de WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsappNumber"
                    value={form.whatsappNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="+52 999 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Página Web
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="https://mitienda.com"
                  />
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Selecciona tu Plan</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <label
                  className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all ${
                    form.plan === 'starter'
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-purple-300/30 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="starter"
                    checked={form.plan === 'starter'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Plan Starter</h3>
                    <p className="text-3xl font-bold text-cyan-400 mb-4">$999 MXN/mes</p>
                    <ul className="text-sm text-purple-200 space-y-2 text-left">
                      <li>✓ Respuestas automáticas ilimitadas</li>
                      <li>✓ Integración Facebook + Instagram</li>
                      <li>✓ Dashboard de métricas</li>
                      <li>✓ Soporte por email</li>
                    </ul>
                  </div>
                </label>

                <label
                  className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all ${
                    form.plan === 'meta'
                      ? 'border-cyan-400 bg-cyan-400/10'
                      : 'border-purple-300/30 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="meta"
                    checked={form.plan === 'meta'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Plan Meta</h3>
                    <p className="text-3xl font-bold text-cyan-400 mb-4">$1,999 MXN/mes</p>
                    <ul className="text-sm text-purple-200 space-y-2 text-left">
                      <li>✓ Todo lo del Plan Starter</li>
                      <li>✓ WhatsApp Business integrado</li>
                      <li>✓ Pagos por Stripe</li>
                      <li>✓ Soporte prioritario</li>
                    </ul>
                  </div>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-white">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : 'Continuar al Pago'}
            </button>

            <p className="text-sm text-center text-purple-200">
              Al continuar, aceptas nuestros{' '}
              <a href="/terms" className="text-cyan-400 hover:underline">
                Términos y Condiciones
              </a>
              {' '}y{' '}
              <a href="/privacy" className="text-cyan-400 hover:underline">
                Política de Privacidad
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
