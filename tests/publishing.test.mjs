import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { youtubeId, videoPayload, validateEditionRelease } from '../src/utils/publishing.js';
import { getGimgPremiereState } from '../src/utils/editionRelease.js';
import { isVideoContent } from '../src/utils/contentTypes.js';

let checks = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const rejects = (action, pattern) => { assert.throws(action, pattern); checks++; };
const id = 'jcNTzTD-zI0';
for (const value of [id, `https://www.youtube.com/watch?v=${id}&t=12`, `https://youtu.be/${id}?si=abc`, `https://youtube.com/shorts/${id}`, `https://m.youtube.com/watch?v=${id}`, `https://youtube.com/live/${id}`, `https://youtube-nocookie.com/embed/${id}`]) equal(youtubeId(value), id);
for (const value of ['', 'abc', `https://youtube.com.evil.invalid/watch?v=${id}`, `javascript:alert('${id}')`, `https://evil.invalid/${id}`, `https://youtube.com/watch?v=${id}extra`]) equal(youtubeId(value), '');
const form = { titulo: ' Tutorial de naciones ', youtube_id: `https://youtu.be/${id}`, trailer_id: '', sello_editorial: ' Canal del servidor ', banner_url: '', poster_url: '', generos: ' Tutoriales, Naciones, ', es_comunidad: true, categoria: 'Tutorial' };
const payload = videoPayload(form);
equal(payload.youtube_id, id); equal(payload.sello_editorial, 'Canal del servidor'); equal(payload.es_comunidad, true);
equal(payload.generos, ['Tutoriales','Naciones']); equal(payload.poster_url, `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
equal(videoPayload({...form,banner_url:'https://images.invalid/banner.jpg'}).poster_url,'https://images.invalid/banner.jpg');
rejects(() => videoPayload({...form,sello_editorial:' '}), /canal, autor/i);
rejects(() => videoPayload({...form,youtube_id:'bad'}), /YouTube/);
rejects(() => videoPayload({...form,trailer_id:'bad'}), /tráiler/);
equal(isVideoContent({categoria:'Tutorial'}),true); equal(isVideoContent({categoria:'Video'}),true); equal(isVideoContent({categoria:'Periódico'}),false);

const now = Date.parse('2030-01-01T00:00:00Z');
const future = '2030-01-02T00:00:00Z';
const cover = getGimgPremiereState({publicar_at:future}, now);
equal(cover.coverAnnouncement,true); equal(cover.hasPremiere,false); equal(cover.editionReleased,false); equal(cover.canOpen,true);
equal(getGimgPremiereState({publicar_at:future},Date.parse(future)).editionReleased,true);
equal(getGimgPremiereState({publicar_at:future},Date.parse(future)).isPremierePhase,false);
const scheduledVideo = {publicar_at:future,gimg_video_url:'https://video.invalid/premiere.mp4',gimg_video_estreno_at:'2030-01-01T12:00:00Z'};
equal(getGimgPremiereState(scheduledVideo,now).canOpen,false); equal(getGimgPremiereState(scheduledVideo,now).coverAnnouncement,false);
equal(getGimgPremiereState(scheduledVideo,Date.parse('2030-01-01T13:00:00Z')).videoReleased,true);
equal(getGimgPremiereState(scheduledVideo,Date.parse(future)).editionReleased,true);
equal(getGimgPremiereState({publicar_at:null},now).editionReleased,true);
equal(validateEditionRelease('cover',{publicar_at:future},false,now),undefined);
rejects(() => validateEditionRelease('cover',{publicar_at:''},false,now), /fecha futura/);
rejects(() => validateEditionRelease('cover',{publicar_at:'2029-12-31'},false,now), /fecha futura/);
rejects(() => validateEditionRelease('video',scheduledVideo,false,now), /Adjunta el video/);
rejects(() => validateEditionRelease('video',{...scheduledVideo,gimg_video_estreno_at:''},true,now), /fecha y hora/);
rejects(() => validateEditionRelease('video',{...scheduledVideo,gimg_video_estreno_at:future},true,now), /antes/);
equal(validateEditionRelease('video',scheduledVideo,true,now),undefined);
equal(validateEditionRelease('now',{publicar_at:''},false,now),undefined);

const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
create table public.contenido(id uuid primary key,titulo text,descripcion text,poster_url text,banner_url text,sello_editorial text,vistas bigint,likes_count bigint,estado_publicacion text,gimg_video_url text,gimg_video_portada_url text,gimg_video_titulo text,gimg_video_descripcion text,gimg_video_estreno_at timestamptz,publicar_at timestamptz);
insert into public.contenido(id,titulo,poster_url,banner_url,estado_publicacion,publicar_at) values
('00000000-0000-0000-0000-000000000001','Cover','https://images.invalid/cover.jpg','https://images.invalid/cover.jpg','aprobado',now()+interval '1 day'),
('00000000-0000-0000-0000-000000000002','Video','https://images.invalid/private.jpg','https://images.invalid/private.jpg','aprobado',now()+interval '1 day'),
('00000000-0000-0000-0000-000000000003','Pending','https://images.invalid/pending.jpg',null,'pendiente',null);
update public.contenido set gimg_video_url='https://video.invalid/native.mp4',gimg_video_estreno_at=now()+interval '1 hour' where id='00000000-0000-0000-0000-000000000002';`);
await db.exec(await readFile(new URL('../supabase/migrations/20261003141943_edition_cover_announcements.sql',import.meta.url),'utf8'));
await db.exec('set role anon;');
const preview = async n => (await db.query(`select * from public.vista_public_edition_preview('00000000-0000-0000-0000-00000000000${n}')`)).rows[0];
equal((await preview(1)).poster_url,'https://images.invalid/cover.jpg');
equal((await preview(1)).has_gimg_premiere,false); equal((await preview(1)).gimg_video_url,null);
equal((await preview(2)).poster_url,null); equal((await preview(2)).gimg_video_url,null);
equal(await preview(3),undefined);
await db.exec("reset role; update public.contenido set gimg_video_estreno_at=now()-interval '1 hour' where id='00000000-0000-0000-0000-000000000002'; set role anon;");
equal((await preview(2)).gimg_video_url,'https://video.invalid/native.mp4'); equal((await preview(2)).poster_url,null);
await db.exec("reset role; update public.contenido set publicar_at=now()-interval '1 minute' where id='00000000-0000-0000-0000-000000000002'; set role authenticated;");
equal((await preview(2)).poster_url,'https://images.invalid/private.jpg');
equal(Object.keys(await preview(1)).includes('paginas_i18n'),false);
await db.close();
console.log(`PASS: ${checks} checks for YouTube links, creator attribution, thumbnails, scheduled covers, video premieres and public preview permissions.`);
