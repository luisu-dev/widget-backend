import { useRef, useState, useEffect, useMemo } from "react";
import type { ReactNode, MouseEvent } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import type { MotionValue } from "framer-motion";

import logoMini from "../images/logo_mini.png";
import faviconUrl from "../images/favicon.ico";
import { sendContact } from "./lib/contact";

/* ========= Rendimiento (bajar costos en Android/equipos modestos) ========= */
const isAndroid = /Android/i.test(navigator.userAgent);
const lowPower =
  isAndroid || (navigator.hardwareConcurrency || 8) <= 4 || window.devicePixelRatio >= 3;

/* ========= NAV ========= */
function Nav({ active, visible, isDark, cart, onOpenCart }: { active: string; visible: boolean; isDark: boolean; cart: string[]; onOpenCart: () => void }) {
  const items = [
    { id: "inicio", label: "Inicio" },
    { id: "quienes-somos", label: "Quiénes somos" },
    { id: "planes", label: "Planes" },
    { id: "contacto", label: "Contacto" },
  ];

  return (
    <motion.nav
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -12 }}
      transition={{ duration: 0.25 }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] rounded-2xl border ${
        isDark ? "border-white/10 bg-black/60" : "border-black/10 bg-white/80"
      } ${lowPower ? "" : "backdrop-blur"} px-2 py-2 ${visible ? "pointer-events-auto" : "pointer-events-none"}
      max-w-[92vw] overflow-x-auto`}
      style={{ scrollbarWidth: "none" as any }}
    >
      <div className="flex items-center gap-4">
        <a href="#inicio" className="flex items-center rounded-xl px-2 py-1" aria-label="Ir al inicio">
          <img src={logoMini} alt="Acid IA" className="h-10 w-auto" />
          <span className="sr-only">Acid IA</span>
        </a>
        <ul className="flex items-center gap-2">
        {items.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap text-sm md:text-[15px] ${
                  isActive
                    ? "bg-[#04d9b5] text-black"
                    : isDark
                    ? "text-white/85 hover:bg-white/10"
                    : "text-black/85 hover:bg-black/10"
                }`}
              >
                {label}
              </a>
            </li>
          );
        })}
        </ul>
        {cart.length > 0 && (
          <button
            onClick={onOpenCart}
            className="ml-4 rounded-xl bg-[#04d9b5] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110 hidden md:block"
          >
            🛒 Carrito ({cart.length})
          </button>
        )}
      </div>
    </motion.nav>
  );
}

/* ========= FAB CARRITO MÓVIL ========= */
function CartFab({ cart, onClick, visible, isDark }: { cart: string[]; onClick: () => void; visible: boolean; isDark: boolean }) {
  if (cart.length === 0) return null;

  return (
    <motion.button
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.8 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className={`md:hidden fixed bottom-6 left-6 z-[200] rounded-full p-4 shadow-lg ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      } ${isDark ? "bg-[#04d9b5]" : "bg-[#04d9b5]"} text-black font-semibold`}
      aria-label="Ver carrito"
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">🛒</span>
        <span className="text-sm">{cart.length}</span>
      </div>
    </motion.button>
  );
}

/* ========= UI Reutilizable ========= */
function Section({
  id,
  title,
  children,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`px-6 py-20 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-center">{title}</h2>
        <div>{children}</div>
      </div>
    </section>
  );
}
function ValueCard({
  title,
  children,
  isDark,
  accent = "#183df2",
}: {
  title: string;
  children: ReactNode;
  isDark: boolean;
  accent?: string;
}) {
  return (
    <div className={`p-6 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}>
      <h3 className="text-xl font-semibold mb-2" style={{ color: accent }}>
        {title}
      </h3>
      <p className={isDark ? "text-white/70" : "text-black/70"}>{children}</p>
    </div>
  );
}
type PlanDetailSection = {
  title: string;
  body?: string;
  items?: string[];
};

type PlanCardData = {
  key: string;
  title: string;
  image: string;
  features: string[];
  price?: string;
  priceId?: string;
  sections: PlanDetailSection[];
};

const CLIENT_REQUIREMENTS = [
  "Starter: sitio web donde insertar el widget y FAQs base",
  "WhatsApp: cuenta WhatsApp Business API aprobada y proveedor (Meta Cloud API o Twilio) a cargo del cliente",
  "E-commerce (add-on): cuenta Stripe activa y catalog_url/IDs de producto o precio",
  "Paquetes web: contenidos, branding y estructura deseada; para e-commerce, catálogo e integración preferida",
  "Stripe solo se configura cuando se contrata el add-on de e-commerce",
  "Founders Plan: a partir del segundo módulo o paquete en el mismo tenant, 50% de descuento (excepto add-on WhatsApp salvo promos vigentes)",
];

