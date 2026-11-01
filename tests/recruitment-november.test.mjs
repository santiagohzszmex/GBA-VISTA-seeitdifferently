import fs from 'node:fs';import assert from 'node:assert/strict';
import {CYCLE,LEGACY_CYCLE,TERMS_VERSION,AREAS,PRIORITY_PLACES,placeLabel,cleanAnswers,validateAnswers,SCENARIOS} from '../src/recruitment/model.js';
export async function runNovemberRecruitment(db,{first,second,director,actor,base}){
 let count=0;const eq=(a,b)=>{assert.deepEqual(a,b);count++;},bad=async(p,re)=>{await assert.rejects(p,re);count++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 await db.exec('reset role');
 const snapshot=()=>scalar("select jsonb_build_object('applications',(select jsonb_agg(to_jsonb(a) order by a.id) from public.gimg_recruitment_applications a),'reviews',(select jsonb_agg(to_jsonb(r) order by r.application_id) from public.gimg_recruitment_reviews r),'contacts',(select jsonb_agg(to_jsonb(c) order by c.application_id) from public.gimg_recruitment_contacts c))");
 const before=await snapshot();await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101193755_gimg_november_period.sql',import.meta.url),'utf8'));eq(await snapshot(),before);
 eq(await scalar('select is_open from public.gimg_recruitment_cycles where key=$1',[LEGACY_CYCLE]),false);
 const cycle=await scalar('select to_jsonb(c) from public.gimg_recruitment_cycles c where key=$1',[CYCLE]);eq(cycle.remaining_places,PRIORITY_PLACES);eq(cycle.target_places,5);eq(cycle.terms_version,TERMS_VERSION);eq(cycle.closed_areas,[]);eq(+new Date(cycle.closes_at),+new Date('2026-11-16T06:00:00Z'));
 // Local fixture clock only: the configured production dates remain unmodified.
 await db.query("update public.gimg_recruitment_cycles set opens_at=now()-interval '1 day',closes_at=now()+interval '1 day' where key=$1",[CYCLE]);
 for(const [key]of AREAS){const a=cleanAnswers({...base,area:key,secondary:'',contact_method:'email',contact_email:'fixture@example.invalid',...(key==='illustration'?{digital:'yes',illustration_role:'pieces'}:{}),...(key==='production'?{production_role:'any'}:{})});eq(validateAnswers(a),null);eq(Boolean(SCENARIOS[key]),true);eq((await scalar('select gimg_recruitment_private.validate_answers($1,true)',[Object.fromEntries(Object.entries(a).filter(([k])=>!k.startsWith('contact_')))])).area,key);}
 eq(placeLabel(cycle,'video_editing'),'1 vacante prevista');eq(placeLabel(cycle,'research'),'Registro de interés · sujeto a vacantes');
 const answers=Object.fromEntries(Object.entries(cleanAnswers({...base,area:'animation_3d',secondary:'illustration'})).filter(([key])=>!key.startsWith('contact_')));
 for(const user of [first,second,director])await db.query('insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do nothing',[user.replace('00000000-0000','10000000-0000'),user]);
 await actor(first);
 const save=(who,values={},complete=true,terms=TERMS_VERSION)=>scalar('select public.gimg_save_application_contact($1,$2,$3,null,$4,$5,$4,0)',[CYCLE,{...answers,...values},`${who}@example.invalid`,complete,terms]);
 await bad(save('first',{},true,'2026-10-08'),/condiciones/);
 await bad(scalar("select public.gimg_save_application($1,$2,'fixture@example.invalid',false,null,false,0)",[LEGACY_CYCLE,answers]),/cerrada/);
 const sent=await save('first');eq(sent.submitted,true);
 eq((await save('first',{area:'anything_invalid'})).already_submitted,true);
 await actor(second);eq(await scalar('select count(*)::int from public.gimg_recruitment_applications where id=$1',[sent.id]),0);
 const ownPath=`${second}/${CYCLE}/fixture.png`;
 await db.query("insert into storage.objects(bucket_id,name) values('gimg-recruitment',$1)",[ownPath]);count++;
 await bad(db.query("insert into storage.objects(bucket_id,name) values('gimg-recruitment',$1)",[`${first}/${CYCLE}/foreign.png`]),/row-level security/);
 await bad(db.query("insert into storage.objects(bucket_id,name) values('gimg-recruitment',$1)",[`${second}/${LEGACY_CYCLE}/closed.png`]),/row-level security/);
 await bad(save('second',{area:'invalid_area'}),/Invalid choice/);
 await bad(save('second',{sample:'file',sample_path:`${first}/${CYCLE}/foreign.png`,sample_name:'foreign.png'}),/ajeno/);
 eq((await save('second',{sample:'file',sample_path:ownPath,sample_name:'fixture.png'})).submitted,true);
 await actor(director);eq(await scalar('select count(*)::int from public.gimg_recruitment_applications where cycle_key=$1 and phase=\'submitted\'',[CYCLE]),2);
 // Fill only the local new cohort. Verify the cycle cap without counting old selections.
 await db.exec('reset role');await db.query("insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'nov-local-1@example.invalid',jsonb_build_object('nombre','nov-local-1')),(gen_random_uuid(),'nov-local-2@example.invalid',jsonb_build_object('nombre','nov-local-2'))");const ids=(await db.query('select id from auth.users where id<>$1 and id<>$2 limit 4',[first,second])).rows.map(x=>x.id);
 for(let i=0;i<ids.length;i++){const app=await scalar("insert into public.gimg_recruitment_applications(cycle_key,user_id,handle,display_name,answers,phase) values($1,$2,$3,'Fixture',$4,'submitted') returning id",[CYCLE,ids[i],`local-${i}`,{...answers,area:'animation_2d'}]);await db.query('insert into public.gimg_recruitment_reviews(application_id) values($1)',[app]);}
 const apps=(await db.query('select id from public.gimg_recruitment_applications where cycle_key=$1 order by id',[CYCLE])).rows;
 await actor(director);for(const a of apps.slice(0,5))await scalar('select public.gimg_review_application($1,$2,0)',[a.id,{published:true,decision:'accepted',assigned_role:'Colaboración visual'}]);
 await bad(scalar('select public.gimg_review_application($1,$2,0)',[apps[5].id,{published:true,decision:'accepted'}]),/Cupo/);
 await db.exec('reset role');eq(await scalar('select count(*)::int from public.gimg_recruitment_applications where cycle_key=$1',[LEGACY_CYCLE]),before.applications.filter(a=>a.cycle_key===LEGACY_CYCLE).length);
 console.log(`PASS: ${count} November intake checks: new profiles, consent, old records, per-cycle cap, own uploads and denial.`);return count;
}
