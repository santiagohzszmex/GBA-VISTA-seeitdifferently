-- Stop new writes; preserve read RPCs, guards, data and R2 cleanup.
begin;
update workspace_private.upload_policy set image_project_ids='{}',images_enabled=false,derivatives_enabled=false,revision=revision+1 where singleton;
notify pgrst,'reload schema';
commit;
