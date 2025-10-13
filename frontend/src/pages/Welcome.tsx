import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!sessionId) {
      // Si no hay session_id, redirigir al inicio
      navigate('/')
      return
    }

    // Countdown para auto-redirigir
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionId, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Welcome Message */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          ¡Bienvenido a Acid IA!
        </h1>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl mb-8">
          <p className="text-xl text-purple-100 mb-6">
            Tu pago se ha procesado exitosamente y tu cuenta ha sido creada.
          </p>

          <div className="bg-cyan-500/20 border border-cyan-400 rounded-lg p-6 text-left mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📧 Revisa tu correo electrónico
            </h2>
            <p className="text-purple-100 mb-4">
              Te hemos enviado un email con:
            </p>
            <ul className="space-y-2 text-purple-100">
              <li>✓ Tus credenciales de acceso</li>
              <li>✓ URL de inicio de sesión</li>
              <li>✓ Instrucciones de configuración</li>
            </ul>
          </div>

          <div className="bg-white/5 rounded-lg p-6 text-left">
            <h3 className="text-lg font-bold text-white mb-3">
              Próximos pasos:
            </h3>
            <ol className="space-y-2 text-purple-100 list-decimal list-inside">
              <li>Inicia sesión con las credenciales de tu email</li>
              <li>Conecta tu página de Facebook/Instagram</li>
              <li>Configura tu número de WhatsApp (si aplica)</li>
              <li>Personaliza el comportamiento de tu asistente IA</li>
              <li>¡Comienza a automatizar tus conversaciones!</li>
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => navigate('/login')}
            className="w-full max-w-md mx-auto block py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-lg shadow-lg transition-all"
          >
            Iniciar Sesión Ahora
          </button>

          <p className="text-purple-200 text-sm">
            Serás redirigido automáticamente en{' '}
            <span className="font-bold text-cyan-400">{countdown}</span> segundos
          </p>
        </div>

        {/* Support */}
        <div className="mt-8 text-purple-200 text-sm">
          <p>
            ¿Necesitas ayuda?{' '}
            <a
              href="mailto:info@acidia.app"
              className="text-cyan-400 hover:underline font-medium"
            >
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