const GENERAL_CONDITIONS = [
  "Uso incluido por mes: 1M tokens de entrada + 1M tokens de salida por tenant; excedentes se cobran con bolsas adicionales",
  "Modelos incluidos: familia GPT-4o mini; modelos premium o contextos ampliados se cotizan aparte",
  "Pagos externos: comisiones de Stripe y proveedores de WhatsApp (Meta/Twilio/BSP) a cargo del cliente",
  "Trabajamos exclusivamente con Twilio o Meta Cloud API para WhatsApp, según disponibilidad por país",
  "Plazo anual (12 meses) con renovación automática; cancelación con 30 días de anticipación",
  "SLA: soporte en horario hábil, incidencias críticas con máximo esfuerzo; cambios mayores se cotizan",
  "Actualizaciones continuas del widget, parches de seguridad y compatibilidad con nuevos releases",
  "Cada cliente es responsable de políticas, textos legales y uso legítimo de sus datos",
];

function PlanCard({ plan, isDark, onShowDetails, onScrollToContact, onAddToCart }: {
  plan: PlanCardData;
  isDark: boolean;
  onShowDetails: (plan: PlanCardData) => void;
  onScrollToContact: () => void;
  onAddToCart: (priceId: string) => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-6 transition ${
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      }`}
    >
      <h4 className="text-xl font-semibold">{plan.title}</h4>
      <div className="mt-4 aspect-square w-full overflow-hidden rounded-2xl">
        <img
          src={plan.image}
          alt={plan.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <ul className={`mt-4 space-y-2 text-sm ${isDark ? "text-white/70" : "text-black/70"}`}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#04d9b5]" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {plan.price && (
        <div className="mt-5 text-sm font-semibold text-[#04d9b5]">{plan.price}</div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => onShowDetails(plan)}
          className="rounded-xl border border-[#04d9b5] px-4 py-2 text-sm font-medium text-[#04d9b5] transition hover:bg-[#04d9b5]/10"
          type="button"
        >
          Detalles
        </button>
        {plan.priceId && (
          <button
            onClick={() => onAddToCart(plan.priceId!)}
            className="rounded-xl bg-[#04d9b5]/10 px-4 py-2 text-sm font-medium text-[#04d9b5] transition hover:bg-[#04d9b5]/20"
            type="button"
          >
            Agregar al carrito
          </button>
        )}
        <button
          onClick={onScrollToContact}
          className="rounded-xl bg-[#04d9b5] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110"
          type="button"
        >
          Contratar
        </button>
      </div>
    </div>
  );
}

function PlanCarousel({
  plans,
  isDark,
  onShowDetails,
  onScrollToContact,
  onAddToCart,
  label,
  showArrow = false,
}: {
  plans: PlanCardData[];
  isDark: boolean;
  onShowDetails: (plan: PlanCardData) => void;
  onScrollToContact: () => void;
  onAddToCart: (priceId: string) => void;
  label: string;
  showArrow?: boolean;
}) {
  return (
    <div className="mt-10">
      <h4 className="text-lg font-semibold mb-4">{label}</h4>
      <div className="relative">
        <div
          className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" as any }}
        >
          {plans.map((plan) => (
            <div
              key={plan.key}
              className="w-[90vw] max-w-[380px] snap-center shrink-0"
            >
              <PlanCard
                plan={plan}
                isDark={isDark}
                onShowDetails={onShowDetails}
                onScrollToContact={onScrollToContact}
                onAddToCart={onAddToCart}
              />
            </div>
          ))}
        </div>
        {showArrow && (
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l ${
              isDark ? "from-black/0 via-black/10" : "from-white/0 via-white/70"
            } to-transparent pr-3`}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                isDark ? "bg-black/70 text-white/80" : "bg-white/80 text-black/70"
              }`}
              aria-hidden="true"
            >
              →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========= APP (oscuro) ========= */
export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  // Estado para el catálogo cargado
  const [planCards, setPlanCards] = useState<PlanCardData[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Cargar catálogo desde URL
  useEffect(() => {
    const catalogUrl = import.meta.env.VITE_CATALOG_URL || "https://acidia.app/catalog.json";

    fetch(catalogUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setPlanCards(data.plans || []);
        setCatalogLoading(false);
      })
      .catch(err => {
        console.error("Error loading catalog:", err);
        setCatalogError(err.message);
        setCatalogLoading(false);
      });
  }, []);

  // Scroll driver (global) — ya no usado directamente
  // Eliminado para evitar warning TS6133 (noUnusedLocals)
  // Progreso del HERO únicamente
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroSmooth = useSpring(heroProgress, { stiffness: 70, damping: 20, mass: 0.3 });

  // Escala general para el grupo de blobs (más sutil en equipos modestos).
  const scale = useTransform(
    heroSmooth,
    [0, 0.6, 1],
    lowPower ? [1.15, 0.8, 0.55] : [1.28, 0.9, 0.6]
  );

  const heroYOffset = useTransform(heroSmooth, [0, 0.5, 1], [0, -80, -220]);

  // Desvanecer orbes al hacer scroll
  const smokeOpacity = useTransform(heroSmooth, [0, 0.3, 0.5], [1, 0.5, 0]);

  // Modo de color según preferencia del usuario
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const update = () => setIsDark(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    } catch {}
  }, []);

  useEffect(() => {
    document.title = "Acid IA";
    const ensureFavicon = () => {
      const selector = "link[rel='icon']";
      let link = document.querySelector<HTMLLinkElement>(selector);
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/x-icon";
      if (link.href !== faviconUrl) {
        link.href = faviconUrl;
      }
    };
    ensureFavicon();
  }, [faviconUrl]);

  // Logo aparece cuando los orbes se desvanecen
  const overlayOpacity = useTransform(heroSmooth, [0, 0.9, 1], [1, 1, 0]);
  const titleOpacity   = useTransform(heroSmooth, [0, 0.2, 0.4, 0.85, 1], [0, 0, 1, 0.8, 0]);
  const titleScale     = useTransform(heroSmooth, [0, 0.5, 1], [1, 1.18, 1.36]);

  // Mostrar nav solo al final del hero
  const navTrigger = useTransform(heroSmooth, [0.86, 0.94, 0.99, 1], [0, 0.35, 0.8, 1]);
  const [navVisible, setNavVisible] = useState(false);
  useEffect(() => {
    const unsub = navTrigger.on("change", (value) => {
      setNavVisible(value > 0.55);
    });
    return () => unsub();
  }, [navTrigger]);

  // Scroll-spy
  const [active, setActive] = useState("inicio");
  const [activePlan, setActivePlan] = useState<PlanCardData | null>(null);
  const [cart, setCart] = useState<string[]>([]);
  const [showCart, setShowCart] = useState(false);

  const addToCart = (priceId: string) => {
    if (!priceId) return;
    setCart((prevCart) => [...prevCart, priceId]);
    alert("Plan agregado al carrito!");
  };

  const removeFromCart = (index: number) => {
    setCart((prevCart) => prevCart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Agrupar productos iguales y contar cantidades
    const productCounts = cart.reduce<Record<string, number>>((acc, priceId) => {
      acc[priceId] = (acc[priceId] || 0) + 1;
      return acc;
    }, {});

    const lineItems = Object.entries(productCounts).map(([priceId, quantity]) => ({
      price: priceId,
      quantity,
    }));

    // Endpoint del backend para crear Checkout Session
    const checkoutEndpoint = import.meta.env.VITE_CHECKOUT_ENDPOINT || 'https://acidia.app/api/create-checkout-session';

    console.log('🛒 Iniciando checkout con:', lineItems);
    console.log('📡 Endpoint:', checkoutEndpoint);

    try {
      const response = await fetch(checkoutEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems }),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      // Verificar si la respuesta es JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Respuesta no es JSON:', text.substring(0, 200));
        throw new Error('El servidor no respondió correctamente. Verifica la configuración del endpoint.');
      }

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear sesión de pago');
      }

      if (!data.url) {
        throw new Error('No se recibió URL de checkout');
      }

      console.log('✅ Redirigiendo a:', data.url);
      window.location.href = data.url;
      setShowCart(false);
    } catch (error: any) {
      console.error('❌ Error en checkout:', error);
      alert(`Error al procesar el pago: ${error.message}\n\nRevisa la consola para más detalles.`);
    }
  };

  useEffect(() => {
    const ids = ["inicio", "quienes-somos", "planes", "contacto"];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (sections.length === 0) return;

    // IntersectionObserver es más barato que medir en cada scroll.
    let current = "inicio";
    const io = new IntersectionObserver(
      (entries) => {
        // Elegimos la sección con mayor ratio visible dentro de la banda central
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));
        const top = visible[0];
        if (top?.target?.id && top.target.id !== current) {
          current = top.target.id;
          setActive(current);
        }
      },
      {
        // Banda central del viewport para decidir la sección activa
        root: null,
        rootMargin: "-45% 0px -45% 0px",
        threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
      }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!activePlan) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePlan(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePlan]);

  const scrollToContact = () => {
    const contact = document.getElementById("contacto");
    if (contact) {
      contact.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const closeAndContact = () => {
    setActivePlan(null);
    scrollToContact();
  };

  const primaryPlans = planCards.slice(0, 4);
  const webPlans = planCards.slice(4);

  const lavaBlobs = useMemo(() => {
    const baseConfigs = [
      {
        id: "blob-a",
        focus: "32% 28%",
        size: "46vmin",
        opacity: isDark ? 0.9 : 0.8,
        initial: { x: -60, y: -50, scale: 1.05 },
        animate: {
          x: [-60, 30, -20, -60],
          y: [-50, -90, 40, -50],
          scale: [1.05, 1.22, 0.94, 1.05],
        },
        duration: 14,
      },
      {
        id: "blob-b",
        focus: "68% 40%",
        size: "50vmin",
        opacity: isDark ? 0.85 : 0.75,
        initial: { x: 40, y: 10, scale: 1.1 },
        animate: {
          x: [40, -10, 60, 40],
          y: [10, 70, -40, 10],
          scale: [1.1, 0.96, 1.25, 1.1],
        },
        duration: 16,
      },
      {
        id: "blob-c",
        focus: "58% 72%",
        size: "54vmin",
        opacity: isDark ? 0.8 : 0.7,
        initial: { x: -10, y: 70, scale: 0.95 },
        animate: {
          x: [-10, 70, -60, -10],
          y: [70, 20, 100, 70],
          scale: [0.95, 1.18, 0.9, 0.95],
        },
        duration: 18,
      },
      {
        id: "blob-d",
        focus: "42% 64%",
        size: "38vmin",
        opacity: isDark ? 0.75 : 0.65,
        initial: { x: -90, y: 40, scale: 1 },
        animate: {
          x: [-90, -30, -120, -90],
          y: [40, 90, -10, 40],
          scale: [1, 1.12, 0.88, 1],
        },
        duration: 20,
      },
    ];

    return baseConfigs.map(({ focus, ...config }) => {
      const hue = Math.floor(Math.random() * 360);
      const hueOffset = (hue + 30 + Math.random() * 60) % 360;
      const saturation = 68 + Math.random() * 20;
      const lightness = (isDark ? 52 : 58) + Math.random() * 8;
      const coreAlpha = isDark ? 0.88 : 0.72;
      const midAlpha = isDark ? 0.28 : 0.22;
      const core = `hsla(${hue}, ${saturation}%, ${lightness}%, ${coreAlpha})`;
      const mid = `hsla(${hueOffset}, ${Math.min(100, saturation + 10)}%, ${Math.max(30, lightness - 18)}%, ${midAlpha})`;

      return {
        ...config,
        background: `radial-gradient(circle at ${focus}, ${core} 0%, ${mid} 46%, rgba(0,0,0,0) 78%)`,
      };
    });
  }, [isDark]);

  // ===== Interacción: cursor en desktop, acelerómetro en móvil =====
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const x = useSpring(mvX, { stiffness: 120, damping: 20, mass: 0.2 });
  const y = useSpring(mvY, { stiffness: 120, damping: 20, mass: 0.2 });
  // Mantener centrado verticalmente (sin subir al hacer scroll)
  const baseY = useTransform(heroSmooth, [0, 1], [0, 0]) as MotionValue<number>;
  const yMix = useTransform([y, baseY], (vals: number[]) => vals[0] + vals[1]) as MotionValue<number>;

  useEffect(() => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // respetar accesibilidad

    let amp = Math.round(Math.min(window.innerWidth, window.innerHeight) * (lowPower ? 0.05 : 0.08));
    amp = Math.min(amp, lowPower ? 48 : 80);
    const updateAmp = () => {
      amp = Math.round(Math.min(window.innerWidth, window.innerHeight) * (lowPower ? 0.05 : 0.08));
      amp = Math.min(amp, lowPower ? 48 : 80);
    };
    window.addEventListener("resize", updateAmp);

    // Cursor (desktop)
    const onPointer = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      mvX.set(nx * amp);
      mvY.set(ny * amp);
    };

    // Acelerómetro (móvil)
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = (e.gamma ?? 0); // izq-der (-90..90)
      const beta = (e.beta ?? 0); // frente-atrás (-180..180)
      const sens = lowPower ? 28 : 18; // menor divisor = más sensibilidad
      const nx = Math.max(-1, Math.min(1, gamma / sens));
      const ny = Math.max(-1, Math.min(1, beta / sens));
      mvX.set(nx * amp);
      mvY.set(ny * amp);
    };

    // Elegimos input según capacidades
    const isTouch = matchMedia("(pointer: coarse)").matches;
    if (isTouch) {
      window.addEventListener("deviceorientation", onOrient);
    } else {
      window.addEventListener("pointermove", onPointer);
    }

    return () => {
      window.removeEventListener("resize", updateAmp);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [mvX, mvY]);

  return (
    <div ref={ref} className={`relative min-h-[260vh] ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      <Nav active={active} visible={navVisible} isDark={isDark} cart={cart} onOpenCart={() => setShowCart(true)} />
      <CartFab cart={cart} onClick={() => setShowCart(true)} visible={navVisible} isDark={isDark} />

      {activePlan && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setActivePlan(null)}
            role="presentation"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`relative w-full max-w-xl rounded-3xl border p-6 shadow-xl ${
              isDark
                ? "border-white/10 bg-black/90 text-white"
                : "border-black/10 bg-white text-black"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-modal-title"
          >
            <button
              onClick={() => setActivePlan(null)}
              className={`absolute right-4 top-4 rounded-full border px-2 py-1 text-sm ${
                isDark ? "border-white/20 text-white/70 hover:text-white" : "border-black/10 text-black/60 hover:text-black"
              }`}
              aria-label="Cerrar"
              type="button"
            >
              ×
            </button>
            <h4 id="plan-modal-title" className="text-2xl font-semibold">
              {activePlan.title}
            </h4>
            <div className="mt-4 aspect-square w-full overflow-hidden rounded-2xl">
              <img
                src={activePlan.image}
                alt={activePlan.title}
                className="h-full w-full object-cover"
              />
            </div>
            {activePlan.price && (
              <div className="mt-4 text-sm font-semibold text-[#04d9b5]">{activePlan.price}</div>
            )}
            <div className="mt-6 space-y-5">
              {activePlan.sections
                .filter((section) => section.title !== "Características destacadas")
                .map((section) => (
                  <div key={`${activePlan.key}-${section.title}`}>
                    <h5 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#04d9b5]">
                      {section.title}
                    </h5>
                    {section.body && (
                    <p className={`mt-2 text-sm leading-relaxed ${isDark ? "text-white/70" : "text-black/70"}`}>
                      {section.body}
                    </p>
                  )}
                  {section.items && (
                    <ul className={`mt-3 space-y-2 text-sm ${isDark ? "text-white/70" : "text-black/70"}`}>
                      {section.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-[#04d9b5]" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={closeAndContact}
                className="rounded-xl bg-[#04d9b5] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                type="button"
              >
                Contratar
              </button>
              {activePlan.priceId && (
                <button
                  onClick={() => addToCart(activePlan.priceId!)}
                  className="rounded-xl border border-[#04d9b5] px-4 py-2 text-sm font-medium text-[#04d9b5] transition hover:bg-[#04d9b5]/10"
                  type="button"
                >
                  Agregar al carrito
                </button>
              )}
              {activePlan.key !== "starter" && (
                <button
                  onClick={closeAndContact}
                  className="rounded-xl bg-[#04d9b5]/10 px-4 py-2 text-sm font-medium text-[#04d9b5] transition hover:bg-[#04d9b5]/20"
                  type="button"
                >
                  Probar
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowCart(false)}
            role="presentation"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`relative w-full max-w-md rounded-3xl border p-6 shadow-xl ${
              isDark
                ? "border-white/10 bg-black/90 text-white"
                : "border-black/10 bg-white text-black"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-modal-title"
          >
            <button
              onClick={() => setShowCart(false)}
              className={`absolute right-4 top-4 rounded-full border px-2 py-1 text-sm ${
                isDark ? "border-white/20 text-white/70 hover:text-white" : "border-black/10 text-black/60 hover:text-black"
              }`}
              aria-label="Cerrar"
              type="button"
            >
              ×
            </button>
            <h4 id="cart-modal-title" className="text-2xl font-semibold">
              🛒 Carrito ({cart.length})
            </h4>
            {cart.length === 0 ? (
              <p className={`mt-4 text-sm ${isDark ? "text-white/70" : "text-black/70"}`}>
                El carrito está vacío
              </p>
            ) : (
              <>
                <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {cart.map((priceId, index) => {
                    const plan = planCards.find(p => p.priceId === priceId);
                    return (
                      <li key={`${priceId}-${index}`} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                        <span className="text-sm flex-1">{plan?.title || priceId}</span>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 hover:text-red-600 text-sm px-2 py-1"
                          type="button"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={handleCheckout}
                    className="flex-1 rounded-xl bg-[#04d9b5] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                    type="button"
                  >
                    Ir a Pagar
                  </button>
                  <button
                    onClick={clearCart}
                    className={`rounded-xl border px-4 py-2 text-sm ${isDark ? "border-white/20 text-white/70 hover:bg-white/10" : "border-black/20 text-black/70 hover:bg-black/10"}`}
                    type="button"
                  >
                    Vaciar
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* ===== HERO: lava lamp ===== */}
      <section id="inicio" ref={heroRef as any} className="relative h-[200vh] z-0">
        <div className="sticky top-0 h-screen overflow-hidden z-40">
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: isDark
                ? "radial-gradient(closest-side, rgba(255,255,255,0.06), transparent 70%), radial-gradient(closest-side, rgba(255,255,255,0.05), transparent 70%)"
                : "radial-gradient(closest-side, rgba(0,0,0,0.06), transparent 70%), radial-gradient(closest-side, rgba(0,0,0,0.05), transparent 70%)",
              backgroundSize: "120px 120px, 240px 240px",
              backgroundPosition: "-20px -20px, 80px 60px",
            }}
          />
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-28 md:gap-36 pointer-events-none z-50"
            style={{ opacity: overlayOpacity, y: heroYOffset }}
          >
            <motion.div
              // Grupo de blobs con efecto lámpara de lava
              style={{
                x,
                y: yMix as any,
                scale,
                opacity: smokeOpacity,
                willChange: "transform",
              }}
              className="pointer-events-none"
              aria-hidden="true"
            >
              <div className="relative aspect-square w-[64vmin] max-w-[520px]">
                {lavaBlobs.map((blob) => (
                  <motion.span
                    key={blob.id}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: blob.size,
                      height: blob.size,
                      background: blob.background,
                      opacity: blob.opacity,
                      mixBlendMode: (lowPower ? "normal" : (isDark ? "screen" : "multiply")) as any,
                    }}
                    initial={blob.initial}
                    animate={blob.animate}
                    transition={{
                      duration: blob.duration,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatType: "mirror",
                    }}
                  />
                ))}
              </div>
            </motion.div>

            <motion.h1
              style={{ opacity: titleOpacity, scale: titleScale }}
              className="inline-flex items-baseline px-6 text-center text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight"
            >
              <span className="bg-gradient-to-br from-[#ff4fd8] via-[#c152ff] to-[#a200ff] bg-clip-text text-transparent">A</span><span className={isDark ? "text-white" : "text-black"}>cid</span><span className="bg-gradient-to-r from-[#ff8a00] via-[#ff9f3d] to-[#ffd166] bg-clip-text text-transparent">IA</span>
            </motion.h1>
          </motion.div>

          <motion.div
            className="absolute inset-x-0 bottom-10 text-center text-xs tracking-widest uppercase"
            style={{ opacity: useTransform(heroSmooth, [0, 0.3, 0.5], [1, 0.6, 0]) }}
          >
            <span className={`inline-block px-4 py-2 rounded-full ${isDark ? "bg-black/40 text-white" : "bg-white/40 text-black"}`}>
              Desliza para revelar
            </span>
          </motion.div>
        </div>
      </section>

      {/* ===== QUÉ HACEMOS ===== */}
      <Section id="quienes-somos" title="¿Qué es lo que hacemos?" className="pt-6 md:pt-8 pb-16">
        <p className={`text-lg leading-relaxed text-center max-w-3xl mx-auto ${isDark ? "text-white/80" : "text-black/80"}`}>
          Automatizamos tus procesos con herramientas de inteligencia artificial diseñadas a las necesidades reales de tu negocio. Combinamos analítica, ciencia de datos y machine learning para detectar oportunidades, anticipar demanda y entregar información accionable a cada equipo.
        </p>
        <div className="mt-12 grid md:grid-cols-3 gap-6 text-left">
          <ValueCard isDark={isDark} accent="#ff8a00" title="Automatización con propósito">Mapeamos la operación y la convertimos en experiencias conversacionales que capturan datos útiles sin perder el tono humano de tu marca.</ValueCard>
          <ValueCard isDark={isDark} accent="#a200ff" title="Analítica + ciencia de datos">Integramos tus fuentes, limpiamos la señal y construimos tableros que cuentan la historia completa de tu negocio en tiempo real.</ValueCard>
          <ValueCard isDark={isDark} title="Machine learning aplicado">Entrenamos modelos que aprenden de tu operación para segmentar, recomendar y detectar patrones antes de que se conviertan en problemas.</ValueCard>
        </div>
      </Section>

      <Section
        title={
          <>
            <span className="text-[#a200ff]">Servicio</span> al cliente{' '}
            <span className="text-[#ff8a00]">24/7</span>
          </>
        }
        className="pt-0 pb-16"
      >
        <div className={`mx-auto max-w-3xl text-center text-lg leading-relaxed ${isDark ? "text-white/80" : "text-black/80"}`}>
          <p>
            Nuestra IA nunca duerme, pero detrás siempre hay humanos listos para intervenir. Si una conversación necesita empatía o criterio, nuestro equipo toma el control sin tickets interminables ni respuestas enlatadas.
          </p>
          <p className="mt-6">
            Piensa en un concierge digital que detecta la intención, prepara a la persona correcta y mantiene informados a tus clientes. Eso es servicio al cliente 24/7, con calidad humana y velocidad de máquina.
          </p>
        </div>
      </Section>

      {/* ===== PLANES Y PRECIOS ===== */}
      <Section
        id="planes"
        title={
          <>
            Nuestros <span className="text-[#ff8a00]">planes</span> y{' '}
            <span className="text-[#04d9b5]">precios</span>
          </>
        }
      >
        <p className={`text-lg text-center max-w-3xl mx-auto ${isDark ? "text-white/80" : "text-black/80"}`}>
          Diseñamos paquetes modulares para activar <span className="text-[#04d9b5]">IA en tu operación</span> sin fricción.
          Elige el plan que necesitas hoy y escala con nosotros cuando estés listo.
        </p>

        {catalogLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#04d9b5]"></div>
            <p className="mt-4 text-sm text-white/60">Cargando planes...</p>
          </div>
        )}

        {catalogError && (
          <div className="text-center py-12">
            <p className="text-red-400">Error al cargar el catálogo: {catalogError}</p>
          </div>
        )}

        {!catalogLoading && !catalogError && planCards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/60">No hay planes disponibles</p>
          </div>
        )}

        {!catalogLoading && !catalogError && planCards.length > 0 && (
          <>
            <PlanCarousel
          plans={primaryPlans}
          isDark={isDark}
          onShowDetails={(p) => setActivePlan(p)}
          onScrollToContact={scrollToContact}
          onAddToCart={addToCart}
          label="Módulos y add-ons"
          showArrow
        />

        <PlanCarousel
          plans={webPlans}
          isDark={isDark}
          onShowDetails={(p) => setActivePlan(p)}
          onScrollToContact={scrollToContact}
          onAddToCart={addToCart}
          label="Paquetes web"
        />

        <p className={`mt-8 text-sm text-center ${isDark ? "text-white/60" : "text-black/60"}`}>
          * Precios en MXN. No incluyen IVA. Podemos combinar planes o armar uno a medida.
        </p>
          </>
        )}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Accordion
            isDark={isDark}
            title="Requisitos del cliente"
            content={
              <ul className="space-y-2">
                {CLIENT_REQUIREMENTS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#04d9b5]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            }
          />
          <Accordion
            isDark={isDark}
            title="Condiciones generales"
            content={
              <ul className="space-y-2">
                {GENERAL_CONDITIONS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#04d9b5]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            }
          />
        </div>
      </Section>

      {/* ===== CONTACTO ===== */}
      <Section id="contacto" title="Contacto">
        <p className={`text-lg mb-10 text-center ${isDark ? "text-white/80" : "text-black/80"}`}>
          Hablemos. Podemos mostrarte una demo, resolver dudas y armar un plan a tu medida. Déjanos tus datos y te escribimos en menos de 24 horas.
        </p>
        <ContactForm isDark={isDark} />
      </Section>

      <Footer isDark={isDark} />
    </div>
  );
}

function Footer({ isDark }: { isDark: boolean }) {
  const textColor = isDark ? "text-white/60" : "text-black/60";
  const linkBase = isDark ? "text-white/70 hover:text-white" : "text-black/70 hover:text-black";
  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (window.location.pathname === path) return;
    event.preventDefault();
    window.location.assign(path);
  };

  return (
    <footer
      className={`border-t ${isDark ? "border-white/10 bg-black" : "border-black/10 bg-white"}`}
    >
      <div className="mx-auto flex flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between max-w-6xl">
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="https://www.facebook.com/AcidIA"
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 ${linkBase}`}
          >
            <FacebookIcon className={isDark ? "text-white/70" : "text-black/70"} />
            <span>Facebook</span>
          </a>
          <a
            href="https://www.instagram.com/acid_ia?igsh=MW8wcG11YWEyN2tqaQ=="
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 ${linkBase}`}
          >
            <InstagramIcon className={isDark ? "text-white/70" : "text-black/70"} />
            <span>Instagram</span>
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <a
            href="/terms"
            className={linkBase}
            onClick={(event) => handleNavigate(event, "/terms")}
          >
            Términos y condiciones
          </a>
          <a
            href="/privacy"
            className={linkBase}
            onClick={(event) => handleNavigate(event, "/privacy")}
          >
            Aviso de privacidad
          </a>
          <a
            href="/data-deletion"
            className={linkBase}
            onClick={(event) => handleNavigate(event, "/data-deletion")}
          >
            Eliminación de datos
          </a>
        </div>
        <div className={`text-xs ${textColor}`}>
          <a
            href="https://openai.com"
            target="_blank"
            rel="noreferrer"
            className={linkBase}
          >
            Powered by OpenAI
          </a>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      width={18}
      height={18}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M22 12.07C22 6.49 17.52 2 11.93 2S1.86 6.49 1.86 12.07c0 4.89 3.58 8.95 8.26 9.87v-6.99H7.9v-2.88h2.22V9.79c0-2.2 1.31-3.42 3.32-3.42.96 0 1.96.17 1.96.17v2.17h-1.1c-1.08 0-1.42.67-1.42 1.36v1.63h2.42l-.39 2.88h-2.03v6.99c4.68-.92 8.26-4.99 8.26-9.87Z"
      />
    </svg>
  );
}

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      width={18}
      height={18}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

