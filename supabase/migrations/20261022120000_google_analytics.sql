-- Google Analytics, as configuration.
--
-- The admin screen's Google Analytics tab (/admin.html#analytics) keeps three
-- settings here. The measurement id and the switch decide whether the pages
-- load Google's tag (site/assets/analytics-tag.js, placed by chrome() in
-- site/assets/app.js); the property id tells the google-analytics Edge
-- Function which GA4 property to read the reports from. The service account
-- key that reads them is a Supabase secret (GA_SERVICE_ACCOUNT_JSON), never a
-- row here. docs/google-analytics.md is the guide.
--
-- The switch starts off: the privacy policy says the site runs no third-party
-- analytics, and it has to say otherwise before the tag goes on the pages.
insert into public.app_config (key, value) values
  ('ga_measurement_id', ''),       -- G-XXXXXXXXXX, from the web data stream
  ('ga_property_id',    ''),       -- the numeric GA4 property id, for the reports
  ('ga_tag_enabled',    'false')   -- the switch: load the tag on every page
on conflict (key) do nothing;
