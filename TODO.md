# ExecOps - TODO

> Versión actual: v0.01a · Última actualización: 2026-04-21

---

## 🔴 Bugs y problemas pendientes

### Críticos
- [ ] **Ansible no persiste entre despliegues**: Ansible se instala via `pip` en el contenedor. Si se reinicia el entorno, hay que reinstalarlo. Necesitar un `Dockerfile` o script de bootstrap.
- [ ] **Caché de módulos se pierde al reiniciar**: El caché en memoria (`moduleCache`) de la API de módulos se pierde al reiniciar Next.js. La primera carga tras reinicio tarda ~10s por `ansible-doc -F`.

### Menores
- [ ] **Colecciones sin módulos no aparecen**: `cyberark.conjur` y `community.library_inventory_filtering_v1` tienen plugins (lookup, doc_fragments) pero no módulos, así que no se muestran en la lista. Podrían mostrarse con un badge "Solo plugins".
- [ ] **Colores de colecciones se repiten**: Con 92 colecciones y 35 colores, algunos colores se repiten 2-3 veces. Se podría usar hash del nombre para colores más únicos.

---

## 🟡 Funcionalidades que existen pero necesitan mejora

### Editor de Playbooks
- [ ] **Validación de YAML**: El editor Monaco no valida que el YAML sea válido. Ansible dará error al ejecutar pero no hay feedback previo.
- [ ] **Autocompletado de módulos**: El editor no tiene autocompletado de módulos/tasks de Ansible (ej: escribir `ansible.builtin.` y sugerir `copy`, `apt`, `file`...).
- [ ] **Lint de playbooks**: No hay integración con `ansible-lint` para detectar malas prácticas.
- [ ] **Syntax check**: No hay un botón de "Verificar sintaxis" antes de ejecutar.

### Inventario
- [ ] **Validación del inventario**: No se verifica que el INI sea válido para Ansible antes de guardar.
- [ ] **Soporte para inventario YAML**: Ansible soporta inventarios en YAML además de INI, pero la UI solo maneja INI.
- [ ] **Test de conexión**: No hay botón para verificar que los hosts del inventario son alcanzables (`ansible -m ping`).

### Ejecuciones
- [ ] **Re-ejecutar playbook**: No hay botón para re-ejecutar un playbook directamente desde el historial de ejecuciones.
- [ ] **Cancelar ejecución**: El botón de abortar ejecución no está implementado (el flag `abortController` existe pero no se usa).
- [ ] **Exportar logs**: No se pueden descargar los logs de una ejecución como archivo .txt o .log.

### Módulos
- [ ] **Documentación de módulos**: Al hacer clic en un módulo no se muestra su documentación. Podría usarse `ansible-doc <modulo>` para mostrar la ayuda.
- [ ] **Desinstalar colecciones**: Se puede instalar pero no desinstalar colecciones desde la UI.
- [ ] **Actualizar colecciones**: No hay botón para actualizar colecciones a su última versión.

### Plantillas
- [ ] **Crear plantillas personalizadas**: No se pueden crear nuevas plantillas desde la UI (solo desde el filesystem).
- [ ] **Editar plantillas originales**: Las plantillas son de solo lectura. Podría permitirse editarlas.

### Dashboard
- [ ] **Gráficos de tendencias**: No hay gráficos históricos de ejecuciones (éxito/fallo por día).
- [ ] **Uptime formateado**: El uptime se muestra en segundos sin formatear a días/horas/minutos.

---

## 🟢 Funcionalidades futuras (no implementadas)

### Alta prioridad
- [ ] **Autenticación**: Implementar login con next-auth (ya instalado). Soporte para LDAP/Active Directory.
- [ ] **Dark mode**: next-themes ya está instalado pero no integrado.
- [ ] **Roles de Ansible**: Soporte para crear, editar y gestionar roles (no solo playbooks planos).
- [ ] **Ejecución remota via SSH**: Actualmente solo `connection: local`. Permitir ejecutar en hosts remotos con credenciales SSH configuradas.
- [ ] **Variables y vault**: Gestión de variables encriptadas con `ansible-vault`.

