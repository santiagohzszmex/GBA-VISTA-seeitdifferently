-- Operational pause: preserve versions, deadline snapshots, history and reads.
-- Do not DROP the migration or restore older data on top of newer documents.
begin;
update workspace_private.upload_policy set images_enabled=false,images_all_projects=false,derivatives_enabled=false,image_project_ids='{}',revision=revision+1 where singleton;
notify pgrst,'reload schema';
commit;
