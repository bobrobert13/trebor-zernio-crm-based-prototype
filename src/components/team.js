/**
 * @file team.js — Gestión de equipo y RBAC: usuarios con roles,
 * matriz de permisos por módulo (solo lectura) e invitaciones demo
 * (genera link de un solo uso con expiración).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, ROLES, MODULES, PERMISSIONS, uid, canEdit } = ZernioCrm;

  const components = {};

  components['team-view'] = {
    setup() {
      const inviteOpen = Vue.ref(false);
      const inviteLink = Vue.ref('');
      const inviteForm = Vue.reactive({ name: '', email: '', role: 'agente' });

      const workspace = Vue.computed(() => store.workspace);
      const users = Vue.computed(() => workspace.value.users || []);
      const me = Vue.computed(() => store.currentUser);

      const roleIds = Vue.computed(() => Object.keys(ROLES));

      /** Nivel de permiso de un rol sobre un módulo para la matriz. */
      function levelOf(role, module) {
        return (PERMISSIONS[role] && PERMISSIONS[role][module]) || null;
      }

      function levelIcon(level) {
        return level === 'edit' ? 'check-circle' : level === 'view' ? 'eye' : 'x';
      }

      function levelTone(level) {
        return level === 'edit' ? 'text-emerald-700' : level === 'view' ? 'text-amber-600' : 'text-neutral-300';
      }

      /**
       * Cambia el rol de un usuario respetando jerarquía mínima:
       * admin no toca owners/admins y no asigna owner.
       */
      function changeRole(user, role) {
        const mine = me.value;
        const isPrivileged = user.role === 'owner' || user.role === 'admin' || role === 'owner' || role === 'admin';
        if (mine.role === 'admin' && isPrivileged) {
          toast('Un administrador no puede modificar roles de propietario ni crear administradores', 'error');
          return;
        }
        if (user.id === mine.id) {
          toast('No puedes cambiar tu propio rol en esta sesión de demo', 'error');
          return;
        }
        user.role = role;
        toast(`${user.name} ahora es ${ROLES[role].label.toLowerCase()}`, 'success');
      }

      /** Genera un link de invitación demo (un solo uso, 7 días). */
      function invite() {
        if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
        const token = uid('inv');
        users.value.push({
          id: uid('usr'),
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          online: false,
          invited: true,
        });
        inviteLink.value = `https://app.treborcrm.demo/join/${token} (expira en 7 días)`;
        toast('Invitación generada', 'success');
      }

      /** Copia el link de invitación (con fallback para file://). */
      async function copyLink() {
        try {
          await navigator.clipboard.writeText(inviteLink.value);
          toast('Link copiado', 'success');
        } catch {
          toast('Selecciona el link para copiarlo manualmente', 'info');
        }
      }

      function closeInvite() {
        inviteOpen.value = false;
        inviteLink.value = '';
        Object.assign(inviteForm, { name: '', email: '', role: 'agente' });
      }

      return {
        inviteOpen, inviteLink, inviteForm, workspace, users, me, roleIds,
        canEdit, levelOf, levelIcon, levelTone, changeRole, invite, copyLink, closeInvite,
        ROLES, MODULES,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Equipo</h2>
            <p class="mt-1 text-sm text-neutral-500">
              {{ users.length }} miembros · Tú eres <span class="font-semibold">{{ ROLES[me.role].label }}</span>
            </p>
          </div>
          <button v-if="canEdit('team')" @click="inviteOpen = true"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Invitar miembro
          </button>
        </header>

        <div class="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
          <!-- Usuarios -->
          <section class="overflow-x-auto border-2 border-neutral-900 bg-white">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th class="px-4 py-3">Miembro</th>
                <th class="px-4 py-3">Rol</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Permisos</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="u in users" :key="u.id" class="hover:bg-stone-50">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <ui-avatar :name="u.name"></ui-avatar>
                    <div>
                      <p class="font-semibold">
                        {{ u.name }}
                        <span v-if="u.id === me.id" class="ml-1 font-mono text-[10px] uppercase text-neutral-400">(tú)</span>
                      </p>
                      <p class="font-mono text-[11px] text-neutral-400">{{ u.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <select :value="u.role" @change="changeRole(u, $event.target.value)"
                    :disabled="!canEdit('team') || u.id === me.id"
                    class="border-2 border-neutral-300 bg-white px-2 py-2 font-mono text-[11px] uppercase tracking-wider outline-none focus:border-neutral-900 disabled:opacity-40">
                    <option v-for="r in roleIds" :key="r" :value="r">{{ ROLES[r].label }}</option>
                  </select>
                </td>
                <td class="px-4 py-3">
                  <ui-badge v-if="u.invited" variant="warn" dot>Invitado</ui-badge>
                  <ui-badge v-else variant="success" dot>{{ u.online ? 'En línea' : 'Ausente' }}</ui-badge>
                </td>
                <td class="px-4 py-3.5">
                  <p class="max-w-64 text-xs leading-snug text-neutral-500">{{ ROLES[u.role].desc }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Matriz de permisos -->
        <section class="border-2 border-neutral-900 bg-white p-6 xl:sticky xl:top-8">
          <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Matriz de permisos (RBAC)</h3>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="py-2 pr-4">Módulo</th>
                  <th v-for="r in roleIds" :key="r" class="px-3 py-2 text-center">{{ ROLES[r].label }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-for="m in MODULES" :key="m.id">
                  <td class="flex items-center gap-2 py-2.5 pr-4 font-medium">
                    <ui-icon :name="m.icon" class="h-4 w-4 text-neutral-400"></ui-icon>
                    {{ m.label }}
                  </td>
                  <td v-for="r in roleIds" :key="r" class="px-3 py-2.5 text-center">
                    <ui-icon :name="levelIcon(levelOf(r, m.id))" class="mx-auto h-4 w-4" :class="levelTone(levelOf(r, m.id))"></ui-icon>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-4 flex items-center gap-3 text-xs text-neutral-400">
            <span class="flex items-center gap-1"><ui-icon name="check-circle" class="h-3.5 w-3.5 text-emerald-700"></ui-icon> editar</span>
            <span class="flex items-center gap-1"><ui-icon name="eye" class="h-3.5 w-3.5 text-amber-600"></ui-icon> ver</span>
            <span class="flex items-center gap-1"><ui-icon name="x" class="h-3.5 w-3.5 text-neutral-300"></ui-icon> sin acceso</span>
          </p>
        </section>
        </div>

        <!-- Modal de invitación -->
        <ui-modal :open="inviteOpen" title="Invitar miembro" @close="closeInvite">
          <div v-if="!inviteLink" class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <ui-field label="Nombre">
                <input v-model.trim="inviteForm.name" type="text" placeholder="Nombre y apellido"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Correo">
                <input v-model.trim="inviteForm.email" type="email" placeholder="correo@negocio.com"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
            </div>
            <ui-field label="Rol">
              <select v-model="inviteForm.role" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                <option v-for="r in roleIds" :key="r" :value="r">{{ ROLES[r].label }} — {{ ROLES[r].desc }}</option>
              </select>
            </ui-field>
            <button @click="invite" :disabled="!inviteForm.name.trim() || !inviteForm.email.trim()"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Generar invitación
            </button>
          </div>
          <div v-else class="space-y-4">
            <p class="text-sm text-neutral-600">Comparte este link con el nuevo miembro. Es de un solo uso y expira a los 7 días (igual que los tokens de invitación de Zernio).</p>
            <div class="flex items-center gap-2">
              <input :value="inviteLink" readonly class="w-full border-2 border-neutral-300 bg-stone-50 px-3 py-2 font-mono text-xs outline-none" />
              <button @click="copyLink" class="flex shrink-0 items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="copy" class="h-3.5 w-3.5"></ui-icon> Copiar
              </button>
            </div>
            <button @click="closeInvite" class="w-full border-2 border-neutral-900 bg-neutral-900 px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Listo
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
