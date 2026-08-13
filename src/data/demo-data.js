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

  /**
   * Guiones por nicho con catálogo: conversaciones que cubren todos los casos
   * de producto (consulta en ventana, fuera de 24h, agotado con demanda, pico,
   * interés recurrente, intención fuerte y venta cruzada). Los textos usan
   * nombres/alias reales del catálogo para que la detección los marque.
   */
  const PRODUCT_SCRIPTS = {
    celulares: [
      {
        contact: 'Gabriel Acevedo', platform: 'whatsapp', accountId: 'demo_wa', unread: 1,
        msgs: [
          { from: 'in', text: 'Buenas, ¿cuánto cuesta el iPhone 15?', ts: Date.now() - 35 * 60000, status: 'read' },
          { from: 'out', text: '¡Hola! Te paso el detalle del iPhone 15 en 128 GB.', ts: Date.now() - 33 * 60000, status: 'read' },
          { from: 'in', text: '¿Tienen en azul? 😊', ts: Date.now() - 30 * 60000, status: 'delivered' },
        ],
      },
      {
        contact: 'Patricia Villalba', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el iPhone 15?', ts: Date.now() - 96 * 60000, status: 'read' },
          { from: 'out', text: 'A $899 en 128 GB con garantía de 1 año.', ts: Date.now() - 93 * 60000, status: 'read' },
        ],
      },
      {
        contact: 'Hugo Castillo', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Hay audífonos inalámbricos disponibles?', ts: Date.now() - 32 * 3600e3, status: 'read' },
          { from: 'out', text: 'Déjame revisar el stock y te confirmo.', ts: Date.now() - 32 * 3600e3 + 120000, status: 'read' },
        ],
      },
      {
        contact: 'Luisa Ferrer', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Venden cargador rápido?', ts: Date.now() - 252 * 60000, status: 'read' },
          { from: 'out', text: 'Sí, de 25W con cable incluido a $15.', ts: Date.now() - 240 * 60000, status: 'read' },
        ],
      },
      {
        contact: 'Carlos Hernández', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el iPhone 15?', ts: Date.now() - 6.2 * 3600e3, status: 'read' },
          { from: 'out', text: 'A $899. ¿Te interesa en otro color?', ts: Date.now() - 6 * 3600e3, status: 'read' },
        ],
      },
      {
        // Interés recurrente + pico de demanda + intención fuerte (mismo contacto)
        contact: 'Daniela Rojas', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el Samsung Galaxy S24?', ts: Date.now() - 50 * 864e5, status: 'read' },
          { from: 'out', text: 'A $799 en 256 GB. ¿Te interesa?', ts: Date.now() - 50 * 864e5 + 120000, status: 'read' },
          { from: 'in', text: '¿Tienen stock del Samsung Galaxy S24?', ts: Date.now() - 20 * 864e5, status: 'read' },
          { from: 'out', text: 'Sí, tenemos unidades en negro y violeta.', ts: Date.now() - 20 * 864e5 + 120000, status: 'read' },
          { from: 'in', text: 'Quiero pedir el Samsung Galaxy S24', ts: Date.now() - 4 * 864e5, status: 'read' },
          { from: 'out', text: '¡Perfecto! Te confirmo el pedido en unos minutos.', ts: Date.now() - 4 * 864e5 + 120000, status: 'read' },
        ],
      },
      {
        // Coincidencia parcial (alias separado por palabras) → feedback del agente
        contact: 'Oscar Pino', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: 'Cuánto cuesta el s24 de samsung', ts: Date.now() - 7.2 * 3600e3, status: 'read' },
          { from: 'out', text: 'El S24 a $799 en 256 GB.', ts: Date.now() - 7 * 3600e3, status: 'read' },
        ],
      },
      {
        // Venta cruzada: mismo contacto consulta dos productos del catálogo
        contact: 'Natalia Briceño', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el iPhone 15?', ts: Date.now() - 9.5 * 3600e3, status: 'read' },
          { from: 'out', text: 'A $899 en 128 GB.', ts: Date.now() - 9.3 * 3600e3, status: 'read' },
          { from: 'in', text: '¿Venden cargador rápido?', ts: Date.now() - 9 * 3600e3, status: 'read' },
          { from: 'out', text: 'Sí, de 25W con cable a $15.', ts: Date.now() - 8.8 * 3600e3, status: 'read' },
        ],
      },
      {
        contact: 'Valentina Ríos', platform: 'instagram', accountId: 'demo_ig', unread: 0,
        msgs: [
          { from: 'in', text: 'Vi su perfil en Instagram, ¿cuánto cuesta el iPhone 15? 😍', ts: Date.now() - 50 * 60000, status: 'delivered' },
          { from: 'out', text: '¡Hola! A $899 en 128 GB.', ts: Date.now() - 48 * 60000, status: 'read' },
        ],
      },
      {
        // Fuera de la ventana de 24h en Instagram → banner HUMAN_AGENT
        contact: 'Sofía Marcano', platform: 'instagram', accountId: 'demo_ig', unread: 0,
        msgs: [
          { from: 'in', text: '¿Hacen liberación de equipos?', ts: Date.now() - 30 * 3600e3, status: 'read' },
          { from: 'out', text: '¡Sí! En 24 horas con garantía definitiva.', ts: Date.now() - 30 * 3600e3 + 120000, status: 'read' },
        ],
      },
    ],
    restaurante: [
      {
        contact: 'María Pérez', platform: 'whatsapp', accountId: 'demo_wa', unread: 1,
        msgs: [
          { from: 'in', text: 'Buenas, ¿tienen arroz con pollo hoy?', ts: Date.now() - 25 * 60000, status: 'read' },
          { from: 'out', text: '¡Claro! Te paso el detalle del arroz con pollo y confirmamos el delivery.', ts: Date.now() - 23 * 60000, status: 'read' },
          { from: 'in', text: 'Confirmen mi pedido porfa 🙏', ts: Date.now() - 20 * 60000, status: 'delivered' },
        ],
      },
      {
        contact: 'José Rodríguez', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el arroz con pollo?', ts: Date.now() - 96 * 60000, status: 'read' },
          { from: 'out', text: 'A $8.50 la porción con ensalada y tajadas.', ts: Date.now() - 93 * 60000, status: 'read' },
        ],
      },
      {
        // Agotado con demanda (stock false) + fuera de ventana → banner de plantilla
        contact: 'Ana González', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Hay postre disponible hoy?', ts: Date.now() - 32 * 3600e3, status: 'read' },
          { from: 'out', text: 'Hoy tenemos torta de chocolate; te confirmo disponibilidad.', ts: Date.now() - 32 * 3600e3 + 120000, status: 'read' },
        ],
      },
      {
        contact: 'Luis Martínez', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Venden jugo natural?', ts: Date.now() - 252 * 60000, status: 'read' },
          { from: 'out', text: 'Sí, jugo del día a $3 el vaso. ¿Qué fruta?', ts: Date.now() - 240 * 60000, status: 'read' },
        ],
      },
      {
        contact: 'Carlos Hernández', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Hacen arroz con pollo para llevar?', ts: Date.now() - 6.2 * 3600e3, status: 'read' },
          { from: 'out', text: '¡Sí! La porción a $8.50. ¿A qué hora la buscas?', ts: Date.now() - 6 * 3600e3, status: 'read' },
        ],
      },
      {
        // Interés recurrente + pico de demanda + intención fuerte (mismo contacto)
        contact: 'Daniela Rojas', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta la hamburguesa clásica?', ts: Date.now() - 50 * 864e5, status: 'read' },
          { from: 'out', text: 'La clásica con papas a $6.50.', ts: Date.now() - 50 * 864e5 + 120000, status: 'read' },
          { from: 'in', text: '¿Tienen hamburguesas para el almuerzo?', ts: Date.now() - 20 * 864e5, status: 'read' },
          { from: 'out', text: '¡Sí! Las preparamos al momento.', ts: Date.now() - 20 * 864e5 + 120000, status: 'read' },
          { from: 'in', text: 'Quiero pedir una hamburguesa clásica', ts: Date.now() - 4 * 864e5, status: 'read' },
          { from: 'out', text: '¡Perfecto! Te confirmo el pedido en unos minutos.', ts: Date.now() - 4 * 864e5 + 120000, status: 'read' },
        ],
      },
      {
        // Coincidencia parcial: el alias "burger" da score bajo → feedback del agente
        contact: 'Oscar Pino', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta la burger clásica?', ts: Date.now() - 7.2 * 3600e3, status: 'read' },
          { from: 'out', text: 'La clásica a $6.50. ¿Te la armamos?', ts: Date.now() - 7 * 3600e3, status: 'read' },
        ],
      },
      {
        // Venta cruzada: mismo contacto consulta dos productos del catálogo
        contact: 'Natalia Briceño', platform: 'whatsapp', accountId: 'demo_wa', unread: 0,
        msgs: [
          { from: 'in', text: '¿Cuánto cuesta el arroz con pollo?', ts: Date.now() - 9.5 * 3600e3, status: 'read' },
          { from: 'out', text: 'A $8.50 la porción.', ts: Date.now() - 9.3 * 3600e3, status: 'read' },
          { from: 'in', text: '¿Venden jugo natural?', ts: Date.now() - 9 * 3600e3, status: 'read' },
          { from: 'out', text: 'Sí, el jugo del día a $3.', ts: Date.now() - 8.8 * 3600e3, status: 'read' },
        ],
      },
      {
        contact: 'Valentina Ríos', platform: 'instagram', accountId: 'demo_ig', unread: 0,
        msgs: [
          { from: 'in', text: 'Vi su perfil en Instagram, ¿cuánto cuesta la pizza margarita? 😍', ts: Date.now() - 50 * 60000, status: 'delivered' },
          { from: 'out', text: '¡Hola! La mediana a $10. ¿La quieres para llevar?', ts: Date.now() - 48 * 60000, status: 'read' },
        ],
      },
      {
        // Fuera de la ventana de 24h en Instagram → banner HUMAN_AGENT
        contact: 'Sofía Marcano', platform: 'instagram', accountId: 'demo_ig', unread: 0,
        msgs: [
          { from: 'in', text: '¿Hacen delivery a mi zona?', ts: Date.now() - 30 * 3600e3, status: 'read' },
          { from: 'out', text: '¡Sí! Dime tu zona y te confirmo la cobertura.', ts: Date.now() - 30 * 3600e3 + 120000, status: 'read' },
        ],
      },
    ],
  };

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

  /** Construye las conversaciones demo: guiones de producto por nicho (si hay
   *  catálogo) o guiones genéricos con los primeros contactos (resto de nichos). */
  function buildConversations(niche, contacts, products) {
    const conversations = [];
    const byName = (n) => contacts.find((c) => c.name === n) || null;
    const scripts = PRODUCT_SCRIPTS[niche.id];

    if (scripts && products.length) {
      scripts.forEach((s) => {
        const contact = byName(s.contact);
        if (!contact) return;
        const messages = s.msgs.map((m) => ({ id: uid('msg'), ...m }));
        const lastTs = messages[messages.length - 1].ts;
        conversations.push({
          id: uid('conv'),
          contactId: contact.id,
          platform: s.platform || 'whatsapp',
          status: 'active',
          unread: s.unread || 0,
          tags: contact.tags.slice(0, 1),
          messages,
          lastTs,
          accountId: s.accountId || 'demo_wa',
          ...(s.platform === 'instagram' ? { igProfile: contact.igProfile || null } : {}),
        });
      });
      return conversations;
    }

    // Fallback genérico: nichos sin catálogo de productos
    contacts.slice(0, 6).forEach((contact, i) => {
      const [incoming, outgoing] = SCRIPTS[i % SCRIPTS.length];
      const ts = Date.now() - RECENT_MINUTES[i] * 60000;
      const unread = i < 2 ? 1 + i : 0;
      const messages = [
        { id: uid('msg'), from: 'in', text: incoming, ts: ts - 400000, status: 'read' },
        { id: uid('msg'), from: 'out', text: outgoing, ts: ts - 200000, status: 'read' },
      ];
      if (unread > 0) {
        messages.push({ id: uid('msg'), from: 'in', text: '¿Me puedes confirmar? 😊', ts, status: 'delivered' });
      }
      conversations.push({
        id: uid('conv'),
        contactId: contact.id,
        platform: 'whatsapp',
        status: 'active',
        unread,
        tags: contact.tags.slice(0, 1),
        messages,
        lastTs: ts,
        accountId: 'demo_wa',
      });
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
   * Menciones demo de productos: se derivan de los mensajes entrantes de las
   * conversaciones sembradas (misma detección que en vivo), de modo que los
   * chips siempre aparecen bajo el mensaje correcto y con fechas alineadas.
   * Exactas (score >= 0.85) quedan auto-confirmadas; parciales, pendientes.
   */
  function buildProductMentions(niche, contacts, conversations, products) {
    if (!products.length) return [];
    const out = [];
    conversations.forEach((conv) => {
      const contact = contacts.find((c) => c.id === conv.contactId);
      if (!contact) return;
      (conv.messages || []).forEach((msg) => {
        if (msg.from !== 'in' || !msg.text) return;
        const matches = ZernioCrm.matchProducts(msg.text, products, niche.id);
        matches.forEach((m) => {
          out.push({
            id: uid('men'),
            productId: m.product.id,
            messageId: msg.id,
            contactId: contact.id,
            convId: conv.id,
            ts: msg.ts || Date.now(),
            intent: m.intent,
            match: m.score >= 0.85 ? 'exacta' : 'parcial',
            status: m.score >= 0.85 ? 'confirmada' : 'pendiente',
            text: String(msg.text).slice(0, 200),
          });
        });
      });
    });
    return out;
  }

  /**
   * Construye un workspace demo completo a partir de la config del onboarding.
   * @param {object} params — { name, slogan, accentId, nicheId, focus, referrer, referrerDetail, ownerName, ownerEmail }.
   * @returns {object} Workspace con datos sembrados.
   */
  function buildWorkspace(params) {
    const niche = getNiche(params.nicheId);
    const contacts = buildContacts(niche);
    const products = ZernioCrm.getNicheCatalog(niche.id);
    const conversations = buildConversations(niche, contacts, products);
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
