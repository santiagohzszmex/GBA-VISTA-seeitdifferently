-- Explicit rollback only: restores the previous broader U reads.
-- This widens access. Prefer fixing a missing project assignment instead.
begin;
update workspace_private.role_permissions set mode='U' where role='gimg_workspace_coordinator' and permission in('project.read','task.read','content.read');
commit;
