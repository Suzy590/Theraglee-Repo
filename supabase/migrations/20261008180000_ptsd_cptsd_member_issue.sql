-- The member issue "PTSD / trauma" (MEMBER_ISSUES in site/assets/lists.js,
-- the "What are you working on?" chips on the account page) is now
-- "PTSD/C-PTSD and Trauma", matching the specialty renamed in
-- 20261008170000_ptsd_cptsd_specialty.sql. Rename the saved copies so the
-- chip stays selected on existing profiles.

update public.profiles
   set issues = array_replace(issues, 'PTSD / trauma', 'PTSD/C-PTSD and Trauma')
 where issues @> array['PTSD / trauma'];
