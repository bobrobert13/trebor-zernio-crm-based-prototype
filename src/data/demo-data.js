/**
 * @file demo-data.js — Generador de datos de demostración por nicho.
 * Construye un workspace completo (contactos, conversaciones WhatsApp,
 * usuarios, plantillas, broadcasts y actividad) para validar el MVP sin API key.
 */
(function () {
  'use strict';

  const { ZernioCrm } = window;
  const { DEMO_PHONE, uid, getNiche } = ZernioCrm;

  /** Muestras de contacto por nicho: [nombre, teléfono, valores de campos, tags]. */
  const NICHE_SAMPLES = {
    restaurante: [
      ['María Pérez', '+58 412 555 0101', ['Delivery', '12', 'Sin cebolla'], ['pedido']],
      ['José Rodríguez', '+58 416 555 0102', ['Local', '5', ''], ['vip']],
      ['Ana González', '+58 424 555 0103', ['Para llevar', '', ''], ['reserva']],
      ['Luis Martínez', '+58 414 555 0104', ['Delivery', '', 'Poco condimento'], ['pedido']],
    ],
    repuestos: [
      ['Carlos Herrera', '+58 412 555 0111', ['Toyota Corolla 2016', 2016, 'Cotizando'], ['cotizacion']],
      ['Rosa Mendoza', '+58 416 555 0112', ['Chevrolet Aveo 2012', 2012, 'Confirmado'], ['pedido']],
      ['Jorge Díaz', '+58 424 555 0113', ['Ford F-150 2019', 2019, 'Entregado'], ['vip']],
      ['Marta Suárez', '+58 414 555 0114', ['Hyundai Tucson 2018', 2018, 'En tránsito'], ['pedido']],
    ],
    farmacia: [
      ['Carmen López', '+58 412 555 0121', ['Sí', 'Delivery', 'El Paraíso'], ['pedido', 'receta']],
      ['Pedro García', '+58 416 555 0122', ['No', 'En mostrador', ''], ['pedido']],
      ['Yusmary Contreras', '+58 424 555 0123', ['Sí', 'Delivery', 'La Candelaria'], ['receta']],
      ['Andrés Silva', '+58 414 555 0124', ['No', 'En mostrador', ''], ['reclamo']],
    ],
    fibra: [
      ['Nelson Rivas', '+58 412 555 0131', ['50 Mbps', 'El Valle', 'Cotizando'], ['cotizacion']],
      ['Beatriz Campos', '+58 416 555 0132', ['100 Mbps', 'Petare', 'Agendada'], ['instalacion']],
      ['Omar Quintero', '+58 424 555 0133', ['25 Mbps', 'Catia', 'Instalado'], ['falla']],
      ['Julia Figueroa', '+58 414 555 0134', ['200 Mbps', 'Chacao', 'Instalado'], ['facturacion']],
    ],
    optica: [
      ['Rafael Urdaneta', '+58 412 555 0141', ['Progresivo', '-1.50 / -1.75', '2026-11-10'], ['cita']],
      ['Teresa Barrios', '+58 416 555 0142', ['Monofocal', '-2.25', ''], ['lentes']],
      ['Alberto Núñez', '+58 424 555 0143', ['Anti-reflejo', '-0.75', '2026-12-01'], ['examen']],
      ['Isabel Moreno', '+58 414 555 0144', ['Bifocal', '+1.25', ''], ['garantia']],
    ],
    celulares: [
      ['Gabriel Acevedo', '+58 412 555 0151', ['iPhone 13', 'Usado', 6], ['cotizacion']],
      ['Patricia Villalba', '+58 416 555 0152', ['Samsung A54', 'Nuevo', 12], ['preventa']],
      ['Hugo Castillo', '+58 424 555 0153', ['Xiaomi Redmi 12', 'Nuevo', 12], ['garantia']],
      ['Luisa Ferrer', '+58 414 555 0154', ['Motorola G84', 'Reacondicionado', 3], ['vip']],
    ],
    vendedor: [
      ['Sandra Pacheco', '+58 412 555 0161', ['PED-1001', 'Zoom', 'TRA-88231'], ['pedido', 'pago']],
      ['Miguel Ángel Rojas', '+58 416 555 0162', ['PED-1002', 'MRW', ''], ['pedido']],
      ['Eliana Torres', '+58 424 555 0163', ['PED-1003', 'Propio', ''], ['entrega']],
      ['Víctor Salazar', '+58 414 555 0164', ['PED-1004', 'Yummy', 'TRA-55219'], ['preventa']],
    ],
    personalizado: [
      ['Marina Delgado', '+58 412 555 0171', ['Cliente desde 2024', 'Alto'], ['cliente']],
      ['Francisco Rangel', '+58 416 555 0172', ['', 'Medio'], ['seguimiento']],
    ],
  };

  /** Guiones de conversación demo: [mensaje entrante, respuesta saliente]. */
  const SCRIPTS = [
    ['Hola, ¿me pueden ayudar con una consulta? 🙏', '¡Claro! Con gusto. Cuéntame qué necesitas.'],
    ['Buenas tardes, quiero hacer un pedido', '¡Perfecto! ¿Me indicas qué necesitas y tu zona de entrega?'],
    ['¿Cuál es el horario de atención?', 'Atendemos de lunes a sábado de 8:00 am a 6:00 pm. ¿En qué te ayudo?'],
    ['Hola, recibí el producto pero tiene un detalle', 'Lamento el inconveniente. Te paso con soporte para revisarlo de inmediato.'],
    ['¿Tienen promociones esta semana?', '¡Sí! Esta semana tenemos 15% de descuento. Te envío el detalle.'],
    ['Buen día, quiero cotizar un servicio', '¡Buen día! Cuéntame qué necesitas y te preparo la cotización.'],
  ];

  /** Minutos desde ahora para las últimas conversaciones. */
  const RECENT_MINUTES = [4, 18, 45, 90, 240, 1500];

  /** Genera un valor de ejemplo para un campo personalizado por su tipo. */
  function sampleFieldValue(field) {
    switch (field.type) {
      case 'select':
        return field.options[(Math.random() * field.options.length) | 0];
      case 'number':
        return 1 + ((Math.random() * 4) | 0);
      case 'date': {
        const d = new Date(Date.now() + ((20 + Math.random() * 300) | 0) * 864e5);
        return d.toISOString().slice(0, 10);
      }
      default:
        return '';
    }
  }

  /** Construye los contactos demo: muestras del nicho + relleno genérico + Instagram. */
  function buildContacts(niche) {
    const samples = NICHE_SAMPLES[niche.id] || NICHE_SAMPLES.personalizado;
    const fields = niche.customFields;
    const contacts = samples.map(([name, phone, values, tags], i) => {
      const createdAt = Date.now() - (i + 3) * 864e5;
      const leadTag = (niche.tags || [])[i % (niche.tags || []).length] || null; // etapa inicial del pipeline
      return {
        id: uid('ct'),
        name,
        phone,
        platform: 'whatsapp',
        tags,
        leadTag,
        customFields: Object.fromEntries(fields.map((f, j) => [f.slug, values[j] ?? ''])),
        createdAt,
        // Momento 0 del historial de etapas: la etapa inicial queda registrada
        leadHistory: [{ tag: leadTag, at: createdAt }],
      };
    });
    for (let i = 0; i < 4; i += 1) {
      const name = ['Carlos Hernández', 'Daniela Rojas', 'Oscar Pino', 'Natalia Briceño'][i];
      const createdAt = Date.now() - (i + 9) * 864e5;
      const leadTag = (niche.tags || [])[(i + 1) % (niche.tags || []).length] || null;
      contacts.push({
        id: uid('ct'),
        name,
        phone: `+58 412 555 02${10 + i}`,
        platform: 'whatsapp',
        tags: ['cliente'],
        leadTag,
        customFields: Object.fromEntries(fields.map((f) => [f.slug, sampleFieldValue(f)])),
        createdAt,
        leadHistory: [{ tag: leadTag, at: createdAt }],
      });
    }
    // Contactos de Instagram (canal con mensajería)
    const igContact = (name, phone, days, igProfile) => {
      const createdAt = Date.now() - days * 864e5;
      return {
        id: uid('ct'), name, phone, platform: 'instagram', tags: ['cliente'], leadTag: null, customFields: {}, createdAt,
        leadHistory: [{ tag: null, at: createdAt }],
        igProfile,
      };
    };
    contacts.push(
      igContact('Valentina Ríos', '@valentina.rios', 2, { isFollower: true, isFollowing: false, followerCount: 1240, isVerified: false }),
      igContact('Sofía Marcano', '@sofia.marcano', 4, { isFollower: false, isFollowing: true, followerCount: 305, isVerified: false })
    );
    return contacts;
  }

  /** Construye las conversaciones demo a partir de los primeros contactos. */
  function buildConversations(contacts) {
    const conversations = contacts.slice(0, 6).map((contact, i) => {
      const [incoming, outgoing] = SCRIPTS[i % SCRIPTS.length];
      const ts = Date.now() - RECENT_MINUTES[i] * 60000;
      const unread = i < 2 ? 1 + i : 0;
      const messages = [
        { id: uid('msg'), from: 'in', text: incoming, ts: ts - 400000, status: 'read' },
        { id: uid('msg'), from: 'out', text: outgoing, ts: ts - 200000, status: 'read' },
      ];
      if (unread > 0) {
        messages.push({
          id: uid('msg'),
          from: 'in',
          text: '¿Me puedes confirmar? 😊',
          ts,
          status: 'delivered',
        });
      }
      return {
        id: uid('conv'),
        contactId: contact.id,
        platform: 'whatsapp',
        status: 'active',
        unread,
        tags: contact.tags.slice(0, 1),
        messages,
        lastTs: ts,
        accountId: 'demo_wa',
      };
    });

    // Conversaciones de Instagram (canal con mensajería)
    const igContacts = contacts.filter((c) => c.platform === 'instagram');
    igContacts.forEach((contact, i) => {
      const ts = Date.now() - (12 + i * 45) * 60000;
      conversations.push({
        id: uid('conv'),
        contactId: contact.id,
        platform: 'instagram',
        status: 'active',
        unread: i === 0 ? 1 : 0,
        tags: contact.tags.slice(0, 1),
        messages: [
          { id: uid('msg'), from: 'in', text: i === 0 ? '¡Hola! Vi su perfil en Instagram, ¿me pasan el catálogo? 😍' : 'Gracias por el seguimiento, ¿tienen delivery?', ts: ts - 300000, status: 'delivered' },
          { id: uid('msg'), from: 'out', text: '¡Hola! Claro, te lo envío ahora mismo por aquí.', ts, status: 'read' },
        ],
        lastTs: ts,
        accountId: 'demo_ig',
        igProfile: contact.igProfile || null,
      });
    });
    return conversations;
  }

  /** Construye los usuarios demo (uno por rol para validar RBAC). */
  function buildUsers(ownerName, ownerEmail) {
    return [
      { id: uid('usr'), name: ownerName || 'Propietario', email: ownerEmail || 'propietario@demo.com', role: 'owner', online: true },
      { id: uid('usr'), name: 'Carlos Gómez', email: 'carlos@demo.com', role: 'admin', online: true },
      { id: uid('usr'), name: 'María Fernández', email: 'maria@demo.com', role: 'agente', online: true },
      { id: uid('usr'), name: 'José Pérez', email: 'jose@demo.com', role: 'vendedor', online: false },
    ];
  }

  /** Construye plantillas WhatsApp demo según el roadmap del nicho. */
  function buildTemplates(niche) {
    const names = niche.roadmap.filter((r) => r.type === 'templates').slice(0, 2);
    return names.map((step, i) => ({
      id: uid('tpl'),
      name: `${step.id}_${i + 1}`,
      category: i === 0 ? 'UTILITY' : 'MARKETING',
      language: 'es',
      status: i === 0 ? 'APPROVED' : 'PENDING',
    }));
  }

  /** Construye broadcasts demo. */
  function buildBroadcasts(niche) {
    return [
      {
        id: uid('bc'),
        name: `Promoción de ${niche.nombre.toLowerCase()}`,
        audience: `Contactos con tag "${niche.tags[0]}"`,
        status: 'sent',
        sentAt: Date.now() - 2 * 864e5,
        stats: { total: 120, delivered: 114, failed: 6 },
      },
      {
        id: uid('bc'),
        name: 'Bienvenida de temporada',
        audience: 'Todos los contactos activos',
        status: 'scheduled',
        sentAt: Date.now() + 864e5,
        stats: null,
      },
    ];
  }

  /** Construye el feed de actividad demo. */
  function buildActivity(contactNames) {
    const [a, b] = contactNames;
    return [
      { id: uid('act'), type: 'whatsapp', text: `Número WhatsApp conectado (${DEMO_PHONE})`, ts: Date.now() - 3600e3 },
      { id: uid('act'), type: 'message', text: `Nuevo mensaje de ${a}`, ts: Date.now() - 45 * 60000 },
      { id: uid('act'), type: 'contact', text: `Contacto creado: ${b}`, ts: Date.now() - 120 * 60000 },
      { id: uid('act'), type: 'broadcast', text: 'Campaña enviada a 120 contactos', ts: Date.now() - 2 * 864e5 },
      { id: uid('act'), type: 'system', text: 'Espacio de trabajo creado con plantilla del nicho', ts: Date.now() - 3 * 864e5 },
    ];
  }

  /**
   * Menciones demo de productos: cubren los 6 casos de oportunidad
   * (demanda sin venta, agotado con demanda, pico, interés recurrente,
   * intención fuerte y venta cruzada) con fechas escalonadas 0-60 días.
   */
  function buildProductMentions(niche, contacts, conversations, products) {
    const byName = (n) => contacts.find((c) => c.name === n) || null;
    const convOf = (c) => conversations.find((x) => x.contactId === c.id) || null;
    const daysAgo = (d) => Date.now() - d * 864e5;
    const mention = (productName, contactName, text, intent, match, days, conv) => {
      const p = products.find((x) => x.name === productName);
      const c = byName(contactName);
      if (!p || !c) return null;
      return {
        id: uid('men'),
        productId: p.id,
        messageId: null,
        contactId: c.id,
        convId: (conv || convOf(c) || {}).id || null,
        ts: daysAgo(days),
        intent,
        match,
        status: 'confirmada',
        text,
      };
    };
    const seeds = [
      // Intención fuerte + demanda sin venta (iPhone 15, 2 contactos distintos)
      mention('iPhone 15', 'Marina Delgado', '¿Cuánto cuesta el iPhone 15?', 'precio', 'exacta', 2),
      mention('iPhone 15', 'Francisco Rangel', '¿Tienen el iPhone 15 en azul?', 'disponibilidad', 'parcial', 5),
      // Agotado con demanda (Audífonos, stock false)
      mention('Audífonos inalámbricos', 'Carlos Hernández', '¿Hay audífonos disponibles?', 'disponibilidad', 'exacta', 1),
      // Interés recurrente + pico de demanda (Samsung S24, mismo contacto, 50d vs 4d)
      mention('Samsung Galaxy S24', 'Daniela Rojas', '¿Precio del Galaxy S24?', 'precio', 'exacta', 50),
      mention('Samsung Galaxy S24', 'Daniela Rojas', '¿Tienen stock del S24?', 'disponibilidad', 'exacta', 20),
      mention('Samsung Galaxy S24', 'Daniela Rojas', 'Quiero pedir un S24', 'pedido', 'exacta', 4),
      mention('Samsung Galaxy S24', 'Oscar Pino', '¿Cuánto cuesta el S24?', 'precio', 'exacta', 6),
      // Venta cruzada (mismo contacto: iPhone 15 + Cargador)
      mention('iPhone 15', 'Natalia Briceño', '¿Precio del iPhone 15?', 'precio', 'exacta', 3),
      mention('Cargador rápido 25W', 'Natalia Briceño', '¿Venden cargadores rápidos?', 'disponibilidad', 'parcial', 3),
      // Consultas sueltas (demanda base)
      mention('Reparación de pantalla', 'Valentina Ríos', '¿Reparan pantallas rotas?', 'garantia', 'exacta', 8),
      mention('Plan de datos 10GB', 'Sofía Marcano', '¿Cuánto cuesta el plan de datos?', 'precio', 'exacta', 12),
    ];
    // Solo nichos con catálogo semilla (restaurante/celulares)
    if (!products.length || !['restaurante', 'celulares'].includes(niche.id)) return [];
    return seeds.filter(Boolean);
  }

  /**
   * Construye un workspace demo completo a partir de la config del onboarding.
   * @param {object} params — { name, slogan, accentId, nicheId, focus, referrer, referrerDetail, ownerName, ownerEmail }.
   * @returns {object} Workspace con datos sembrados.
   */
  function buildWorkspace(params) {
    const niche = getNiche(params.nicheId);
    const contacts = buildContacts(niche);
    const conversations = buildConversations(contacts);
    const products = ZernioCrm.getNicheCatalog(niche.id);
    return {
      id: uid('ws'),
      name: params.name,
      slogan: params.slogan || '',
      accentId: params.accentId,
      nicheId: niche.id,
      focus: params.focus,
      referrer: params.referrer,
      referrerDetail: params.referrerDetail || '',
      createdAt: Date.now(),
      whatsapp: {
        connected: true,
        modality: 'demo',
        phone: DEMO_PHONE,
        status: 'connected',
        since: Date.now() - 3600e3,
        about: 'Atención al cliente por WhatsApp',
      },
      users: buildUsers(params.ownerName, params.ownerEmail),
      contacts,
      conversations,
      products,
      productMentions: buildProductMentions(niche, contacts, conversations, products),
      templates: buildTemplates(niche),
      broadcasts: buildBroadcasts(niche),
      activity: buildActivity([contacts[0].name, contacts[1].name]),
      settings: { notifications: true, autoReply: false },
      leadTags: [...niche.tags], // etiquetas de leads por defecto del nicho (editables)
      contactTags: [...niche.tags, 'cliente'], // etiquetas de contacto por defecto del nicho (editables)
      customFields: niche.customFields, // campos del negocio por defecto del nicho (editables)
      channels: [
        { platform: 'whatsapp', accountId: 'demo_wa', username: DEMO_PHONE, connected: true, since: Date.now() - 3600e3 },
        { platform: 'instagram', accountId: 'demo_ig', username: 'mi.negocio.ve', connected: true, since: Date.now() - 864e5 },
        { platform: 'tiktok', accountId: 'demo_tt', username: 'minegociove', connected: true, since: Date.now() - 2 * 864e5 },
      ],
      // Seed del medidor local para el panel Billing en modo demo (sin llamadas reales)
      usage: {
        total: 342,
        updatedAt: Date.now(),
        byEndpoint: { '/inbox/conversations': 128, '/inbox/conversations/:id/messages': 96, '/contacts': 61, '/whatsapp/templates': 57 },
        byDay: Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
            return [d, 4 + Math.round(Math.random() * 22)];
          })
        ),
      },
    };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, { demo: { buildWorkspace } });
})();
