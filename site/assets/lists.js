/* Reference lists used by therapist profiles and directory filters.
   Edit these in one place — every dropdown on the site reads from here. */

export const SPECIALTIES = [
  'ADHD','Addiction','Anger management','Anxiety','Autism','Bipolar disorder','Body image',
  'Borderline personality','Burnout','Career counseling','Chronic illness','Chronic pain',
  'Codependency','Coping skills','Couples counseling','Depression','Disordered eating',
  'Divorce','Domestic violence','Family conflict','Grief and loss','Infertility','Insomnia',
  'Life transitions','LGBTQ+ issues','Men\'s issues','Military and veterans','Mood disorders',
  'Obsessive-compulsive (OCD)','Panic attacks','Parenting','Perinatal and postpartum',
  'Personality disorders','Phobias','Psychosis','PTSD and trauma','Relationship issues',
  'Religious and spiritual','School issues','Self-esteem','Self-harm','Sexual abuse',
  'Sleep problems','Social anxiety','Stress','Substance use','Suicidal ideation',
  'Teen issues','Women\'s issues','Workplace issues',
];

export const MODALITIES = [
  'Acceptance and Commitment (ACT)','Art therapy','Attachment-based','Cognitive Behavioral (CBT)',
  'Compassion Focused','Culturally sensitive','Dialectical Behavior (DBT)','EMDR',
  'Emotionally Focused','Existential','Exposure and Response Prevention (ERP)','Family systems',
  'Gestalt','Humanistic','Internal Family Systems (IFS)','Interpersonal','Mindfulness-based (MBCT)',
  'Motivational interviewing','Narrative','Person-centered','Play therapy','Psychoanalytic',
  'Psychodynamic','Solution-focused','Somatic','Strength-based','Trauma-focused',
];

// Insurance plans a therapist can be in-network with. Shown on the listing and
// offered as the directory's insurance filter, so keep the names exactly as a
// visitor would look for them.
export const INSURANCES = [
  '1199SEIU','AARP','Aetna','Aetna EAP','Aetna Medicare','Aetna Student Health','All Savers',
  'Allegiance','Ambetter',"America's Choice Provider Network (ACPN)",'AmeriHealth','Anthem',
  'Anthem EAP','Beech Street','BHS | Behavioral Health Systems','Blue Cross','Blue Shield',
  'BlueCross and BlueShield','Carebridge EAP','Carelon Behavioral Health',
  'Carelon Health IPA of California (CHIPA)','CenCal','Centene','Centivo',
  "Children's Health Insurance Program (CHIP)",'Cigna and Evernorth','Cigna EAP','Cigna Medicare',
  'Claremont EAP','Commonwealth Care Alliance','ComPsych','Concern','Coventry','CuraLinc Healthcare',
  'Curative','Dayforce','Evernorth EAP','First Health','Golden Rule',
  'Government Employees Health Association (GEHA)','Health Net','HMC Healthworks','Holman Group',
  'Humana','Humana Dual Medicare and Medicaid','Humana Medicare','Imperial Health Plan',
  'Independence Administrators','Inland Empire Health Plan','Kaiser (Out-of-Network)',
  'L.A. Care Health Plan','Lyra Health','Magellan','MagnaCare','Managed Health Network (MHN)',
  'Medi-Cal','Medicaid','Medicare','MediNcrease Health Plans (MHP)','Meritain Health',
  'MHNet Behavioral Health','Military OneSource','Modern Health','Molina Healthcare','MultiPlan',
  'MultiPlan Private Healthcare Systems (PHCS)','Mutual of Omaha','New Directions | Lucet',
  'Nippon Life Benefits','Northwell Direct','Optum','Oscar Health','Oxford','Partners Direct Health',
  'Providence','Provider Network of America (PNOA)','Quest Behavioral Health','Reliant','Sagamore',
  'Sana Benefits','Scripps Health Plan','Sharp Health Plan','Sierra Health | SHL','Surest','Sutter',
  'TELUS Health','TRICARE','TriWest','Trustmark Benefits','Ulliance','United Medical Resources (UMR)',
  'UnitedHealthcare / Optum EAP','UnitedHealthcare / Optum Medicaid','UnitedHealthcare / Optum Medicare',
  'UnitedHealthcare Student Resources','UnitedHealthcare UHC | UBH','Uprise Health',
  'Velocity National Provider Network (VNPN)','WellCare','Wellfleet','Wellpoint | Amerigroup',
  'Workplace Options','Zelis Healthcare',
  // Not insurers, but picked and filtered the same way.
  'Self-pay only','Sliding scale available',
];

// Payment methods a therapist uses in their practice and advertises on their listing.
export const PAYMENT_METHODS = [
  'ACH bank transfer','American Express','Apple Cash','Cash','Check','Discover',
  'Health Savings Account','Mastercard','PayPal','Venmo','Visa','Wire','Zelle',
];

export const AGE_RANGES = [
  'Children (under 12)','Teens (13–17)','Young adults (18–25)','Adults (26–64)','Older adults (65+)',
];

export const PARTICIPANTS = ['Individuals','Couples','Families','Groups','Children','Teens'];

export const LANGUAGES = [
  'English','Spanish','Mandarin','Cantonese','Tagalog','Vietnamese','Arabic','French','Korean',
  'Russian','Portuguese','Haitian Creole','Hindi','Urdu','Polish','German','Japanese','Farsi',
  'Italian','American Sign Language',
];

export const CREDENTIALS = [
  'LPC','LPCC','LMHC','LCPC','LMFT','LCSW','LICSW','LCSW-C','PsyD','PhD','EdD','MD (Psychiatrist)',
  'DO (Psychiatrist)','PMHNP','LPAT','LCAT','LADC','Other',
];

export const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];

/* Issues a member can list on their own profile, for opt-in therapist discovery. */
export const MEMBER_ISSUES = [
  'Anxiety','Depression','ADHD','OCD','PTSD / trauma','Grief','Stress and burnout',
  'Relationship issues','Sleep problems','Self-esteem','Substance use','Disordered eating',
  'Life transitions','Anger','Loneliness',
];
