-- The specialty "Trauma and PTSD" is now "PTSD/C-PTSD and Trauma" in
-- site/assets/lists.js, which both the therapist listing and the member's
-- Match Mode topics read from. Rename the saved copies so existing listings
-- and topics keep matching the new label.

update public.therapist_profiles
   set specialties     = array_replace(specialties,     'Trauma and PTSD', 'PTSD/C-PTSD and Trauma'),
       top_specialties = array_replace(top_specialties, 'Trauma and PTSD', 'PTSD/C-PTSD and Trauma')
 where specialties @> array['Trauma and PTSD'] or top_specialties @> array['Trauma and PTSD'];

update public.profiles
   set match_topics = array_replace(match_topics, 'Trauma and PTSD', 'PTSD/C-PTSD and Trauma')
 where match_topics @> array['Trauma and PTSD'];
