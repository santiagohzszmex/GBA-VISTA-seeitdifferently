-- Public GBA Keynotes published from approved Workspace documents.
begin;

create table if not exists public.gba_keynotes (
  id uuid primary key default gen_random_uuid(),
  workspace_document_id uuid unique references public.gba_workspace_documents(id) on delete set null,
  slug text not null unique,
  title text not null,
  summary text not null,
  content_markdown text not null,
  keynote_date date not null,
  is_published boolean not null default true,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(summary)) between 20 and 600),
  check (char_length(trim(content_markdown)) > 0)
);

create index if not exists idx_gba_keynotes_public_date
  on public.gba_keynotes (is_published, keynote_date desc, published_at desc);

create or replace function public.gba_keynote_slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_value, ''),
      'áéíóúüñÁÉÍÓÚÜÑ',
      'aeiouunAEIOUUN')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function public.gba_workspace_publish_keynote(
  p_document_id uuid,
  p_summary text,
  p_keynote_date date
)
returns public.gba_keynotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.gba_workspace_documents%rowtype;
  v_slug text;
  v_result public.gba_keynotes;
begin
  if not public.gba_workspace_has_role('approver') then
    raise exception 'Workspace approver access required';
  end if;

  if char_length(trim(coalesce(p_summary, ''))) not between 20 and 600 then
    raise exception 'Keynote summary must contain between 20 and 600 characters';
  end if;

  if p_keynote_date is null then
    raise exception 'Keynote date is required';
  end if;

  select d.*
    into v_document
  from public.gba_workspace_documents d
  join public.gba_workspace_collections c on c.id = d.collection_id
  where d.id = p_document_id
    and c.slug = 'keynotes';

  if v_document.id is null then
    raise exception 'The selected document does not belong to the Keynotes collection';
  end if;

  if v_document.status <> 'approved' then
    raise exception 'Only approved Keynote documents can be published';
  end if;

  if char_length(trim(v_document.content_markdown)) = 0 then
    raise exception 'The Keynote document is empty';
  end if;

  select slug into v_slug
  from public.gba_keynotes
  where workspace_document_id = p_document_id;

  if v_slug is null then
    v_slug := coalesce(nullif(public.gba_keynote_slugify(v_document.title), ''), 'gba-keynote')
      || '-' || to_char(p_keynote_date, 'YYYY-MM-DD');

    if exists (
      select 1 from public.gba_keynotes
      where slug = v_slug and workspace_document_id is distinct from p_document_id
    ) then
      v_slug := v_slug || '-' || left(replace(p_document_id::text, '-', ''), 8);
    end if;
  end if;

  insert into public.gba_keynotes (
    workspace_document_id,
    slug,
    title,
    summary,
    content_markdown,
    keynote_date,
    is_published,
    published_by
  ) values (
    v_document.id,
    v_slug,
    v_document.title,
    trim(p_summary),
    v_document.content_markdown,
    p_keynote_date,
    true,
    auth.uid()
  )
  on conflict (workspace_document_id) do update set
    title = excluded.title,
    summary = excluded.summary,
    content_markdown = excluded.content_markdown,
    keynote_date = excluded.keynote_date,
    is_published = true,
    published_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  insert into public.gba_workspace_audit_log (
    action, entity_type, entity_id, metadata, actor_id
  ) values (
    'keynote_published',
    'keynote',
    v_result.id,
    jsonb_build_object(
      'workspace_document_id', p_document_id,
      'slug', v_result.slug,
      'keynote_date', p_keynote_date
    ),
    auth.uid()
  );

  return v_result;
end;
$$;

create or replace function public.gba_workspace_unpublish_keynote(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keynote_id uuid;
begin
  if not public.gba_workspace_has_role('approver') then
    raise exception 'Workspace approver access required';
  end if;

  update public.gba_keynotes
  set is_published = false, updated_at = now()
  where workspace_document_id = p_document_id
  returning id into v_keynote_id;

  if v_keynote_id is not null then
    insert into public.gba_workspace_audit_log (
      action, entity_type, entity_id, metadata, actor_id
    ) values (
      'keynote_unpublished', 'keynote', v_keynote_id,
      jsonb_build_object('workspace_document_id', p_document_id), auth.uid()
    );
  end if;
end;
$$;

alter table public.gba_keynotes enable row level security;

drop policy if exists "Published Keynotes are public" on public.gba_keynotes;
create policy "Published Keynotes are public"
on public.gba_keynotes for select
using (is_published = true or public.gba_workspace_has_role('reader'));

revoke insert, update, delete on public.gba_keynotes from anon, authenticated;
grant select on public.gba_keynotes to anon, authenticated;

revoke all on function public.gba_workspace_publish_keynote(uuid, text, date) from public, anon;
revoke all on function public.gba_workspace_unpublish_keynote(uuid) from public, anon;
grant execute on function public.gba_workspace_publish_keynote(uuid, text, date) to authenticated;
grant execute on function public.gba_workspace_unpublish_keynote(uuid) to authenticated;

commit;
