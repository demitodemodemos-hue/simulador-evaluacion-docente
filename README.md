# Simulador de Evaluación Docente - Nivel Inicial + Supabase

Aplicación para GitHub Pages con control centralizado de acceso mediante Supabase.

## Qué cambió en esta versión
- Ya no usa `data/usuarios.csv` para validar accesos.
- Los participantes se guardan en Supabase.
- Solo se permite **una sesión activa por participante**.
- La sesión envía un heartbeat cada 60 segundos.
- Si el navegador se cierra sin pulsar **Cerrar sesión**, el bloqueo caduca automáticamente después de aproximadamente 3 minutos sin actividad.
- Al pulsar **Cerrar sesión**, la sesión se libera inmediatamente.
- Los resultados de Modo Evaluación se guardan también en Supabase.
- El historial local de los últimos 10 intentos continúa disponible en el dispositivo.

## Archivos nuevos/importantes
- `supabase-setup.sql`: crea tablas y funciones seguras en Supabase.
- `data/supabase-config.js`: aquí se colocan Project URL y Publishable key.
- `app.js`: usa RPC de Supabase para login, heartbeat, logout y resultados.

## Seguridad
Las tablas `participantes` y `resultados` tienen RLS habilitado y no se conceden permisos directos al rol `anon`. El navegador solo puede ejecutar cuatro funciones RPC concretas. La **Publishable key** es pública por diseño y puede estar en GitHub Pages. **Nunca pongas una Secret key ni service_role en el repositorio.**

Este acceso sigue siendo por nombre + correo, no por contraseña. Impide dos conexiones simultáneas con la misma cuenta, pero si alguien conoce el nombre/correo podrá intentar entrar cuando esa cuenta esté libre.

## Instalación rápida
1. Crea un proyecto Free en Supabase.
2. Abre `SQL Editor`, pega todo `supabase-setup.sql` y pulsa **Run**.
3. Obtén tu **Project URL** y tu **Publishable key** desde el panel **Connect** o `Settings > API Keys`.
4. Edita `data/supabase-config.js` y reemplaza los dos textos de ejemplo.
5. Sube/reemplaza todos estos archivos en tu repositorio GitHub.
6. GitHub Pages volverá a desplegar automáticamente desde `main`.
7. Prueba el usuario inicial: Rita / pintadorita3@gmail.com.

## Agregar participantes
Desde `Supabase > SQL Editor`:

```sql
insert into public.participantes(nombre,correo)
values ('María Pérez','maria@correo.com');
```

Varios de una vez:

```sql
insert into public.participantes(nombre,correo) values
('María Pérez','maria@correo.com'),
('Juan Torres','juan@correo.com'),
('Ana Ramos','ana@correo.com');
```

## Ver quién está conectado

```sql
select id,nombre,correo,activo,session_last_seen,
       (session_last_seen > now() - interval '3 minutes') as conectado
from public.participantes
order by id;
```

## Liberar una sesión manualmente

```sql
update public.participantes
set session_token=null, session_last_seen=null
where lower(correo)=lower('correo@ejemplo.com');
```

## Ver resultados

```sql
select r.fecha,p.nombre,p.correo,r.modalidad,r.correctas,r.total,
       r.porcentaje,r.tiempo_segundos,r.escala
from public.resultados r
join public.participantes p on p.id=r.participante_id
order by r.fecha desc;
```

## Publicar en GitHub Pages
Mantén `index.html` en la raíz. En GitHub: `Settings > Pages > Deploy from a branch > main > /(root)`.

## Panel administrativo

La versión incluye `admin.html`, protegido con Supabase Auth (correo + contraseña). Desde allí puedes:

- registrar participantes;
- editar nombre/correo y habilitar o deshabilitar usuarios;
- ver quién mantiene una sesión activa y liberarla;
- consultar cantidad de intentos, mejor/último porcentaje;
- revisar resultados recientes.

### Activación inicial del administrador

1. En Supabase abre **Authentication > Users** y crea/invita el usuario administrador con correo y contraseña.
2. En **SQL Editor**, ejecuta nuevamente `supabase-setup.sql` completo para instalar las funciones administrativas.
3. Después ejecuta, reemplazando el correo:

```sql
insert into public.administradores(user_id)
select id from auth.users where lower(email)=lower('TU_CORREO_ADMIN@gmail.com')
on conflict (user_id) do nothing;
```

4. Publica `admin.html`, `admin.js` y `admin.css` junto con el resto del sitio.
5. Accede a `https://TU-USUARIO.github.io/simulador-evaluacion-docente/admin.html`.

**Importante:** nunca pongas `service_role`, `sb_secret_...` ni una contraseña de administrador dentro de GitHub. `data/supabase-config.js` solo debe contener la Project URL y la Publishable key.

## Actualización: simulacros 2025

Se incorporaron dos cuadernillos oficiales adicionales:

- **Evaluación 2025 - 01:** A01-EBRI-11, 60 preguntas.
- **Evaluación 2025 - 02:** A02-EBRI-12, 60 preguntas.

La pantalla principal ahora permite elegir entre **Evaluación 2023**, **Evaluación 2025 - 01** y **Evaluación 2025 - 02**, y para cada una iniciar **Repaso** o **Evaluación**. Los resultados guardados en Supabase incluyen el campo `simulacro`, por lo que el panel administrativo muestra a qué cuadernillo corresponde cada intento.

### Cómo actualizar tu sitio actual

1. **No reemplaces tu `data/supabase-config.js` actual**, porque allí ya tienes tu Project URL y Publishable key funcionando. En este ZIP se incluye solamente `data/supabase-config.example.js` como referencia.
2. En Supabase > SQL Editor ejecuta **solo** `supabase-migracion-2025.sql` y confirma que aparezca `Success`.
3. En GitHub reemplaza/sube los archivos del ZIP. Como el ZIP no contiene `data/supabase-config.js`, tu configuración actual permanecerá intacta.
4. Espera el nuevo despliegue de GitHub Pages y recarga la página con Ctrl+F5.
5. Verifica que aparezcan las tres tarjetas de simulacros.

El archivo `supabase-setup.sql` también quedó actualizado para instalaciones nuevas desde cero.
