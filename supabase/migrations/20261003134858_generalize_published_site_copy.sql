begin;

-- Generalize platform announcements; preserve all newspaper and news content.
-- Keep the current Workspace source in sync so republishing a Keynote cannot
-- restore the old server-specific copy. Document revision history is untouched.
do $$
declare v_news_before text; v_news_after text;
begin
  select md5(coalesce(string_agg(to_jsonb(c)::text, '' order by c.id), ''))
    into v_news_before from public.contenido c;

  update public.campanias
  set titulo=regexp_replace(titulo, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      descripcion=regexp_replace(descripcion, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      updated_at=now()
  where coalesce(titulo,'') ~* 'empyria' or coalesce(descripcion,'') ~* 'empyria';

  update public.gba_workspace_documents d
  set title=regexp_replace(d.title, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      content_markdown=regexp_replace(d.content_markdown, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      updated_at=now()
  where exists(select 1 from public.gba_keynotes k where k.workspace_document_id=d.id)
    and (d.title ~* 'empyria' or d.content_markdown ~* 'empyria');

  update public.gba_keynotes
  set title=regexp_replace(title, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      summary=regexp_replace(summary, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      content_markdown=regexp_replace(content_markdown, 'Empyria', 'los servidores geopolíticos de Minecraft', 'gi'),
      updated_at=now()
  where title ~* 'empyria' or summary ~* 'empyria' or content_markdown ~* 'empyria';

  select md5(coalesce(string_agg(to_jsonb(c)::text, '' order by c.id), ''))
    into v_news_after from public.contenido c;
  if v_news_before is distinct from v_news_after then
    raise exception 'Newspaper and news content must be preserved';
  end if;
end;
$$;

commit;
