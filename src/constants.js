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

  /** Etapas del roadmap por negocio (agrupadas en el onboarding). */
  const ROADMAP_TYPES = {
    channel: { label: 'Canal', icon: 'link' },
    templates: { label: 'Plantillas', icon: 'message' },
    fields: { label: 'Campos', icon: 'tag' },
    roles: { label: 'Equipo', icon: 'users' },
    automations: { label: 'Automatizaciones', icon: 'zap' },
  };

  /**
   * Nichos de negocio. Cada nicho define campos personalizados, KPIs,
   * tags de conversación y un roadmap específico de configuración.
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
        { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
      { id: 'wa_channel', title: 'Conectar número WhatsApp', desc: 'Vincula tu número vía Zernio (Cloud API o credenciales).', type: 'channel', optional: false, estimated: '~10 min' },
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
    { id: 'contacts', label: 'Contactos', icon: 'users' },
    { id: 'channels', label: 'Canales', icon: 'layers' },
    { id: 'broadcasts', label: 'Campañas', icon: 'megaphone' },
    { id: 'billing', label: 'Billing', icon: 'credit-card' },
    { id: 'system', label: 'Estados', icon: 'activity' },
    { id: 'team', label: 'Equipo', icon: 'user' },
    { id: 'settings', label: 'Configuración', icon: 'settings' },
  ];

  const PERMISSIONS = {
    owner: { dashboard: 'edit', analytics: 'edit', inbox: 'edit', contacts: 'edit', channels: 'edit', broadcasts: 'edit', billing: 'edit', system: 'edit', team: 'edit', settings: 'edit' },
    admin: { dashboard: 'edit', analytics: 'edit', inbox: 'edit', contacts: 'edit', channels: 'edit', broadcasts: 'edit', billing: 'view', system: 'view', team: 'edit', settings: 'view' },
    agente: { dashboard: 'view', analytics: 'view', inbox: 'edit', contacts: 'edit', channels: null, broadcasts: null, billing: null, system: null, team: null, settings: null },
    vendedor: { dashboard: 'view', analytics: 'view', inbox: 'edit', contacts: 'edit', channels: null, broadcasts: 'edit', billing: null, system: null, team: null, settings: null },
  };

  /**
   * Plataformas soportadas por el módulo de canales.
   * inbox: true solo si Zernio expone la mensajería (DM) para esa plataforma.
   */
  const PLATFORMS = [
    { id: 'whatsapp', nombre: 'WhatsApp', icon: 'whatsapp', inbox: true, tone: 'bg-emerald-100 text-emerald-800' },
    { id: 'instagram', nombre: 'Instagram', icon: 'instagram', inbox: true, tone: 'bg-pink-100 text-pink-700' },
    { id: 'tiktok', nombre: 'TikTok', icon: 'tiktok', inbox: false, tone: 'bg-neutral-100 text-neutral-900', nota: 'Zernio no expone DM de TikTok: la cuenta se conecta para verificación, sin bandeja.' },
  ];

  /** @param {string} id — id de plataforma. @returns {object|undefined} */
  function getPlatform(id) {
    return PLATFORMS.find((p) => p.id === id);
  }

  /** Modalidades de conexión WhatsApp que ofrece Zernio. */
  const WHATSAPP_MODALITIES = [
    {
      id: 'oauth', nombre: 'Cloud API (OAuth)', icon: 'link',
      desc: 'Flujo oficial de Meta (Embedded Signup): autorizas con tu cuenta de Meta y el número queda vinculado.',
      pasos: ['Abrir autorización de Meta', 'Elegir el número del negocio', 'Zernio crea el perfil y suscribe webhooks'],
    },
    {
      id: 'credentials', nombre: 'Credenciales Meta', icon: 'key',
      desc: 'Alternativa headless: pega los datos de tu WABA (wabaId, phoneNumberId y token) obtenidos en Meta Business.',
      pasos: ['Obtener credenciales en Meta Business', 'Pegar wabaId, phoneNumberId y token', 'Se valida y vincula el número'],
    },
  ];

  /** Iconos SVG (estilo feather, 24x24). Los de `fill: true` usan fill=currentColor. */
  const ICONS = {
    whatsapp: { fill: true, paths: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z' },
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
    tag: { paths: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
    globe: { paths: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    eye: { paths: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
    download: { paths: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
    'credit-card': { paths: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
    'message-circle': { paths: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    instagram: { fill: true, paths: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
    tiktok: { fill: true, paths: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
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
  });
})();
