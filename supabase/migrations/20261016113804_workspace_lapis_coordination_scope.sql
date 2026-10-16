-- Lapislázuli 1a: Coordinación operates only in assigned projects (RBAC P).
-- Membership/directory permissions remain U. No grants or assignments are added.
begin;
update workspace_private.role_permissions set mode='P'
where role='gimg_workspace_coordinator' and permission in('project.read','task.read','content.read');
commit;
