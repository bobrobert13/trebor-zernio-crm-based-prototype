/**
 * @file contacts.js — Directorio de contactos con búsqueda, filtros por tag
 * y columnas dinámicas según los campos personalizados del nicho.
 * CRUD local sobre store.workspace.contacts (persistencia automática).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, getNiche, formatDate, uid, canEdit } = ZernioCrm;

  const components = {};

  /** Plantilla de formulario de contacto (create/edit). */
  function emptyForm() {
    return { id: null, name: '', phone: '', tags: [], customFields: {} };
  }

  components['contacts-view'] = {
    setup() {
      const search = Vue.ref('');
      const tagFilter = Vue.ref('all');
      const modalOpen = Vue.ref(false);
      const confirmDelete = Vue.ref(null);
      const form = Vue.reactive(emptyForm());

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const contacts = Vue.computed(() => workspace.value.contacts || []);

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
          });
          toast('Contacto creado', 'success');
        }
        modalOpen.value = false;
      }

      function remove() {
        const id = confirmDelete.value;
        workspace.value.contacts = workspace.value.contacts.filter((c) => c.id !== id);
        workspace.value.conversations = workspace.value.conversations.filter((c) => c.contactId !== id);
        workspace.value.reminders = (workspace.value.reminders || []).filter((r) => r.contactId !== id);
        confirmDelete.value = null;
        toast('Contacto eliminado', 'info');
      }

      return {
        search, tagFilter, modalOpen, confirmDelete, form,
        workspace, niche, contacts, availableTags, filtered, fields,
        openCreate, openEdit, toggleTag, save, remove, canEdit, formatDate,
      };
    },

    template: `
      <div class="space-y-4">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800">
              <ui-icon name="users" class="h-5 w-5"></ui-icon>
            </span>
            <div>
              <h2 class="text-lg font-bold leading-tight">Contactos</h2>
              <p class="text-xs text-neutral-500">{{ contacts.length }} contactos en {{ workspace.name }}</p>
            </div>
          </div>
          <button v-if="canEdit('contacts')" @click="openCreate"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo contacto
          </button>
        </header>

        <!-- Búsqueda y filtros -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex min-w-72 flex-1 items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
            <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
            <input v-model.trim="search" type="search" placeholder="Buscar por nombre o teléfono…"
              class="w-full bg-transparent text-sm outline-none" />
          </div>
          <div class="flex gap-1.5 overflow-x-auto scrollbar-none">
            <button @click="tagFilter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="tagFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              Todos
            </button>
            <button v-for="t in availableTags" :key="t" @click="tagFilter = t"
              class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="tagFilter === t ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              {{ t }}
            </button>
          </div>
        </div>

        <!-- Tabla -->
        <div class="overflow-auto border border-neutral-200 bg-white">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="border-b border-neutral-200 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th class="sticky top-0 z-10 bg-white px-4 py-3">Contacto</th>
                <th v-for="f in fields" :key="f.slug" class="sticky top-0 z-10 bg-white px-4 py-3">{{ f.name }}</th>
                <th class="sticky top-0 z-10 bg-white px-4 py-3">Tags</th>
                <th class="sticky top-0 z-10 bg-white px-4 py-3">Creado</th>
                <th class="sticky top-0 z-10 bg-white px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <ui-empty v-if="filtered.length === 0" icon="users" title="Sin contactos"
                desc="Crea tu primer contacto o cambia los filtros." class="p-8"></ui-empty>
              <tr v-for="c in filtered" :key="c.id" class="hover:bg-stone-100">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <ui-avatar :name="c.name" size="h-10 w-10 text-sm"></ui-avatar>
                    <div class="min-w-0">
                      <p class="font-semibold">{{ c.name }}</p>
                      <p class="font-mono text-[11px] text-neutral-400">{{ c.phone }}</p>
                    </div>
                  </div>
                </td>
                <td v-for="f in fields" :key="f.slug" class="max-w-40 truncate px-4 py-3 text-neutral-600">
                  {{ c.customFields[f.slug] || '—' }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <ui-badge v-for="t in c.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                  </div>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-neutral-400">{{ formatDate(c.createdAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-1">
                    <button v-if="canEdit('contacts')" @click="openEdit(c)" class="p-1.5 hover:text-[var(--accent)]" aria-label="Editar contacto">
                      <ui-icon name="edit" class="h-4 w-4"></ui-icon>
                    </button>
                    <button v-if="canEdit('contacts')" @click="confirmDelete = c.id" class="p-1.5 hover:text-red-700" aria-label="Eliminar contacto">
                      <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Modal crear/editar -->
        <ui-modal :open="modalOpen" :title="form.id ? 'Editar contacto' : 'Nuevo contacto'" width="max-w-2xl" @close="modalOpen = false">
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <ui-field label="Nombre">
                <input v-model.trim="form.name" type="text" placeholder="Nombre y apellido"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Teléfono (WhatsApp)">
                <input v-model.trim="form.phone" type="tel" placeholder="+58 412 000 0000"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
            </div>

            <ui-field :label="'Campos del nicho · ' + (niche.nombre || '')">
              <div class="grid gap-4 sm:grid-cols-2">
                <template v-for="f in fields" :key="f.slug">
                  <input v-if="f.type === 'text'" v-model="form.customFields[f.slug]" type="text" :placeholder="f.name"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                  <input v-else-if="f.type === 'number'" v-model="form.customFields[f.slug]" type="number" :placeholder="f.name"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                  <input v-else-if="f.type === 'date'" v-model="form.customFields[f.slug]" type="date"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                  <select v-else v-model="form.customFields[f.slug]"
                    class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                    <option value="">{{ f.name }}</option>
                    <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                  </select>
                </template>
              </div>
            </ui-field>

            <ui-field label="Tags">
              <div class="flex flex-wrap gap-1.5">
                <button v-for="t in availableTags" :key="t" @click="toggleTag(t)"
                  class="border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="form.tags.includes(t) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                  {{ t }}
                </button>
              </div>
            </ui-field>

            <button @click="save" :disabled="!form.name.trim() || !form.phone.trim()"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              {{ form.id ? 'Guardar cambios' : 'Crear contacto' }}
            </button>
          </div>
        </ui-modal>

        <!-- Confirmación de eliminación -->
        <ui-modal :open="Boolean(confirmDelete)" title="Eliminar contacto" width="max-w-md" @close="confirmDelete = null">
          <p class="text-sm text-neutral-600">Se eliminará el contacto y sus conversaciones asociadas. Esta acción no se puede deshacer.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmDelete = null" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="remove" class="border-2 border-neutral-900 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
