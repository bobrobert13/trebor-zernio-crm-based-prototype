/**
 * @file constants.js — Datos maestros del MVP: nichos de negocio (data-driven),
 * matriz RBAC, roadmap engine, modalidades WhatsApp, paletas de marca e iconos.
 * Se expone como window.ZernioCrm para el resto de scripts clásicos.
 */
(function () {
  'use strict';

  /** Marca del producto. */
  const BRAND = 'Trebor CRM';

  /** Número WhatsApp de demostración (prefijo Venezuela). */
  const DEMO_PHONE = '+58 412 000 0000';

  /** Paletas de branding seleccionables en el onboarding. */
  const ACCENTS = [
    { id: 'carbono', nombre: 'Carbono', value: '#18181b', soft: '#f4f4f5' },
    { id: 'verde', nombre: 'Verde oliva', value: '#365314', soft: '#f7fee7' },
    { id: 'vino', nombre: 'Vino', value: '#7f1d1d', soft: '#fef2f2' },
    { id: 'azul', nombre: 'Azul noche', value: '#1e40af', soft: '#eff6ff' },
    { id: 'ocre', nombre: 'Ocre', value: '#b45309', soft: '#fffbeb' },
    { id: 'petroleo', nombre: 'Petróleo', value: '#134e4a', soft: '#f0fdfa' },
  ];

  /** Fuentes de referencia: "¿Quién nos recomendó?". */
  const REFERRERS = [
    { id: 'google', nombre: 'Google', icon: 'globe' },
    { id: 'instagram', nombre: 'Instagram', icon: 'star' },
    { id: 'facebook', nombre: 'Facebook', icon: 'users' },
    { id: 'tiktok', nombre: 'TikTok', icon: 'zap' },
    { id: 'referido', nombre: 'Me recomendó un conocido', icon: 'user' },
    { id: 'otro', nombre: 'Otro', icon: 'edit' },
  ];

  /** Focos de trabajo posibles (determinan qué módulos pesan más en la UI). */
  const FOCUS_MODES = [
    { id: 'atencion', nombre: 'Atención al cliente', desc: 'Soporte, consultas y seguimiento de casos.', icon: 'message' },
    { id: 'atencion+ventas', nombre: 'Atención + ventas', desc: 'Soporte con cierre de ventas y cotizaciones.', icon: 'zap' },
    { id: 'ventas', nombre: 'Ventas + campañas', desc: 'Preventa, campañas y mensajes masivos.', icon: 'megaphone' },
  ];

  /** Tipos de contenido del plan del nicho (panel "Lo que incluye tu plan"). */
  const ROADMAP_TYPES = {
    channel: { label: 'Canal', icon: 'link' },
    templates: { label: 'Plantillas', icon: 'message' },
    fields: { label: 'Campos', icon: 'tag' },
    roles: { label: 'Equipo', icon: 'users' },
    automations: { label: 'Automatizaciones', icon: 'zap' },
  };

  /**
   * Herramientas del módulo Campañas: para qué sirven, cuándo usarlas y si
   * requieren aprobación externa (Meta). Alimenta el pipeline educativo.
   */
  const CAMPAIGN_TOOLS = [
    {
      id: 'plantillas', nombre: 'Plantillas de mensaje', icon: 'message', disponible: true, aprobacion: true,
      para: 'Mensajes pre-aprobados por WhatsApp para abrir conversaciones, confirmar pedidos o re-enganchar clientes fuera de la ventana de 24 h.',
      cuando: ['Primer mensaje a un cliente nuevo', 'Conversación con más de 24 h sin respuesta', 'Confirmaciones y recordatorios automáticos'],
    },
    {
      id: 'broadcasts', nombre: 'Broadcasts (campañas masivas)', icon: 'megaphone', disponible: true, aprobacion: false,
      para: 'Envía una plantilla aprobada a muchos contactos suscritos a la vez, con métricas de entrega por destinatario.',
      cuando: ['Promociones y novedades', 'Avisos masivos (cambio de horario, cierre)', 'Campañas estacionales'],
    },
    {
      id: 'secuencias', nombre: 'Secuencias (drip)', icon: 'zap', disponible: true, aprobacion: false,
      para: 'Cadenas de mensajes automáticos en el tiempo: cada paso usa una plantilla aprobada y se detiene si el cliente responde.',
      cuando: ['Seguimiento de cotizaciones', 'Onboarding de clientes nuevos', 'Recordatorios escalonados de pago'],
    },
    {
      id: 'flows', nombre: 'Flows (formularios)', icon: 'edit', disponible: true, aprobacion: false,
      para: 'Formularios nativos dentro del chat de WhatsApp para capturar leads, agendar citas o hacer encuestas sin salir de la conversación.',
      cuando: ['Captura de leads (nombre, teléfono, interés)', 'Agendar citas', 'Encuestas de satisfacción'],
    },
  ];

  /**
   * Guía de métricas de Analítica: qué miden, cómo se calculan y cuándo mirarlas.
   */
  const ANALYTICS_GUIDE = [
    {
      id: 'interacciones', nombre: 'Interacciones', icon: 'activity',
      color: 'border-emerald-700 text-emerald-800',
      que: 'Cada contacto del público con tus publicaciones o mensajes: reacciones, comentarios y compartidos.',
      como: 'Se acumulan por día y por franja horaria desde la plataforma.',
      cuando: 'Semana a semana: detecta qué contenido conecta con tu audiencia y replica lo que funciona.',
    },
    {
      id: 'horarios', nombre: 'Mejores horarios', icon: 'clock',
      color: 'border-amber-700 text-amber-900',
      que: 'Franjas del día con más actividad de tus clientes.',
      como: 'Heatmap de interacciones por hora y día de la semana (más oscuro = más actividad).',
      cuando: 'Antes de enviar campañas o plantillas: programa en las franjas calientes para más respuesta.',
    },
    {
      id: 'seguidores', nombre: 'Crecimiento de comunidad', icon: 'users',
      color: 'border-sky-700 text-sky-800',
      que: 'Evolución de tus seguidores y contactos en el tiempo.',
      como: 'Diferencia entre el inicio y el fin del periodo seleccionado.',
      cuando: 'Evalúa campañas de crecimiento, temporadas y el impacto de tus publicaciones.',
    },
    {
      id: 'respuesta', nombre: 'Tiempo de respuesta', icon: 'zap',
      color: 'border-red-700 text-red-800',
      que: 'Rapidez con la que tu equipo responde en la bandeja.',
      como: 'Promedio de minutos entre el mensaje del cliente y tu primera respuesta.',
      cuando: 'Siempre: una respuesta ágil es la primera impresión de tu negocio.',
    },
  ];

  /**
   * Nichos de negocio. Cada nicho define campos personalizados, KPIs,
   * tags de conversación y un plan de contenido (plantillas demo y
   * herramientas que incluye el espacio).
   */
  const NICHES = [
    {
      id: 'restaurante', nombre: 'Restaurante', emoji: '🍽️',
      descripcion: 'Pedidos, reservas y atención al comensal por WhatsApp.',
      focusDefault: 'atencion+ventas',
      tags: ['pedido', 'reserva', 'reclamo', 'vip'],
      customFields: [
        { slug: 'tipo_pedido', name: 'Tipo de pedido', type: 'select', options: ['Local', 'Para llevar', 'Delivery'] },
        { slug: 'mesa', name: 'Mesa', type: 'text' },
        { slug: 'preferencias', name: 'Preferencias', type: 'text' },
      ],
      kpis: [
        { id: 'pedidos_hoy', label: 'Pedidos hoy', unit: '', icon: 'message' },
        { id: 'reservas', label: 'Reservas activas', unit: '', icon: 'clock' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
        { id: 'satisfaccion', label: 'Satisfacción', unit: '%', icon: 'star' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'wa_profile', title: 'Perfil comercial', desc: 'Nombre, descripción y horario de atención visibles en WhatsApp.', type: 'channel', optional: false, estimated: '~5 min' },
        { id: 'tpl_pedido', title: 'Plantilla de confirmación', desc: 'Confirma pedidos con número de orden y tiempo estimado.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_encuesta', title: 'Encuesta post-servicio', desc: 'Calificación rápida después de cada visita.', type: 'templates', optional: true, estimated: '~15 min' },
        { id: 'fields_menu', title: 'Campos de cliente', desc: 'Tipo de pedido, mesa y preferencias.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Agentes de atención y caja con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_respuestas', title: 'Respuestas rápidas', desc: 'Mensajes predefinidos para las consultas más frecuentes.', type: 'automations', optional: true, estimated: '~15 min' },
      ],
    },
    {
      id: 'repuestos', nombre: 'Repuestos automotrices', emoji: '🔧',
      descripcion: 'Consulta de stock, cotizaciones y pedidos de repuestos.',
      focusDefault: 'atencion+ventas',
      tags: ['stock', 'cotizacion', 'pedido', 'vip'],
      customFields: [
        { slug: 'vehiculo', name: 'Vehículo / marca', type: 'text' },
        { slug: 'anio', name: 'Año', type: 'number' },
        { slug: 'estado_pedido', name: 'Estado del pedido', type: 'select', options: ['Cotizando', 'Confirmado', 'En tránsito', 'Entregado'] },
      ],
      kpis: [
        { id: 'cotizaciones', label: 'Cotizaciones abiertas', unit: '', icon: 'edit' },
        { id: 'pedidos', label: 'Pedidos activos', unit: '', icon: 'message' },
        { id: 'stock', label: 'Consultas de stock', unit: '', icon: 'search' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_cotizacion', title: 'Plantilla de cotización', desc: 'Envía presupuestos con datos del repuesto y precio.', type: 'templates', optional: false, estimated: '~20 min' },
        { id: 'tpl_pedido', title: 'Seguimiento de pedidos', desc: 'Avisa cuando el repuesto llega o cambia de estado.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'fields_vehiculo', title: 'Campos de cliente', desc: 'Vehículo, año y estado del pedido.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Vendedores y despacho con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_stock', title: 'Respuesta de stock', desc: 'Respuesta automática con disponibilidad cuando no hay agente.', type: 'automations', optional: true, estimated: '~20 min' },
      ],
    },
    {
      id: 'farmacia', nombre: 'Farmacia', emoji: '💊',
      descripcion: 'Pedidos de medicamentos, recordatorios y entrega a domicilio.',
      focusDefault: 'atencion',
      tags: ['pedido', 'receta', 'entrega', 'reclamo'],
      customFields: [
        { slug: 'receta', name: 'Requiere receta', type: 'select', options: ['Sí', 'No'] },
        { slug: 'entrega', name: 'Tipo de entrega', type: 'select', options: ['En mostrador', 'Delivery'] },
        { slug: 'zona', name: 'Zona / sector', type: 'text' },
      ],
      kpis: [
        { id: 'pedidos_hoy', label: 'Pedidos hoy', unit: '', icon: 'message' },
        { id: 'deliveries', label: 'Entregas pendientes', unit: '', icon: 'send' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
        { id: 'recordatorios', label: 'Recordatorios activos', unit: '', icon: 'clock' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_pedido', title: 'Plantilla de pedido', desc: 'Confirma medicamentos, precio y hora de entrega.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_recordatorio', title: 'Recordatorio de medicación', desc: 'Avisos programados para tratamientos recurrentes.', type: 'templates', optional: true, estimated: '~20 min' },
        { id: 'fields_receta', title: 'Campos de cliente', desc: 'Receta, entrega y zona.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Farmacéuticos y repartidores con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_urgencias', title: 'Atención de urgencias', desc: 'Prioriza mensajes con palabras clave (fiebre, presión, etc.).', type: 'automations', optional: true, estimated: '~20 min' },
      ],
    },
    {
      id: 'fibra', nombre: 'Internet fibra óptica', emoji: '🌐',
      descripcion: 'Cotización, instalación y soporte técnico de conexiones.',
      focusDefault: 'atencion',
      tags: ['cotizacion', 'instalacion', 'falla', 'facturacion'],
      customFields: [
        { slug: 'plan', name: 'Plan', type: 'select', options: ['10 Mbps', '25 Mbps', '50 Mbps', '100 Mbps', '200 Mbps'] },
        { slug: 'sector', name: 'Sector', type: 'text' },
        { slug: 'estado_instalacion', name: 'Estado de instalación', type: 'select', options: ['Cotizando', 'Agendada', 'Instalado', 'Rechazada'] },
      ],
      kpis: [
        { id: 'instalaciones', label: 'Instalaciones agendadas', unit: '', icon: 'link' },
        { id: 'fallas', label: 'Fallas reportadas', unit: '', icon: 'alert' },
        { id: 'clientes', label: 'Clientes activos', unit: '', icon: 'users' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_cotizacion', title: 'Plantilla de cotización', desc: 'Planes, cobertura y precios en un mensaje aprobado.', type: 'templates', optional: false, estimated: '~20 min' },
        { id: 'tpl_instalacion', title: 'Confirmación de instalación', desc: 'Agenda, técnico asignado y recordatorio del día.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'fields_plan', title: 'Campos de cliente', desc: 'Plan, sector y estado de instalación.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Soporte técnico y ventas con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_fallas', title: 'Reporte de fallas', desc: 'Clasifica y escala reportes de interrupción de servicio.', type: 'automations', optional: true, estimated: '~20 min' },
      ],
    },
    {
      id: 'optica', nombre: 'Óptica oftalmológica', emoji: '👓',
      descripcion: 'Citas, exámenes visuales y seguimiento de lentes.',
      focusDefault: 'atencion+ventas',
      tags: ['cita', 'examen', 'lentes', 'garantia'],
      customFields: [
        { slug: 'tipo_lente', name: 'Tipo de lente', type: 'select', options: ['Monofocal', 'Bifocal', 'Progresivo', 'Anti-reflejo'] },
        { slug: 'graduacion', name: 'Graduación', type: 'text' },
        { slug: 'fecha_examen', name: 'Próximo examen', type: 'date' },
      ],
      kpis: [
        { id: 'citas', label: 'Citas agendadas', unit: '', icon: 'clock' },
        { id: 'lentes', label: 'Lentes en pedido', unit: '', icon: 'edit' },
        { id: 'clientes', label: 'Clientes atendidos', unit: '', icon: 'users' },
        { id: 'satisfaccion', label: 'Satisfacción', unit: '%', icon: 'star' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_cita', title: 'Plantilla de citas', desc: 'Confirmación y recordatorio de exámenes visuales.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_lentes', title: 'Seguimiento de lentes', desc: 'Avisa cuando el pedido de lentes está listo.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'fields_paciente', title: 'Campos de paciente', desc: 'Lente, graduación y fecha de próximo examen.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Optometristas y asesores con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_recordatorio', title: 'Recordatorio de examen', desc: 'Avisa cuando el paciente debe repetir su examen.', type: 'automations', optional: true, estimated: '~15 min' },
      ],
    },
    {
      id: 'celulares', nombre: 'Celulares y accesorios', emoji: '📱',
      descripcion: 'Preventa, cotización y garantía de equipos y accesorios.',
      focusDefault: 'ventas',
      tags: ['cotizacion', 'preventa', 'garantia', 'vip'],
      customFields: [
        { slug: 'equipo', name: 'Equipo / modelo', type: 'text' },
        { slug: 'condicion', name: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Reacondicionado'] },
        { slug: 'garantia', name: 'Garantía (meses)', type: 'number' },
      ],
      kpis: [
        { id: 'cotizaciones', label: 'Cotizaciones abiertas', unit: '', icon: 'edit' },
        { id: 'preventas', label: 'Preventas activas', unit: '', icon: 'zap' },
        { id: 'garantias', label: 'Garantías vigentes', unit: '', icon: 'shield' },
        { id: 'ventas', label: 'Ventas del mes', unit: '', icon: 'credit-card' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_cotizacion', title: 'Plantilla de cotización', desc: 'Equipo, precio, forma de pago y disponibilidad.', type: 'templates', optional: false, estimated: '~20 min' },
        { id: 'tpl_preventa', title: 'Preventa de lanzamientos', desc: 'Anuncia llegadas y aparta equipos por adelantado.', type: 'templates', optional: true, estimated: '~15 min' },
        { id: 'fields_equipo', title: 'Campos de cliente', desc: 'Equipo, condición y garantía.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Vendedores y técnicos con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'broadcast_ofertas', title: 'Campaña de ofertas', desc: 'Broadcast semanal de promociones a clientes activos.', type: 'automations', optional: true, estimated: '~20 min' },
      ],
    },
    {
      id: 'vendedor', nombre: 'Vendedor virtual', emoji: '🛍️',
      descripcion: 'E-commerce por catálogo: preventa, pedidos y postventa.',
      focusDefault: 'ventas',
      tags: ['preventa', 'pedido', 'pago', 'entrega'],
      customFields: [
        { slug: 'pedido', name: 'N° de pedido', type: 'text' },
        { slug: 'carrier', name: 'Delivery', type: 'select', options: ['Zoom', 'Yummy', 'Propio', 'MRW', 'Otro'] },
        { slug: 'tracking', name: 'Tracking', type: 'text' },
      ],
      kpis: [
        { id: 'pedidos', label: 'Pedidos activos', unit: '', icon: 'message' },
        { id: 'preventas', label: 'Preventas abiertas', unit: '', icon: 'zap' },
        { id: 'entregas', label: 'Entregas del día', unit: '', icon: 'send' },
        { id: 'ventas', label: 'Ventas del mes', unit: '', icon: 'credit-card' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'tpl_pedido', title: 'Plantilla de confirmación', desc: 'Número de pedido, total y tiempo de entrega.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_pago', title: 'Recordatorio de pago', desc: 'Solicita el comprobante de pago de forma amable.', type: 'templates', optional: true, estimated: '~15 min' },
        { id: 'fields_pedido', title: 'Campos de cliente', desc: 'Pedido, delivery y tracking.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Vendedores y despacho con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'broadcast_catalogo', title: 'Catálogo por campaña', desc: 'Envía tu catálogo nuevo a toda tu base.', type: 'automations', optional: true, estimated: '~20 min' },
      ],
    },
    {
      id: 'belleza', nombre: 'Salón de belleza', emoji: '💇‍♀️',
      descripcion: 'Citas, recordatorios y venta de servicios y productos de estética.',
      focusDefault: 'atencion+ventas',
      tags: ['cita', 'reserva', 'reclamo', 'vip'],
      customFields: [
        { slug: 'servicios', name: 'Servicios de interés', type: 'select', options: ['Corte', 'Color', 'Manicure', 'Pedicure', 'Tratamientos', 'Peinado'] },
        { slug: 'estilista', name: 'Estilista preferido', type: 'text' },
        { slug: 'frecuencia', name: 'Frecuencia de visita', type: 'select', options: ['Semanal', 'Quincenal', 'Mensual', 'Ocasional'] },
        { slug: 'aniversario', name: 'Aniversario (fecha)', type: 'date' },
      ],
      kpis: [
        { id: 'citas_hoy', label: 'Citas de hoy', unit: '', icon: 'clock' },
        { id: 'reservas', label: 'Reservas activas', unit: '', icon: 'message' },
        { id: 'clientes', label: 'Clientes activos', unit: '', icon: 'users' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Meta (guiado).', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'wa_profile', title: 'Perfil comercial', desc: 'Nombre, descripción y horario de atención.', type: 'channel', optional: false, estimated: '~5 min' },
        { id: 'tpl_cita', title: 'Plantilla de confirmación de cita', desc: 'Confirma citas con fecha, hora y servicios.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_recordatorio', title: 'Recordatorio de cita', desc: 'Aviso automático 24 h antes de la visita.', type: 'templates', optional: true, estimated: '~15 min' },
        { id: 'fields_cliente', title: 'Campos de cliente', desc: 'Servicios, estilista preferido y frecuencia.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Recepcionistas y estilistas con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'auto_respuestas', title: 'Respuestas rápidas', desc: 'Mensajes predefinidos para precios y horarios.', type: 'automations', optional: true, estimated: '~15 min' },
        { id: 'catalogo', title: 'Catálogo de servicios', desc: 'Lista de servicios y precios para responder al instante.', type: 'templates', optional: true, estimated: '~10 min' },
      ],
    },
    {
      id: 'tienda', nombre: 'Tienda de ropa', emoji: '👗',
      descripcion: 'Ventas por catálogo, tallas, pedidos y seguimiento de clientes.',
      focusDefault: 'ventas',
      tags: ['pedido', 'talla', 'reclamo', 'vip'],
      customFields: [
        { slug: 'talla', name: 'Talla', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
        { slug: 'estilo', name: 'Preferencias de estilo', type: 'text' },
        { slug: 'frecuencia', name: 'Frecuencia de compra', type: 'select', options: ['Semanal', 'Mensual', 'Temporada', 'Ocasional'] },
        { slug: 'tallas_interes', name: 'Tallas de interés (niños)', type: 'text' },
      ],
      kpis: [
        { id: 'pedidos_hoy', label: 'Pedidos hoy', unit: '', icon: 'message' },
        { id: 'cotizaciones', label: 'Consultas de tallas', unit: '', icon: 'search' },
        { id: 'clientes', label: 'Clientes activos', unit: '', icon: 'users' },
        { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
      ],
      roadmap: [
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Meta (guiado).', type: 'channel', optional: false, estimated: '~10 min' },
        { id: 'wa_profile', title: 'Perfil comercial', desc: 'Nombre, descripción y horario de atención.', type: 'channel', optional: false, estimated: '~5 min' },
        { id: 'tpl_pedido', title: 'Plantilla de confirmación de pedido', desc: 'Confirma pedidos con talla, color y envío.', type: 'templates', optional: false, estimated: '~15 min' },
        { id: 'tpl_novedades', title: 'Campaña de novedades', desc: 'Avisa sobre nueva colección y stock.', type: 'templates', optional: true, estimated: '~15 min' },
        { id: 'fields_cliente', title: 'Campos de cliente', desc: 'Talla, estilo y frecuencia de compra.', type: 'fields', optional: false, estimated: '~5 min' },
        { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Vendedores y despacho con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
        { id: 'catalogo', title: 'Catálogo de productos', desc: 'Fotos y precios para responder consultas al instante.', type: 'templates', optional: true, estimated: '~10 min' },
        { id: 'auto_respuestas', title: 'Respuestas rápidas', desc: 'Guía de tallas y políticas de cambio predefinidas.', type: 'automations', optional: true, estimated: '~15 min' },
      ],
    },
  ];

  /** Nicho genérico para negocios fuera de los templates. */
  const GENERIC_NICHE = {
    id: 'personalizado', nombre: 'Otro / Personalizado', emoji: '✨',
    descripcion: 'Configuración genérica adaptable a cualquier negocio.',
    focusDefault: 'atencion+ventas',
    tags: ['cliente', 'seguimiento'],
    customFields: [
      { slug: 'nota', name: 'Nota', type: 'text' },
      { slug: 'interes', name: 'Nivel de interés', type: 'select', options: ['Bajo', 'Medio', 'Alto'] },
    ],
    kpis: [
      { id: 'conversaciones', label: 'Conversaciones activas', unit: '', icon: 'message' },
      { id: 'contactos', label: 'Contactos', unit: '', icon: 'users' },
      { id: 't_respuesta', label: 'Respuesta promedio', unit: 'min', icon: 'zap' },
      { id: 'pendientes', label: 'Seguimientos pendientes', unit: '', icon: 'clock' },
    ],
    roadmap: [
      { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula el número de WhatsApp del negocio.', type: 'channel', optional: false, estimated: '~10 min' },
      { id: 'wa_profile', title: 'Perfil comercial', desc: 'Nombre, descripción y horario de atención.', type: 'channel', optional: false, estimated: '~5 min' },
      { id: 'fields_base', title: 'Campos base', desc: 'Nota y nivel de interés de cada cliente.', type: 'fields', optional: false, estimated: '~5 min' },
      { id: 'roles_equipo', title: 'Roles del equipo', desc: 'Agentes y vendedores con permisos propios.', type: 'roles', optional: false, estimated: '~10 min' },
      { id: 'tpl_generica', title: 'Plantilla de bienvenida', desc: 'Mensaje de bienvenida aprobado por Meta.', type: 'templates', optional: true, estimated: '~15 min' },
      { id: 'auto_respuestas', title: 'Respuestas rápidas', desc: 'Mensajes predefinidos para consultas frecuentes.', type: 'automations', optional: true, estimated: '~15 min' },
    ],
  };

  /**
   * Matriz RBAC básica por módulo. Niveles: null (sin acceso),
   * 'view' (lectura) o 'edit' (lectura + acciones).
   */
  const ROLES = {
    owner: { label: 'Propietario', desc: 'Control total del espacio de trabajo.', icon: 'shield' },
    admin: { label: 'Administrador', desc: 'Gestiona equipo y configuración (sin eliminar).', icon: 'settings' },
    agente: { label: 'Agente de soporte', desc: 'Solo atención: inbox y contactos.', icon: 'message' },
    vendedor: { label: 'Vendedor', desc: 'Atención, contactos y campañas.', icon: 'zap' },
  };

  const MODULES = [
    { id: 'dashboard', label: 'Resumen', icon: 'home' },
    { id: 'analytics', label: 'Analítica', icon: 'chart' },
    { id: 'inbox', label: 'Bandeja', icon: 'message' },
    { id: 'leads', label: 'Leads', icon: 'tag' },
    { id: 'products', label: 'Productos', icon: 'box' },
    { id: 'contacts', label: 'Contactos', icon: 'users' },
    { id: 'channels', label: 'Canales', icon: 'layers' },
    { id: 'broadcasts', label: 'Campañas', icon: 'megaphone' },
    { id: 'billing', label: 'Billing', icon: 'credit-card' },
    { id: 'system', label: 'Estados', icon: 'activity' },
    { id: 'team', label: 'Equipo', icon: 'user' },
    { id: 'settings', label: 'Configuración', icon: 'settings' },
  ];

  const PERMISSIONS = {
    owner: { dashboard: 'edit', analytics: 'edit', inbox: 'edit', contacts: 'edit', channels: 'edit', leads: 'edit', products: 'edit', broadcasts: 'edit', billing: 'edit', system: 'edit', team: 'edit', settings: 'edit' },
    admin: { dashboard: 'edit', analytics: 'edit', inbox: 'edit', contacts: 'edit', channels: 'edit', leads: 'edit', products: 'edit', broadcasts: 'edit', billing: 'view', system: 'view', team: 'edit', settings: 'view' },
    agente: { dashboard: 'view', analytics: 'view', inbox: 'edit', contacts: 'edit', channels: null, leads: 'view', products: 'view', broadcasts: null, billing: null, system: null, team: null, settings: null },
    vendedor: { dashboard: 'view', analytics: 'view', inbox: 'edit', contacts: 'edit', channels: null, leads: 'view', products: 'view', broadcasts: 'edit', billing: null, system: null, team: null, settings: null },
  };

  /**
   * Plataformas soportadas por el módulo de canales.
   * inbox: true solo si Zernio expone la mensajería (DM) para esa plataforma.
   */
  /**
   * Capacidades por plataforma según la doc de Zernio (openapi + reglas del
   * skill). scope: 'plan' = disponible en el MVP · 'api' = Zernio lo soporta
   * (fuera del MVP por ahora) · ok=false = no soportado.
   */
  const PLATFORMS = [
    {
      id: 'whatsapp', nombre: 'WhatsApp', icon: 'whatsapp', inbox: true, tone: 'bg-emerald-100 text-emerald-800',
      caps: [
        { cap: 'Mensajería unificada (inbox)', ok: true, scope: 'plan' },
        { cap: 'Plantillas aprobadas Meta + ventana 24 h', ok: true, scope: 'plan' },
        { cap: 'Flows e interactivos', ok: true, scope: 'api' },
        { cap: 'Perfil de negocio', ok: true, scope: 'api' },
        { cap: 'Grupos de WhatsApp', ok: true, scope: 'api' },
        { cap: '1 número por negocio', ok: true, scope: 'plan' },
        { cap: 'Comentarios / feed social', ok: false },
        { cap: 'Anuncios (ads)', ok: false },
      ],
    },
    {
      id: 'instagram', nombre: 'Instagram', icon: 'instagram', inbox: true, tone: 'bg-pink-100 text-pink-700',
      caps: [
        { cap: 'Mensajería directa (DM)', ok: true, scope: 'plan' },
        { cap: 'Comentarios y reseñas', ok: true, scope: 'api' },
        { cap: 'Ice breakers de IG', ok: true, scope: 'api' },
        { cap: 'Publicaciones Feed/Stories/Reels/Carrusel', ok: true, scope: 'api', nota: 'Publicación disponible para ampliar tu plan' },
        { cap: 'Respuesta fuera de ventana (HUMAN_AGENT)', ok: true, scope: 'plan' },
        { cap: 'Anuncios Meta', ok: true, scope: 'api', nota: 'Ampliable a tu plan' },
        { cap: 'Analítica de plataforma', ok: true, scope: 'api' },
      ],
    },
    {
      id: 'tiktok', nombre: 'TikTok', icon: 'tiktok', inbox: false, tone: 'bg-neutral-100 text-neutral-900',
      nota: 'Sin bandeja de mensajes: esta red no ofrece mensajería directa.',
      caps: [
        { cap: 'Publicación de videos', ok: true, scope: 'api', nota: 'Ampliable a tu plan' },
        { cap: 'Creator info (privacidad/duraciones)', ok: true, scope: 'api' },
        { cap: 'Analítica de plataforma', ok: true, scope: 'api' },
        { cap: 'Anuncios TikTok', ok: true, scope: 'api', nota: 'Ampliable a tu plan' },
        { cap: 'Bandeja / mensajería directa', ok: false, nota: 'La red no ofrece mensajería directa' },
        { cap: 'Comentarios', ok: false },
      ],
    },
  ];

 /** @param {string} id — id de plataforma. @returns {object|undefined} */
  function getPlatform(id) {
    return PLATFORMS.find((p) => p.id === id);
  }

  // ── Productos y servicios: fichas técnicas, catálogos e intención ────────

  /** Campos de la ficha técnica por nicho (presembran details del producto). */
  const NICHE_PRODUCT_FIELDS = {
    restaurante: ['Ingredientes', 'Alérgenos', 'Tiempo de preparación', 'Porciones', 'Disponible para delivery'],
    celulares: ['Marca', 'Modelo', 'RAM', 'Almacenamiento', 'Cámara', 'Batería', 'Garantía', 'Colores'],
  };

  /** Palabras de intención por nicho (la primera coincidencia gana; fallback 'consulta'). */
  const NICHE_INTENTS = {
    restaurante: {
      pedido: ['pedido', 'delivery', 'domicilio', 'llevar', 'orden', 'encargar'],
      reserva: ['reserva', 'mesa', 'reservar'],
      disponibilidad: ['tienen', 'disponible', 'hay', 'tienen?', 'queda'],
    },
    celulares: {
      disponibilidad: ['disponibilidad', 'stock', 'hay', 'tienen', 'queda'],
      precio: ['precio', 'cuánto', 'cuanto', 'costo', 'valor', 'cuesta'],
      garantia: ['garantía', 'garantia', 'cambio', 'falla', 'defecto'],
    },
  };

  /** Etiquetas legibles de los intents detectados. */
  const INTENT_LABELS = {
    pedido: 'Pedido',
    reserva: 'Reserva',
    disponibilidad: 'Disponibilidad',
    precio: 'Precio',
    garantia: 'Garantía',
    consulta: 'Consulta',
  };

  /** Plantillas de tarjeta por defecto (por nicho) y saludo del envío. */
  const PRODUCT_CARD_DEFAULTS = {
    restaurante: {
      greeting: '¡Claro! Aquí tiene los detalles 👇',
      template: '*{{nombre}}*\n\n{{descripcion}}\n\n*Detalles*\n{{detalles}}\n\n—\n\n*Precio:* {{precio}} {{unidad}}\n*Disponibilidad:* {{stock}}',
    },
    celulares: {
      greeting: 'Claro, aquí tiene los detalles del equipo 👇',
      template: '*{{nombre}}*\n\n{{descripcion}}\n\n*Ficha técnica*\n{{detalles}}\n\n—\n\n*Precio:* {{precio}} {{unidad}}\n*Disponibilidad:* {{stock}}',
    },
    generic: {
      greeting: 'Claro, aquí tiene los detalles 👇',
      template: '*{{nombre}}*\n\n{{descripcion}}\n\n*Detalles*\n{{detalles}}\n\n—\n\n*Precio:* {{precio}} {{unidad}}\n*Disponibilidad:* {{stock}}',
    },
  };

  /**
   * Catálogo semilla por nicho (ficha técnica completa).
   * id determinista por posición (estable entre migraciones del mismo nicho).
   */
  const NICHE_CATALOGS = {
    restaurante: [
      { name: 'Arroz con pollo', type: 'producto', category: 'Platos principales', price: 8.5, unit: 'porción', aliases: ['arroz con pollo asado'], stock: true, description: 'Pollo guisado con arroz amarillo, ensalada y tajadas.', details: [{ label: 'Ingredientes', value: 'Pollo, arroz, verduras y especias' }, { label: 'Alérgenos', value: 'Contiene gluten' }, { label: 'Tiempo de preparación', value: '25 min' }, { label: 'Porciones', value: '1 persona' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Pabellón criollo', type: 'producto', category: 'Platos principales', price: 9, unit: 'plato', aliases: ['pabellon'], stock: true, description: 'Carne mechada, caraotas negras, arroz blanco y plátano maduro.', details: [{ label: 'Ingredientes', value: 'Carne, caraotas, arroz, plátano' }, { label: 'Alérgenos', value: 'Sin gluten' }, { label: 'Tiempo de preparación', value: '20 min' }, { label: 'Porciones', value: '1 persona' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Hamburguesa clásica', type: 'producto', category: 'Platos principales', price: 6.5, unit: 'unidad', aliases: ['hamburguesa', 'burger'], stock: true, description: 'Carne 100% res, queso, lechuga, tomate y salsa de la casa.', details: [{ label: 'Ingredientes', value: 'Carne, queso, pan artesanal, vegetales' }, { label: 'Alérgenos', value: 'Contiene gluten y lácteos' }, { label: 'Tiempo de preparación', value: '15 min' }, { label: 'Porciones', value: '1 unidad' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Pizza margarita', type: 'producto', category: 'Platos principales', price: 10, unit: 'mediana', aliases: ['pizza'], stock: true, description: 'Salsa de tomate, mozzarella y albahaca fresca.', details: [{ label: 'Ingredientes', value: 'Harina, tomate, mozzarella, albahaca' }, { label: 'Alérgenos', value: 'Contiene gluten y lácteos' }, { label: 'Tiempo de preparación', value: '20 min' }, { label: 'Porciones', value: '2 personas' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Cachapa con queso', type: 'producto', category: 'Platos principales', price: 5.5, unit: 'unidad', aliases: ['cachapa'], stock: true, description: 'Maíz dulce con queso de mano derretido.', details: [{ label: 'Ingredientes', value: 'Maíz, queso de mano' }, { label: 'Alérgenos', value: 'Contiene lácteos' }, { label: 'Tiempo de preparación', value: '10 min' }, { label: 'Porciones', value: '1 unidad' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Arepa reina pepiada', type: 'producto', category: 'Desayunos', price: 4, unit: 'unidad', aliases: ['arepa', 'reina pepiada'], stock: true, description: 'Arepa de maíz con pollo, aguacate y mayonesa.', details: [{ label: 'Ingredientes', value: 'Maíz, pollo, aguacate' }, { label: 'Alérgenos', value: 'Contiene huevo' }, { label: 'Tiempo de preparación', value: '8 min' }, { label: 'Porciones', value: '1 unidad' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Bebida natural', type: 'producto', category: 'Bebidas', price: 3, unit: 'vaso', aliases: ['jugo', 'bebida', 'fresco'], stock: true, description: 'Jugo natural de la fruta del día.', details: [{ label: 'Ingredientes', value: 'Fruta natural, agua, azúcar opcional' }, { label: 'Alérgenos', value: 'Ninguno' }, { label: 'Tiempo de preparación', value: '5 min' }, { label: 'Porciones', value: '1 vaso' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Refresco', type: 'producto', category: 'Bebidas', price: 2, unit: 'lata', aliases: ['refresco', 'cola', 'soda'], stock: true, description: 'Refresco frío en lata.', details: [{ label: 'Ingredientes', value: 'Agua carbonatada, sabor' }, { label: 'Alérgenos', value: 'Ninguno' }, { label: 'Tiempo de preparación', value: 'Inmediato' }, { label: 'Porciones', value: '1 lata' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Postre del día', type: 'producto', category: 'Postres', price: 3.5, unit: 'porción', aliases: ['postre', 'torta'], stock: false, description: 'Postre artesanal del día (pregunta disponibilidad).', details: [{ label: 'Ingredientes', value: 'Varía según el día' }, { label: 'Alérgenos', value: 'Puede contener gluten y huevo' }, { label: 'Tiempo de preparación', value: '5 min' }, { label: 'Porciones', value: '1 porción' }, { label: 'Disponible para delivery', value: 'Sí' }] },
      { name: 'Delivery express', type: 'servicio', category: 'Servicios', price: 2.5, unit: 'envío', aliases: ['delivery', 'domicilio', 'envio'], stock: true, description: 'Envío a domicilio en un radio de 5 km.', details: [{ label: 'Cobertura', value: '5 km a la redonda' }, { label: 'Tiempo estimado', value: '30-45 min' }, { label: 'Costo', value: 'Por zona' }] },
    ],
    celulares: [
      { name: 'iPhone 15', type: 'producto', category: 'Equipos', price: 899, unit: 'unidad', aliases: ['iphone 15', 'iphone'], stock: true, description: 'Smartphone Apple con pantalla OLED de 6.1", chip A16 y cámara de 48 MP.', details: [{ label: 'Marca', value: 'Apple' }, { label: 'Modelo', value: 'iPhone 15' }, { label: 'RAM', value: '6 GB' }, { label: 'Almacenamiento', value: '128 GB' }, { label: 'Cámara', value: '48 MP + 12 MP' }, { label: 'Batería', value: '3.349 mAh' }, { label: 'Garantía', value: '1 año' }, { label: 'Colores', value: 'Negro, Azul, Rosa' }] },
      { name: 'Samsung Galaxy S24', type: 'producto', category: 'Equipos', price: 799, unit: 'unidad', aliases: ['galaxy s24', 'samsung s24', 'galaxy'], stock: true, description: 'Smartphone Android con pantalla AMOLED 6.2", Exynos 2400 y cámara de 50 MP.', details: [{ label: 'Marca', value: 'Samsung' }, { label: 'Modelo', value: 'Galaxy S24' }, { label: 'RAM', value: '8 GB' }, { label: 'Almacenamiento', value: '256 GB' }, { label: 'Cámara', value: '50 MP + 12 MP + 10 MP' }, { label: 'Batería', value: '4.000 mAh' }, { label: 'Garantía', value: '1 año' }, { label: 'Colores', value: 'Negro, Violeta, Amarillo' }] },
      { name: 'Audífonos inalámbricos', type: 'producto', category: 'Accesorios', price: 35, unit: 'unidad', aliases: ['audifonos', 'audífonos', 'earbuds', 'airpods'], stock: false, description: 'Audífonos Bluetooth con estuche de carga y cancelación de ruido.', details: [{ label: 'Marca', value: 'Genérica premium' }, { label: 'Modelo', value: 'TWS Pro' }, { label: 'Batería', value: '6 h + estuche 24 h' }, { label: 'Garantía', value: '3 meses' }, { label: 'Colores', value: 'Blanco, Negro' }] },
      { name: 'Cargador rápido 25W', type: 'producto', category: 'Accesorios', price: 15, unit: 'unidad', aliases: ['cargador', 'carga rapida'], stock: true, description: 'Cargador USB-C de 25W con cable incluido.', details: [{ label: 'Potencia', value: '25 W' }, { label: 'Puerto', value: 'USB-C' }, { label: 'Garantía', value: '3 meses' }] },
      { name: 'Funda de silicona', type: 'producto', category: 'Accesorios', price: 8, unit: 'unidad', aliases: ['funda', 'case', 'protector'], stock: true, description: 'Funda de silicona suave compatible con la mayoría de equipos.', details: [{ label: 'Material', value: 'Silicona' }, { label: 'Compatibilidad', value: 'Universal 6.1-6.8"' }] },
      { name: 'Vidrio templado', type: 'producto', category: 'Accesorios', price: 5, unit: 'unidad', aliases: ['vidrio', 'protector de pantalla', 'polarizado'], stock: true, description: 'Protector de pantalla de vidrio templado 9H.', details: [{ label: 'Dureza', value: '9H' }, { label: 'Instalación', value: 'Incluida' }] },
      { name: 'Reparación de pantalla', type: 'servicio', category: 'Servicios', price: 60, unit: 'servicio', aliases: ['reparacion', 'cambio de pantalla', 'pantalla rota'], stock: true, description: 'Reemplazo de pantalla en 24-48 h con garantía de 3 meses.', details: [{ label: 'Tiempo', value: '24-48 h' }, { label: 'Garantía', value: '3 meses' }, { label: 'Incluye', value: 'Mano de obra y repuesto' }] },
      { name: 'Plan de datos 10GB', type: 'servicio', category: 'Servicios', price: 12, unit: 'mensual', aliases: ['plan de datos', 'plan', 'datos'], stock: true, description: 'Plan de datos móvil de 10 GB mensuales.', details: [{ label: 'Datos', value: '10 GB' }, { label: 'Vigencia', value: '30 días' }, { label: 'Incluye', value: 'Redes sociales ilimitadas' }] },
      { name: 'Liberación de equipo', type: 'servicio', category: 'Servicios', price: 20, unit: 'servicio', aliases: ['liberacion', 'desbloqueo', 'simlock'], stock: true, description: 'Liberación de equipos para cualquier operadora.', details: [{ label: 'Tiempo', value: '24 h' }, { label: 'Garantía', value: 'Definitiva' }] },
      { name: 'Power bank 20.000 mAh', type: 'producto', category: 'Accesorios', price: 25, unit: 'unidad', aliases: ['power bank', 'bateria externa', 'cargador portatil'], stock: true, description: 'Batería externa de 20.000 mAh con doble puerto USB.', details: [{ label: 'Capacidad', value: '20.000 mAh' }, { label: 'Puertos', value: '2 USB + USB-C' }, { label: 'Garantía', value: '6 meses' }] },
    ],
    generic: [],
  };

  /** @param {string} nicheId — id del nicho. @returns {Array<object>} Catálogo semilla (ids deterministas). */
  function getNicheCatalog(nicheId) {
    return (NICHE_CATALOGS[nicheId] || NICHE_CATALOGS.generic || []).map((p, i) => ({
      ...p,
      id: `prd_${nicheId}_${i + 1}`,
      active: true,
      createdAt: Date.now(),
    }));
  }

  /** @param {string} nicheId — id del nicho. @returns {Array<string>} Labels de la ficha técnica. */
  function getNicheProductFields(nicheId) {
    return NICHE_PRODUCT_FIELDS[nicheId] || [];
  }

  /** Normaliza texto para matching: minúsculas y sin diacríticos. */
  function normalizeText(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Distancia de edición acotada (Levenshtein) — tolera typos hasta max. */
  function editDistance(a, b, max) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    const row = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i += 1) {
      let prev = row[0];
      row[0] = i;
      let best = row[0];
      for (let j = 1; j <= lb; j += 1) {
        const cur = row[j];
        row[j] = Math.min(prev + (a[i - 1] === b[j - 1] ? 0 : 1), row[j] + 1, row[j - 1] + 1);
        prev = cur;
        if (row[j] < best) best = row[j];
      }
      if (best > max) return max + 1;
    }
    return row[lb];
  }

  /** Intención del mensaje según el nicho (primera coincidencia; fallback 'consulta'). */
  function detectIntent(text, nicheId) {
    const hay = normalizeText(text);
    const intents = NICHE_INTENTS[nicheId] || {};
    const entries = Object.entries(intents);
    for (const [intent, words] of entries) {
      if (words.some((w) => hay.includes(normalizeText(w)))) return intent;
    }
    return 'consulta';
  }

  /**
   * Matchea un texto contra el catálogo activo: exacto (score 1), parcial
   * (0.5-0.9: contención, solapamiento de tokens o typos ≤2 ediciones).
   * @returns {Array<{product:object, intent:string, score:number}>} top 3.
   */
  function matchProducts(text, products, nicheId) {
    const hay = normalizeText(text);
    // Guard: textos vacíos o demasiado cortos no generan candidatos
    if (!hay || hay.length < 2) return [];
    const tokens = hay.split(/\s+/).filter(Boolean);
    const intent = detectIntent(text, nicheId);
    const out = [];
    (products || []).forEach((p) => {
      if (!p || p.active === false) return;
      const names = [p.name, ...(p.aliases || [])].map(normalizeText).filter(Boolean);
      let best = 0;
      names.forEach((n) => {
        if (!n) return;
        if (hay === n) best = Math.max(best, 1);
        else if (hay.includes(n) || (n.length > 3 && n.includes(hay))) best = Math.max(best, 0.85);
        else {
          const nt = n.split(/\s+/).filter(Boolean);
          const overlap = nt.filter((t) => tokens.includes(t)).length / Math.max(1, nt.length);
          if (overlap >= 0.6) best = Math.max(best, 0.7);
          else if (n.length > 3 && editDistance(hay, n, 2) <= 2) best = Math.max(best, 0.6);
          else if (nt.some((t) => t.length > 3 && editDistance(hay, t, 1) <= 1)) best = Math.max(best, 0.55);
        }
      });
      if (best > 0) out.push({ product: p, intent, score: best });
    });
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 3);
  }

  /** Escapa HTML antes de aplicar el markup de WhatsApp (anti-XSS). */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Renderiza el markup de WhatsApp como HTML seguro para previews:
   * ```mono```, *negrita*, _cursiva_, ~tachado~, saltos de línea, bullets
   * (•/-) agrupados en <ul> y '—' como separador.
   */
  function renderWhatsApp(text) {
    const esc = escapeHtml(text);
    // Protege bloques de código antes de aplicar el resto del markup
    const codeBlocks = [];
    let body = esc.replace(/```([^`]+)```/g, (_, m) => {
      codeBlocks.push(m);
      return '\u0000' + (codeBlocks.length - 1) + '\u0000';
    });
    body = body
      .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/~([^~\n]+)~/g, '<del>$1</del>')
      .replace(/(^|[\s(])(_([^_\n]+)_)(?=$|[\s).,;!?])/g, '$1<em>$3</em>');
    body = body.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codeBlocks[Number(i)] + '</code>');
    const lines = body.split('\n');
    const html = [];
    let inList = false;
    lines.forEach((line) => {
      const t = line.trim();
      const isBullet = t.startsWith('• ') || t.startsWith('- ');
      if (isBullet) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + t.replace(/^[•-]\s*/, '') + '</li>');
      } else {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        if (t === '—') html.push('<hr/>');
        else html.push(line + '<br/>');
      }
    });
    if (inList) html.push('</ul>');
    return html.join('');
  }

  /** @param {number|null} n — precio. @returns {string} Precio formateado. */
  function formatPrice(n) {
    if (n == null || Number.isNaN(Number(n))) return '';
    return '$' + Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 });
  }

  /**
   * Compone la tarjeta final del producto (texto con formato WhatsApp) a partir
   * del cardTemplate y los placeholders {{nombre}} {{descripcion}} {{detalles}}
   * {{precio}} {{unidad}} {{stock}}. Trunca suave a 4096 chars (límite WhatsApp).
   */
  function buildProductCard(product, nicheId) {
    const p = product || {};
    const defaults = PRODUCT_CARD_DEFAULTS[nicheId] || PRODUCT_CARD_DEFAULTS.generic;
    const tpl = p.cardTemplate || defaults.template;
    const details = (p.details || [])
      .filter((d) => d && d.label && d.value)
      .map((d) => '• ' + d.label + ': ' + d.value)
      .join('\n');
    const map = {
      '{{nombre}}': p.name || '',
      '{{descripcion}}': p.description || '',
      '{{detalles}}': details,
      '{{precio}}': formatPrice(p.price),
      '{{unidad}}': p.unit || '',
      '{{stock}}': p.stock === false ? 'Agotado' : 'Disponible',
    };
    let card = tpl;
    Object.entries(map).forEach(([k, v]) => {
      card = card.split(k).join(v);
    });
    if (card.length > 4096) card = card.slice(0, 4090) + '\n…';
    return card;
  }

  /** Modalidades de conexión WhatsApp que ofrece Zernio. */
  const WHATSAPP_MODALITIES = [
    {
      id: 'oauth', nombre: 'Cloud API (OAuth)', icon: 'link',
      desc: 'Flujo oficial de Meta (Embedded Signup): autorizas con tu cuenta de Meta y el número queda vinculado.',
      pasos: ['Abrir autorización de Meta', 'Elegir el número del negocio', 'La plataforma crea tu perfil y conecta los mensajes'],
    },
    {
      id: 'credentials', nombre: 'Credenciales Meta', icon: 'key',
      desc: 'Alternativa headless: pega los datos de tu WABA (wabaId, phoneNumberId y token) obtenidos en Meta Business.',
      pasos: ['Obtener credenciales en Meta Business', 'Pegar wabaId, phoneNumberId y token', 'Se valida y vincula el número'],
    },
  ];

  /** Iconos SVG (estilo feather, 24x24). Los de `fill: true` usan fill=currentColor. */
  const ICONS = {
    whatsapp: { fill: true, paths: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' },
    home: { paths: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    message: { paths: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    users: { paths: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    user: { paths: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    megaphone: { paths: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>' },
    settings: { paths: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    send: { paths: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
    chart: { paths: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    activity: { paths: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    search: { paths: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
    plus: { paths: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
    x: { paths: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
    minus: { paths: '<line x1="5" y1="12" x2="19" y2="12"/>' },
    check: { paths: '<polyline points="20 6 9 17 4 12"/>' },
    'check-circle': { paths: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    'chevron-left': { paths: '<polyline points="15 18 9 12 15 6"/>' },
    'chevron-right': { paths: '<polyline points="9 18 15 12 9 6"/>' },
    'arrow-right': { paths: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
    logout: { paths: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' },
    clock: { paths: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    copy: { paths: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
    trash: { paths: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' },
    edit: { paths: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' },
    shield: { paths: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    alert: { paths: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
    refresh: { paths: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' },
    link: { paths: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
    phone: { paths: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' },
    star: { paths: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    key: { paths: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>' },
    zap: { paths: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    book: { paths: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
    box: { paths: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>' },
    tag: { paths: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
    globe: { paths: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    eye: { paths: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
    download: { paths: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
    'credit-card': { paths: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
    'message-circle': { paths: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    instagram: { fill: true, paths: '<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>' },
    tiktok: { fill: true, paths: '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>' },
    layers: { paths: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' },
  };

  /**
   * Devuelve el nicho (template o genérico) por id.
   * @param {string} id — id del nicho.
   * @returns {object} Definición del nicho.
   */
  function getNiche(id) {
    return NICHES.find((n) => n.id === id) || GENERIC_NICHE;
  }

  /**
   * Nivel de permiso de un rol sobre un módulo.
   * @param {string} role — id del rol.
   * @param {string} module — id del módulo.
   * @returns {string|null} 'view' | 'edit' | null.
   */
  function permOf(role, module) {
    const perms = PERMISSIONS[role];
    return perms ? perms[module] ?? null : null;
  }

  /**
   * ¿Puede el rol ejecutar una acción sobre un módulo?
   * @param {string} role — id del rol.
   * @param {string} module — id del módulo.
   * @param {'view'|'edit'} [action='view'] — acción requerida.
   * @returns {boolean}
   */
  function can(role, module, action = 'view') {
    const level = permOf(role, module);
    return level === 'edit' || (action === 'view' && level === 'view');
  }

  /**
   * Tiempo relativo legible.
   * @param {number} ts — timestamp en ms.
   * @returns {string} "hace 5 min", "hace 2 h", etc.
   */
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)} h`;
    return `hace ${Math.floor(diff / 86400000)} d`;
  }

  /** @param {number} ts — timestamp en ms. @returns {string} HH:MM. */
  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  }

  /** @param {number} ts — timestamp en ms. @returns {string} "12 ago", etc. */
  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
  }

  /**
   * Normaliza respuestas del API de Zernio: acepta arrays directos o
   * envelopes ({ profiles }, { accounts }, { numbers }, { data }, { items },
   * { templates }, { broadcasts }, { sequences }, { flows }, { logs }…).
   * @param {*} data — respuesta cruda del API.
   * @returns {Array<object>} Lista normalizada (vacía si no hay datos).
   */
  function asArray(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    const keys = ['data', 'items', 'profiles', 'accounts', 'numbers', 'templates', 'broadcasts', 'sequences', 'flows', 'logs', 'events'];
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
    return [];
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    BRAND,
    DEMO_PHONE,
    ACCENTS,
    REFERRERS,
    FOCUS_MODES,
    ROADMAP_TYPES,
    NICHES,
    GENERIC_NICHE,
    ROLES,
    MODULES,
    PERMISSIONS,
    WHATSAPP_MODALITIES,
    CAMPAIGN_TOOLS,
    ANALYTICS_GUIDE,
    ICONS,
    getNiche,
    permOf,
    can,
    timeAgo,
    formatTime,
    formatDate,
    asArray,
    PLATFORMS,
    getPlatform,
    NICHE_CATALOGS,
    NICHE_PRODUCT_FIELDS,
    NICHE_INTENTS,
    INTENT_LABELS,
    PRODUCT_CARD_DEFAULTS,
    getNicheCatalog,
    getNicheProductFields,
    normalizeText,
    matchProducts,
    escapeHtml,
    renderWhatsApp,
    buildProductCard,
    formatPrice,
  });
})();
