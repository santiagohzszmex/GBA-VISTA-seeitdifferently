# Development studios in VISTA Network

Studios are free organizations registered by authenticated GBA IDs. Their profiles include a description, Cloudinary logo/cover, optional website/Discord/support link, portfolio and confirmed collaborators. They are distinct from newspaper editorials and from paid GBA Partners placements.

- `/?workspace=studios` opens registration and management. Editorial Studio and Network also expose this entry.
- `/?studio=<slug>` opens the authenticated public profile; the slug remains stable after renaming.
- Network lists studios and approved servers. A server can credit an individual GBA ID or one studio.
- Server access supports a direct IP, a modpack link or an invitation/application URL, with optional instructions. Support links point to external services; VISTA does not collect these payments.

## Team and consent

| Permission | Capabilities |
| --- | --- |
| Owner | Edit profile/portfolio/ranks, invite/manage all other members, transfer ownership |
| Administrator | Edit profile/portfolio/ranks, manage editors and collaborators |
| Profile editor | Edit profile, portfolio and rank labels; no permission management |
| Collaborator | View team, open profiles, leave the organization |

Custom rank labels (director, programmer, designer, etc.) are independent of permissions. Renaming a rank updates its assigned members in the same transaction. A rank in use cannot be deleted before reassignment.

Invitations appear in notifications and the studio workspace. A person must accept before appearing as a public collaborator. Owner permission cannot be removed through the regular member editor; ownership can be transferred only to an active member. Each person uses their own GBA ID. No global GBA roles are changed.

An administrator can attribute a studio they manage to a server they manage. Linking an already accepted studio does not give its members access to server administration. Another person's developer attribution requires their acceptance. Hidden profiles omit personal names and profile links; studio participation does not expose private Discord contact or account data. Existing content credits remain handled by the existing confirmed-credit system.

## Data and moderation

`development_studios` and `development_studio_members` have RLS enabled and direct client privileges revoked. Private helper functions live in `vista_studios_private`, which authenticated clients cannot access. Authenticated RPC entrypoints validate ownership, membership, consent and URLs; privileged functions use fixed search paths. Anonymous execution is revoked. Mothership can hide and restore studio profiles and see proposed server authorship.

Limits: 10 studios per account, 100 active/pending members per studio, 30 ranks and 30 portfolio projects. Profile, cover and project images reuse the existing Cloudinary upload component and validate supported types and size. Failed saves keep the draft and already uploaded image URLs for retry.

Paid hero/directory agreements continue to require an approved server, confirmed payment, positive agreed amount and a defined term. Studio registration activates no fees or sponsorship.

## Validation

`npm run test:studios` runs real SQL against a temporary PGlite database: registration, permissions, invitation acceptance/rejection, ownership transfer, rank renaming, private profile handling, moderation, attribution consent, access/support metrics and legacy listings. Existing network, social, session and publishing tests also pass. Browser verification uses a separate temporary SQL database, including a second collaborator account, mobile layout and dark appearance. Production smoke tests run inside rolled-back transactions and leave no example studios or servers.

Supabase advisors report the intentional authenticated SECURITY DEFINER RPC surface and RLS tables without direct policies: these tables have no direct client grants and every API action is scoped and guarded. The project's unrelated pre-existing advisor findings are retained for a separate review; this change does not claim to resolve them.
