import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { API_BASE } from '../../config'

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
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Usar settings de la página seleccionada si existe, sino usar settings del tenant
  const settings = selectedPage?.page_settings || tenant.settings || {}
  const defaultBrand = selectedPage?.page_name || tenant.name || ''

  const [formData, setFormData] = useState({
    brand: settings.brand || defaultBrand,
    tone: settings.tone || t('brand_config.default_tone'),
    policies: settings.policies || '',
    hours: settings.hours || '',
    products: settings.products || '',
    bot_off_message: settings.bot_off_message || t('brand_config.default_bot_off')
  })

  useEffect(() => {
    const currentSettings = selectedPage?.page_settings || tenant.settings || {}
    const currentBrand = selectedPage?.page_name || tenant.name || ''

    setFormData({
      brand: currentSettings.brand || currentBrand,
      tone: currentSettings.tone || t('brand_config.default_tone'),
      policies: currentSettings.policies || '',
      hours: currentSettings.hours || '',
      products: currentSettings.products || '',
      bot_off_message: currentSettings.bot_off_message || t('brand_config.default_bot_off')
    })
  }, [tenant, selectedPage, t])

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

      if (!res.ok) throw new Error(t('brand_config.save_error'))

      const message = selectedPage
        ? t('brand_config.page_saved', { page: selectedPage.page_name })
        : t('brand_config.saved')

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
      <h3 className="text-xl font-semibold text-white mb-4">{t('brand_config.title')}</h3>
      <p className="text-gray-400 text-sm mb-6">
        {t('brand_config.subtitle')}
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
            {t('brand_config.business_name')}
          </label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder={t('brand_config.business_placeholder')}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('brand_config.business_hint')}
          </p>
        </div>

        {/* Tono de Voz */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('brand_config.tone')}
          </label>
          <select
            value={formData.tone}
            onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#04d9b5]"
          >
            <option value="formal y profesional">{t('brand_config.tone_formal')}</option>
            <option value="amigable y profesional">{t('brand_config.tone_friendly')}</option>
            <option value="casual y cercano">{t('brand_config.tone_casual')}</option>
            <option value="técnico y experto">{t('brand_config.tone_technical')}</option>
            <option value="juvenil y dinámico">{t('brand_config.tone_young')}</option>
          </select>
        </div>

        {/* Productos/Servicios */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('brand_config.products')}
          </label>
          <textarea
            value={formData.products}
            onChange={(e) => setFormData({ ...formData, products: e.target.value })}
            placeholder={t('brand_config.products_placeholder')}
            rows={4}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5] resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('brand_config.products_hint')}
          </p>
        </div>

        {/* Horarios */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('brand_config.hours')}
          </label>
          <input
            type="text"
            value={formData.hours}
            onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
            placeholder={t('brand_config.hours_placeholder')}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]"
          />
        </div>

        {/* Políticas */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('brand_config.policies')}
          </label>
          <textarea
            value={formData.policies}
            onChange={(e) => setFormData({ ...formData, policies: e.target.value })}
            placeholder={t('brand_config.policies_placeholder')}
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#04d9b5] resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('brand_config.policies_hint')}
          </p>
        </div>

        {/* Mensaje cuando el bot está pausado */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('brand_config.bot_off_message')}
          </label>
          <textarea
            value={formData.bot_off_message}
            onChange={(e) => setFormData({ ...formData, bot_off_message: e.target.value })}
            placeholder={t('brand_config.bot_off_placeholder')}
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
            {saving ? t('brand_config.saving') : t('brand_config.save')}
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
            <p className="font-medium mb-1">{t('brand_config.tip_title')}</p>
            <p className="text-blue-300">
              {t('brand_config.tip_text')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
