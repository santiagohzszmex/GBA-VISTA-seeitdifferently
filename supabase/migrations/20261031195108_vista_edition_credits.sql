set lock_timeout='5s';
alter table public.contenido add column edition_credits jsonb not null default '[]'::jsonb,
  add constraint contenido_edition_credits_array check (
    jsonb_typeof(edition_credits) = 'array'
    and jsonb_array_length(edition_credits) <= 80
    and octet_length(edition_credits::text) <= 32768
    and not jsonb_path_exists(edition_credits, '$[*] ? (@.type() != "object" || !exists(@.role) || !exists(@.name) || @.role.type() != "string" || @.name.type() != "string")')
  );
comment on column public.contenido.edition_credits is 'Public editorial credits: role, authorized public name, optional contribution. Existing contenido staff RLS governs writes; no private account information.';
-- Preserve only already accepted credits of the active GIMG catalogue.
update public.contenido c set edition_credits = q.credits
from (
 select subject_id,jsonb_agg(jsonb_build_object('role',role,'name',display_name,'detail','') order by credit_position,created_at) credits
 from public.vista_credits where subject_type='content' and status='accepted' and nullif(btrim(display_name),'') is not null and nullif(btrim(role),'') is not null
 group by subject_id having count(*) <= 80
) q where c.id=q.subject_id and c.catalog_origin='gimg' and c.archived_at is null;
-- No grants, RLS or retired community RPCs are changed.
