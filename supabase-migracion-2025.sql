-- ACTUALIZACIÓN PARA UNA INSTALACIÓN EXISTENTE
-- Agrega soporte de resultados separados por simulacro.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.resultados
  add column if not exists simulacro text not null default '2023-A01';

create or replace function public.guardar_resultado(
  p_session_token uuid,
  p_simulacro text,
  p_modalidad text,
  p_correctas integer,
  p_incorrectas integer,
  p_sin_responder integer,
  p_total integer,
  p_porcentaje numeric,
  p_tiempo_segundos integer,
  p_escala integer,
  p_envio_automatico boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_participante_id bigint;
begin
  select id into v_participante_id from public.participantes
  where activo=true and session_token=p_session_token
    and session_last_seen > now() - interval '5 minutes';
  if v_participante_id is null then return false; end if;
  insert into public.resultados(participante_id,simulacro,modalidad,correctas,incorrectas,sin_responder,total,porcentaje,tiempo_segundos,escala,envio_automatico)
  values(v_participante_id,coalesce(nullif(trim(p_simulacro),''),'2023-A01'),p_modalidad,p_correctas,p_incorrectas,p_sin_responder,p_total,p_porcentaje,p_tiempo_segundos,p_escala,p_envio_automatico);
  update public.participantes set session_last_seen=now() where id=v_participante_id;
  return true;
end;
$$;
revoke all on function public.guardar_resultado(uuid,text,text,integer,integer,integer,integer,numeric,integer,integer,boolean) from public;
grant execute on function public.guardar_resultado(uuid,text,text,integer,integer,integer,integer,numeric,integer,integer,boolean) to anon;

drop function if exists public.admin_listar_resultados(bigint,integer);
create function public.admin_listar_resultados(p_participante_id bigint default null,p_limite integer default 100)
returns table(id bigint,fecha timestamptz,participante_id bigint,nombre text,correo text,simulacro text,modalidad text,correctas integer,incorrectas integer,sin_responder integer,total integer,porcentaje numeric,tiempo_segundos integer,escala integer,envio_automatico boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.es_administrador() then raise exception 'ADMIN_REQUIRED'; end if;
  return query select r.id,r.fecha,p.id,p.nombre,p.correo,r.simulacro,r.modalidad,r.correctas,r.incorrectas,r.sin_responder,r.total,r.porcentaje,r.tiempo_segundos,r.escala,r.envio_automatico
  from public.resultados r join public.participantes p on p.id=r.participante_id
  where p_participante_id is null or p.id=p_participante_id
  order by r.fecha desc limit greatest(1,least(coalesce(p_limite,100),500));
end;$$;
revoke all on function public.admin_listar_resultados(bigint,integer) from public;
grant execute on function public.admin_listar_resultados(bigint,integer) to authenticated;
