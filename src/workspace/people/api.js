import { rpc } from '../ui';
export function peopleApi({unitId,projectId,areaId,deliverableId,mutate}){
 return {load:()=>rpc('workspace_members_snapshot',{p_unit_id:unitId,p_project_id:projectId || null,p_area_id:areaId || null,p_deliverable_id:deliverableId || null}),findProfile:gbaId=>rpc('workspace_find_profile',{p_unit_id:unitId,p_gba_id:gbaId}),mutate};
}
