/**
 * @file contacts-composables.js — Composables por bounded context del directorio
 * de contactos. Extraen la lógica del setup de contacts-view (filtros, editor,
 * ciclo de vida y borrado referencial) a objetos `{ refs, computeds, helpers }`.
 * Convención `Z.makeXxx`; sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /** Plantilla de formulario de contacto (create/edit). */
  function emptyForm() {
    return { id: null, name: '', phone: '', tags: [], customFields: {} };
  }

  /**
   * BC Directorio: búsqueda, filtros por tag y columnas dinámicas según los
   * campos personalizados del nicho del workspace.
   */
  function makeContactDirectory({ store, getNiche }) {
    const workspace = Vue.computed(() => store.workspace);
    const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
    const contacts = Vue.computed(() => workspace.value.contacts || []);

    const search = Vue.ref('');
    const tagFilter = Vue.ref('all');

    /** Tags disponibles: etiquetas de contacto del negocio (administrables en Configuración). */
    const availableTags = Vue.computed(() => workspace.value.contactTags || [...new Set([...niche.value.tags, 'cliente'])]);

    /** Campos del negocio (personalizables en Configuración). */
    const fields = Vue.computed(() => workspace.value.customFields || niche.value.customFields || []);

    /** Contactos filtrados por búsqueda y tag. */
    const filtered = Vue.computed(() => {
      const q = search.value.trim().toLowerCase();
      return contacts.value.filter((c) => {
        if (tagFilter.value !== 'all' && !c.tags.includes(tagFilter.value)) return false;
        if (q && !`${c.name} ${c.phone}`.toLowerCase().includes(q)) return false;
        return true;
      });
    });

    return { workspace, niche, contacts, search, tagFilter, availableTags, fields, filtered };
  }

  /**
   * BC Editor: estado del formulario y alta/edición de contactos, con copia
   * defensiva de tags y customFields (sin alias accidentales).
   */
  function makeContactEditor({ workspace, contacts, toast, uid }) {
    const modalOpen = Vue.ref(false);
    const form = Vue.reactive(emptyForm());

    function openCreate() {
      Object.assign(form, emptyForm());
      modalOpen.value = true;
    }

    function openEdit(contact) {
      Object.assign(form, {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        tags: [...contact.tags],
        customFields: { ...contact.customFields },
      });
      modalOpen.value = true;
    }

    function toggleTag(tag) {
      const i = form.tags.indexOf(tag);
      if (i >= 0) form.tags.splice(i, 1);
      else form.tags.push(tag);
    }

    /** Guarda contacto nuevo o editado (solo edición del propio registro). */
    function save() {
      if (!form.name.trim() || !form.phone.trim()) return;
      if (form.id) {
        const contact = contacts.value.find((c) => c.id === form.id);
        if (!contact) return;
        Object.assign(contact, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          tags: [...form.tags],
          customFields: { ...form.customFields },
          nameSource: 'manual',
        });
        toast('Contacto actualizado', 'success');
      } else {
        workspace.value.contacts.unshift({
          id: uid('ct'),
          name: form.name.trim(),
          phone: form.phone.trim(),
          platform: 'whatsapp',
          tags: [...form.tags],
          leadTag: null,
          customFields: { ...form.customFields },
          createdAt: Date.now(),
          // Momento 0 del historial de etapas: cae en "Sin asignar" (null)
          leadHistory: [{ tag: null, at: Date.now() }],
          // Creado a mano: el live nunca lo renombra automáticamente
          nameSource: 'manual',
        });
        toast('Contacto creado', 'success');
      }
      modalOpen.value = false;
    }

    return { modalOpen, form, openCreate, openEdit, toggleTag, save };
  }

  /**
   * BC Lifecycle: borrado referencial de un contacto con cascada sobre sus
   * conversaciones y recordatorios asociados.
   */
  function makeContactLifecycle({ workspace, toast }) {
    const confirmDelete = Vue.ref(null);

    function remove() {
      const id = confirmDelete.value;
      workspace.value.contacts = workspace.value.contacts.filter((c) => c.id !== id);
      workspace.value.conversations = workspace.value.conversations.filter((c) => c.contactId !== id);
      workspace.value.reminders = (workspace.value.reminders || []).filter((r) => r.contactId !== id);
      confirmDelete.value = null;
      toast('Contacto eliminado', 'info');
    }

    return { confirmDelete, remove };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeContactDirectory, makeContactEditor, makeContactLifecycle,
  });
})();