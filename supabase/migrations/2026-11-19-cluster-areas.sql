-- Groups the topics (clusters) of the pool into a few fixed areas.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
alter table clusters add column if not exists area text;

update clusters set area = 'Everyday Life' where name in
  ('Food & Cooking', 'Housing & Home', 'Travel & Transport', 'Health & Body', 'Everyday & Colloquial', 'Free Time & Going Out');
update clusters set area = 'People & Feelings' where name in ('Emotions & Character', 'Relationships & Social Life');
update clusters set area = 'Work & Money' where name in ('Work & Career', 'Economy & Finance');
update clusters set area = 'Society & Politics' where name in ('Politics & Society', 'Law & Crime', 'News & Media');
update clusters set area = 'Science & Technology' where name in ('Science & Research', 'Technology & Internet', 'Environment & Climate');
update clusters set area = 'Academic & Language' where name in ('Academic Writing');

select language, area, name from clusters order by language, area, name;
