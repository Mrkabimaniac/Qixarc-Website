begin;

create table public.qixarc_site_settings (
  key text primary key,
  payload jsonb not null,
  revision integer not null default 1 check (revision > 0),
  constraint site_setting_type check (
    case key
      when 'launch' then jsonb_typeof(payload) = 'object'
        and payload ?& array['early', 'full']
        and jsonb_typeof(payload->'early') = 'string'
        and jsonb_typeof(payload->'full') = 'string'
        and (payload->>'early')::timestamptz < (payload->>'full')::timestamptz
        and octet_length(payload::text) < 256
      when 'team' then case when jsonb_typeof(payload) = 'array'
        then jsonb_array_length(payload) between 1 and 24
          and octet_length(payload::text) < 65536
        else false end
      else false
    end
  )
);

alter table public.qixarc_site_settings enable row level security;
revoke all on public.qixarc_site_settings from anon, authenticated;
grant select on public.qixarc_site_settings to anon, authenticated;
grant insert (key, payload), update (payload, revision) on public.qixarc_site_settings to authenticated;

create policy "Public website settings are readable"
on public.qixarc_site_settings for select to anon, authenticated using (true);

create policy "Admins can create website settings"
on public.qixarc_site_settings for insert to authenticated
with check (exists (
  select 1 from public.qixarc_admins where user_id = (select auth.uid())
));

create policy "Admins can update website settings"
on public.qixarc_site_settings for update to authenticated
using (exists (
  select 1 from public.qixarc_admins where user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.qixarc_admins where user_id = (select auth.uid())
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qixarc-team-photos', 'qixarc-team-photos', true, 524288, array['image/webp']);

-- Public portrait downloads use the Storage public-object endpoint.
create policy "Admins can upload team portraits"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'qixarc-team-photos'
  and name ~ '^[0-9a-f-]{36}\.webp$'
  and exists (
    select 1 from public.qixarc_admins where user_id = (select auth.uid())
  )
);

commit;