function Accordion({
  title,
  content,
  isDark,
}: {
  title: string;
  content: ReactNode;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-3xl border transition ${
        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4"
      >
        <span className="text-lg font-semibold bg-gradient-to-r from-[#ff4fd8] via-[#04d9b5] to-[#ff8a00] bg-clip-text text-transparent">
          {title}
        </span>
        <span className="text-[#04d9b5] text-xl">{open ? "−" : "+"}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden px-6"
      >
        <div className={`pb-5 text-sm leading-relaxed ${isDark ? "text-white/70" : "text-black/70"}`}>
          {content}
        </div>
      </motion.div>
    </div>
  );
}

function ContactForm({ isDark }: { isDark: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const endpoint = (import.meta as any).env?.VITE_CONTACT_ENDPOINT as string | undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await sendContact({ name, email, message });
    if (res.ok) {
      setStatus("ok");
      setName("");
      setEmail("");
      setMessage("");
    } else {
      setStatus("error");
      setError(res.error || "No se pudo enviar. Intenta de nuevo.");
    }
  }

  return (
    <div>
      {!endpoint && (
        <div className={`mb-4 text-sm ${isDark ? "text-white/60" : "text-black/60"}`}>
          Configura VITE_CONTACT_ENDPOINT para activar el envío por correo.
        </div>
      )}
      <form onSubmit={onSubmit} className="grid gap-4 max-w-xl mx-auto text-left">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className={`px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#04d9b5] ${isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu correo"
          className={`px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#04d9b5] ${isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}
        />
        <textarea
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Cuéntanos de tu proyecto"
          className={`px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#04d9b5] ${isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className={`rounded-xl bg-[#04d9b5] text-black px-6 py-3 font-medium shadow hover:brightness-110 transition ${status === "sending" ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {status === "sending" ? "Enviando…" : status === "ok" ? "Enviado" : "Enviar"}
        </button>
        {status === "ok" && (
          <div className="text-sm text-[#04d9b5]">Gracias. Te contactaremos muy pronto.</div>
        )}
        {status === "error" && (
          <div className="text-sm text-red-400">{error}</div>
        )}
      </form>
    </div>
  );
}
