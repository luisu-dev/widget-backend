import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

interface BrandConfigProps {
  token: string
  tenant: {
    slug: string
    name: string
    settings?: {
      brand?: string
      tone?: string
      policies?: string
      hours?: string
      products?: string
      prices?: Record<string, string>
      faq?: Array<{ q: string; a: string }>
      bot_off_message?: string
      [key: string]: any
    }
  }
  selectedPage?: {
    page_id: string
    page_name: string
    page_settings?: {
      brand?: string
      tone?: string
      policies?: string
      hours?: string
      products?: string
      bot_off_message?: string
      [key: string]: any
    }
  } | null
  onUpdate?: () => void
}

export default function BrandConfig({ token, tenant, selectedPage, onUpdate }: BrandConfigProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Usar settings de la página seleccionada si existe, sino usar settings del tenant
  const settings = selectedPage?.page_settings || tenant.settings || {}
  const defaultBrand = selectedPage?.page_name || tenant.name || ''

  const [formData, setFormData] = useState({
    brand: settings.brand || defaultBrand,
    tone: settings.tone || 'amigable y profesional',
    policies: settings.policies || '',
    hours: settings.hours || '',
    products: settings.products || '',
    bot_off_message: settings.bot_off_message || 'El asistente está en pausa. Escríbenos por WhatsApp o envíanos un correo y te respondemos enseguida.'
  })

  useEffect(() => {
    const currentSettings = selectedPage?.page_settings || tenant.settings || {}
    const currentBrand = selectedPage?.page_name || tenant.name || ''

    setFormData({
      brand: currentSettings.brand || currentBrand,
      tone: currentSettings.tone || 'amigable y profesional',
      policies: currentSettings.policies || '',
      hours: currentSettings.hours || '',
      products: currentSettings.products || '',
      bot_off_message: currentSettings.bot_off_message || 'El asistente está en pausa. Escríbenos por WhatsApp o envíanos un correo y te respondemos enseguida.'
    })
  }, [tenant, selectedPage])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Si hay página seleccionada, guardar settings de la página
      // Si no, guardar settings del tenant (comportamiento antiguo)
      const endpoint = selectedPage
        ? `${API_BASE}/auth/facebook/pages/${selectedPage.page_id}/settings`
        : `${API_BASE}/v1/admin/tenant/settings`

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: formData
        })
      })

      if (!res.ok) throw new Error('Error al guardar configuración')

      const message = selectedPage
        ? `Configuración de "${selectedPage.page_name}" guardada exitosamente`
        : 'Configuración guardada exitosamente'

      setSuccess(message)

      // Notificar al componente padre
      if (onUpdate) {
        setTimeout(() => onUpdate(), 500)
      }

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Identidad de Marca del Bot</h3>
      <p className="text-gray-400 text-sm mb-6">
        Configura cómo se presenta tu asistente de IA ante los clientes
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-200 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* Nombre de Marca */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre de tu negocio
          </label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Ej: Kante Bike Rentals"
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]"
          />
          <p className="text-xs text-gray-500 mt-1">
            El bot se presentará como asistente de esta marca
          </p>
        </div>

        {/* Tono de Voz */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tono de voz
          </label>
          <select
            value={formData.tone}
            onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#04d9b5]"
          >
            <option value="formal y profesional">Formal y profesional</option>
            <option value="amigable y profesional">Amigable y profesional</option>
            <option value="casual y cercano">Casual y cercano</option>
            <option value="técnico y experto">Técnico y experto</option>
            <option value="juvenil y dinámico">Juvenil y dinámico</option>
          </select>
        </div>

        {/* Productos/Servicios */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Productos o servicios
          </label>
          <textarea
            value={formData.products}
            onChange={(e) => setFormData({ ...formData, products: e.target.value })}
            placeholder="Ej: Renta de bicicletas de montaña, eléctricas y urbanas. Tours guiados por la ciudad. Servicio de entrega a domicilio."
            rows={4}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5] resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Describe brevemente qué ofreces
          </p>
        </div>

        {/* Horarios */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Horarios de atención
          </label>
          <input
            type="text"
            value={formData.hours}
            onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
            placeholder="Ej: Lunes a Viernes 9am-7pm, Sábados 10am-6pm"
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]"
          />
        </div>

        {/* Políticas */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Políticas importantes
          </label>
          <textarea
            value={formData.policies}
            onChange={(e) => setFormData({ ...formData, policies: e.target.value })}
            placeholder="Ej: Depósito reembolsable de $500. Cancelaciones con 24h de anticipación. Se requiere identificación oficial."
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5] resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Reglas que el bot debe mencionar (cancelaciones, depósitos, etc.)
          </p>
        </div>

        {/* Mensaje cuando el bot está pausado */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mensaje cuando el bot está pausado
          </label>
          <textarea
            value={formData.bot_off_message}
            onChange={(e) => setFormData({ ...formData, bot_off_message: e.target.value })}
            placeholder="El asistente está en pausa. Escríbenos por WhatsApp..."
            rows={2}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5] resize-none"
          />
        </div>

        {/* Botón Guardar */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#04d9b5] to-[#02a88a] hover:from-[#02a88a] hover:to-[#04d9b5] text-black font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">Tip profesional:</p>
            <p className="text-blue-300">
              Cuanta más información proporciones, mejores respuestas dará tu asistente.
              Puedes actualizar esta configuración en cualquier momento.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