### Media prioridad
- [ ] **Cola de ejecuciones**: Permitir encolar múltiples playbooks y ejecutarlos secuencialmente.
- [ ] **Ejecución paralela en múltiples hosts**: Mostrar progreso por host cuando hay varios.
- [ ] **Base de datos**: Migrar de filesystem a Prisma + SQLite para mejor persistencia y búsqueda.
- [ ] **Git integration**: Versionado de playbooks con git (commit, diff, rollback).
- [ ] **Notificaciones**: Alertas por email/webhook cuando una ejecución falla.
- [ ] **Scheduled executions**: Ejecutar playbooks en horarios (cron-like).

### Baja prioridad
- [ ] **Multi-idioma**: La UI está en español. Podría soportar inglés y otros idiomas.
- [ ] **API REST completa**: Documentar la API con OpenAPI/Swagger.
- [ ] **CLI tool**: Command-line tool para gestionar playbooks sin la UI.
- [ ] **Export/Import**: Exportar/importar playbooks, inventarios y ejecuciones como ZIP.
- [ ] **Webhooks**: Recibir webhooks de GitLab/GitHub para ejecutar playbooks automáticamente.
- [ ] **Containerización**: Crear un Dockerfile oficial con Ansible pre-instalado.
- [ ] **Logs en tiempo real (WebSocket)**: Migrar de SSE a WebSocket para mejor bidireccionalidad.
- [ ] **Editor de roles visual**: Drag & drop para construir roles de Ansible.
- [ ] **Inventory plugins**: Soporte para inventarios dinámicos (AWS EC2, VMware, etc.).
- [ ] **Integración con ARA (Ansible Run Analysis)**: Visualización avanzada de resultados de playbooks.
- [ ] **RBAC**: Control de acceso basado en roles (admin, viewer, operator).

---

## ✅ Funcionalidades implementadas y funcionando

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Dashboard con estadísticas | ✅ | Playbooks, ejecuciones, info del sistema |
| Info del sistema en tiempo real | ✅ | Hostname, SO, kernel, RAM, CPU, uptime |
| CRUD de playbooks | ✅ | Crear, editar, ver, eliminar |
| Editor Monaco YAML | ✅ | Resaltado de sintaxis completo |
| Visor de código (fullscreen) | ✅ | Solo lectura con Monaco Editor |
| Ejecución con streaming SSE | ✅ | stdout/stderr en tiempo real |
| Autoscroll en ejecución | ✅ | Scroll automático durante la ejecución |
| Detección de cambios sin guardar | ✅ | Alerta beforeunload |
| 10 plantillas predefinidas | ✅ | System, Dev, Security, Monitoring, Web, General |
| Visor de código de plantillas | ✅ | Fullscreen con Monaco |
| Editor de inventario (INI) | ✅ | Monaco Editor con resaltado |
| Parseo automático de inventario | ✅ | Hosts y grupos detectados |
| Explorador de módulos | ✅ | 9,712 módulos en 92 colecciones |
| Filtro por colección | ✅ | 92 chips de colores |
| Búsqueda de módulos | ✅ | Por nombre o colección |
| Instalar colecciones | ✅ | Desde la UI via ansible-galaxy |
| Historial de ejecuciones | ✅ | Tabla con estado, fecha, duración |
| Visor de logs (fullscreen) | ✅ | Terminal oscura con scroll |
| Interfaz responsiva | ✅ | Mobile-first con breakpoints |
| Animaciones (Framer Motion) | ✅ | Transiciones y micro-interacciones |
| 11 endpoints API REST | ✅ | Facts, Playbooks, Templates, Inventory, Modules, Install, Executions |

---

## 📊 Progreso estimado

```
Funcionalidades completadas:    ████████████████░░░░░  70%
Mejoras pendientes:             ██████░░░░░░░░░░░░░░░  30%
Funcionalidades futuras:        ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## 📝 Notas técnicas

- **Runtime**: Bun + Next.js 16 (App Router) + React 19
- **Ansible**: Core 2.20.4 instalado via pip en `~/.local/bin/`
- **Almacenamiento**: Filesystem (`ansible/`) — sin base de datos
- **Editor**: Monaco Editor (CDN) para YAML e INI
- **Streaming**: Server-Sent Events para ejecución de playbooks
- **Caché**: Módulos cacheados 5 min en memoria del servidor
