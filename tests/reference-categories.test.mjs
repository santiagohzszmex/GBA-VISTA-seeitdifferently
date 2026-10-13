import assert from 'node:assert/strict';
import { REFERENCE_CATEGORY_GROUPS, referenceCategoryGroups } from '../src/workspace/referenceCategories.js';

const now = Date.parse('2026-10-12T12:00:00Z');
const groups = referenceCategoryGroups({
  kind:'instructions', area:{id:'research-area',specialty:'research'}, projectId:'edition', now,
  assignments:[
    {project_id:'edition',area_id:'research-area',assignment_role:'photography',starts_at:'2026-10-01T00:00:00Z',expires_at:'2026-11-01T00:00:00Z'},
    {project_id:'edition',area_id:'research-area',assignment_role:'qa',starts_at:'2026-10-13T00:00:00Z'},
    {project_id:'edition',area_id:'research-area',assignment_role:'production',expires_at:'2026-10-11T00:00:00Z'},
    {project_id:'another-edition',area_id:'research-area',assignment_role:'design'},
  ],
});
const ids = groups.map(group=>group.id);
assert(ids.includes('research'),'keep the broad area specialty');
assert(ids.includes('photo'),'include current photography role alongside research');
assert(!ids.includes('qa') && !ids.includes('production') && !ids.includes('design'),'ignore future, expired, and other-edition assignments');
assert.deepEqual(referenceCategoryGroups({kind:'instructions',area:null,allowAll:true}).map(group=>group.id),REFERENCE_CATEGORY_GROUPS.map(group=>group.id),'global instructions can use all categories');
assert.deepEqual(referenceCategoryGroups({kind:'instructions',area:null,allowAll:false}).map(group=>group.id),['general'],'area-only writers get only general categories for global scope');
assert.deepEqual(referenceCategoryGroups({kind:'concept',area:{specialty:'research'}}).map(group=>group.id),['general'],'creative reference types are not given area categories');
console.log('PASS: reference categories follow current area specialties and assignments without changing scope permissions.');
