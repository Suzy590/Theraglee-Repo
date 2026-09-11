-- =============================================================================
-- Psychology board lookups for the states that keep a separate board.
-- -----------------------------------------------------------------------------
-- In 35 states the `behavioral_health` row already covers psychologists,
-- because the lookup is statewide (California's DCA search, Ohio's eLicense,
-- Texas's BHEC, and so on). In the 15 states below the counselor board runs
-- its own site and psychologists are licensed by a different board with a
-- different lookup. Each of these rows is that board, under profession
-- `psychology`.
--
-- The admin license queue (site/admin.html) uses a state's `psychology` row
-- for a therapist whose license type is PsyD, PhD or EdD, and otherwise the
-- `behavioral_health` row. A state with no `psychology` row falls back to its
-- `behavioral_health` row for everyone, which is right for the 35 statewide
-- lookups.
--
-- Every verify_url was opened and checked on 2026-09-11. As with the other
-- rows, api_url stays null and automatable false.
--
-- Re-running is harmless: the upsert refreshes a row that already exists and
-- keeps its id.
-- =============================================================================

insert into public.state_boards (state, profession, board_name, verify_url, notes)
values
  ('AL', 'psychology', 'Alabama Board of Examiners in Psychology',
   'https://apps.psychology.alabama.gov/public/licensee.aspx',
   'Licensed psychologists and psychological technicians. Board site: https://psychology.alabama.gov/'),
  ('AZ', 'psychology', 'Arizona Board of Psychologist Examiners',
   'https://abpe.portalus.thentiacloud.net/webs/portal/register/',
   'The board calls this directory its only verification of licensure. Board site: https://psychboard.az.gov/directory-licensee-search'),
  ('AR', 'psychology', 'Arkansas Psychology Board',
   'https://psychologyboard.arkansas.gov/licensees/',
   'Use the License Search and Verification link. Also on Arkansas.gov: https://portal.arkansas.gov/service/ar-psychologiest-provider-search/'),
  ('KY', 'psychology', 'Kentucky Board of Examiners of Psychology',
   'https://psy.ky.gov/',
   'Use the Verify a License link. Licensed psychologists, psychological practitioners and psychological associates.'),
  ('LA', 'psychology', 'Louisiana State Board of Examiners of Psychologists',
   'https://lsbep.org/verifications/',
   'Free search of current and former licensees; the board also sells an official verification letter.'),
  ('MD', 'psychology', 'Maryland Board of Examiners of Psychologists',
   'https://mdbnc.health.maryland.gov/psychverification/',
   'Search by last name or license number. The board treats this page as the primary source.'),
  ('MN', 'psychology', 'Minnesota Board of Psychology',
   'https://mn.gov/boards/psychology/public/verifications/',
   'LP and LBA. Free online lookup by name or license number.'),
  ('MS', 'psychology', 'Mississippi Board of Psychology',
   'https://www.msbop.ms.gov/secure/licensesearch.asp',
   'Board site: https://www.psychologyboard.ms.gov/'),
  ('NV', 'psychology', 'Nevada Board of Psychological Examiners',
   'https://www.psyexam.nv.gov/licensing/nevada-license-look-up/',
   'The board treats its online directory as primary source verification.'),
  ('NC', 'psychology', 'North Carolina Psychology Board',
   'https://www.ncpsychologyboard.org/',
   'Use the License Verification link under Resources. Free web verification.'),
  ('ND', 'psychology', 'North Dakota State Board of Psychologist Examiners',
   'https://www.ndsbpe.org/verify/',
   'Licensee search by name.'),
  ('OK', 'psychology', 'Oklahoma State Board of Examiners of Psychologists',
   'https://oklahoma.gov/psychology/public.html',
   'Use the Psychologist Search link. The board says the public search is informational; a paid primary-source verification is separate.'),
  ('SD', 'psychology', 'South Dakota Board of Examiners of Psychologists',
   'https://www.sdboards.org/dss/psych/verify/',
   'Search by name or certificate number, or download the full roster.'),
  ('WV', 'psychology', 'West Virginia Board of Examiners of Psychologists',
   'https://psychbd.wv.gov/license-info/license-search/',
   'Licensed psychologists and supervised psychologists.'),
  ('WY', 'psychology', 'Wyoming Board of Psychology',
   'https://psychology.wyo.gov/public/lookup',
   'The board calls this lookup a primary source; it is updated twice a month.')
on conflict (state, profession) do update
  set board_name = excluded.board_name,
      verify_url = excluded.verify_url,
      notes      = excluded.notes;
