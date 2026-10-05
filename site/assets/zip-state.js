/* Which state a US zip code is in, by its first three digits.
   -----------------------------------------------------------------------------
   The Find a therapist page (therapists.html) uses this to turn the zip code a
   visitor types into a state, so a telehealth search can cover the whole state
   the visitor lives in, and to say which state that is. The same table lives in
   the database as public.zip_state(text) (migration
   therapist_search_by_zip_and_delivery), which search_therapists uses so a
   caller that passes only a zip code gets the same answer;
   tests/zip-state/check.mjs makes sure the two copies agree.

   Each row is a range of three-digit prefixes and the state they belong to,
   from the USPS sectional center assignments. Military (090-098, 340,
   962-966) and territory (006-009) prefixes are left out on purpose: the
   directory lists therapists by US state, so those zip codes are "unknown"
   here and the page asks for a different one. */

export const ZIP_STATE_RANGES = [
  ['005','005','NY'],
  ['010','027','MA'],
  ['028','029','RI'],
  ['030','038','NH'],
  ['039','049','ME'],
  ['050','054','VT'],
  ['055','055','MA'],
  ['056','059','VT'],
  ['060','069','CT'],
  ['070','089','NJ'],
  ['100','149','NY'],
  ['150','196','PA'],
  ['197','199','DE'],
  ['200','200','DC'],
  ['201','201','VA'],
  ['202','205','DC'],
  ['206','219','MD'],
  ['220','246','VA'],
  ['247','268','WV'],
  ['270','289','NC'],
  ['290','299','SC'],
  ['300','319','GA'],
  ['320','339','FL'],
  ['341','349','FL'],
  ['350','369','AL'],
  ['370','385','TN'],
  ['386','397','MS'],
  ['398','399','GA'],
  ['400','427','KY'],
  ['430','459','OH'],
  ['460','479','IN'],
  ['480','499','MI'],
  ['500','528','IA'],
  ['530','549','WI'],
  ['550','567','MN'],
  ['569','569','DC'],
  ['570','577','SD'],
  ['580','588','ND'],
  ['590','599','MT'],
  ['600','629','IL'],
  ['630','658','MO'],
  ['660','679','KS'],
  ['680','693','NE'],
  ['700','714','LA'],
  ['716','729','AR'],
  ['730','731','OK'],
  ['733','733','TX'],
  ['734','749','OK'],
  ['750','799','TX'],
  ['800','816','CO'],
  ['820','831','WY'],
  ['832','839','ID'],
  ['840','847','UT'],
  ['850','865','AZ'],
  ['870','884','NM'],
  ['885','885','TX'],
  ['889','898','NV'],
  ['900','961','CA'],
  ['967','968','HI'],
  ['970','979','OR'],
  ['980','994','WA'],
  ['995','999','AK'],
];

/* The five digits of a zip code, or '' when the text does not start with
   five digits once everything but digits is dropped ("90210-1234" is fine). */
export function zipDigits(text) {
  const digits = String(text || '').replace(/\D/g, '');
  return /^\d{5}/.test(digits) ? digits.slice(0, 5) : '';
}

/* The two-letter state a zip code belongs to, or '' when it is not a
   five-digit zip code in one of the fifty states or DC. */
export function zipState(text) {
  const zip = zipDigits(text);
  if (!zip) return '';
  const prefix = zip.slice(0, 3);
  const row = ZIP_STATE_RANGES.find(([lo, hi]) => prefix >= lo && prefix <= hi);
  return row ? row[2] : '';
}

/* The zip code area a search for in-person sessions covers: every zip code
   that starts with the same three digits, written the way the page shows it
   ("902xx"). */
export function zipArea(text) {
  const zip = zipDigits(text);
  return zip ? zip.slice(0, 3) + 'xx' : '';
}
