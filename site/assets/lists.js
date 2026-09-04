/* Reference lists used by therapist profiles and directory filters.
   Edit these in one place — every dropdown on the site reads from here. */

export const SPECIALTIES = [
  'ADHD','Addiction','Anger management','Anxiety','Autism','Bipolar disorder','Body image',
  'Borderline personality','Burnout','Career counselling','Chronic illness','Chronic pain',
  'Codependency','Coping skills','Couples counselling','Depression','Disordered eating',
  'Divorce','Domestic violence','Family conflict','Grief and loss','Infertility','Insomnia',
  'Life transitions','LGBTQ+ issues','Men\'s issues','Military and veterans','Mood disorders',
  'Obsessive-compulsive (OCD)','Panic attacks','Parenting','Perinatal and postpartum',
  'Personality disorders','Phobias','Psychosis','PTSD and trauma','Relationship issues',
  'Religious and spiritual','School issues','Self-esteem','Self-harm','Sexual abuse',
  'Sleep problems','Social anxiety','Stress','Substance use','Suicidal ideation',
  'Teen issues','Women\'s issues','Workplace issues',
];

export const MODALITIES = [
  'Acceptance and Commitment (ACT)','Art therapy','Attachment-based','Cognitive Behavioural (CBT)',
  'Compassion Focused','Culturally sensitive','Dialectical Behaviour (DBT)','EMDR',
  'Emotionally Focused','Existential','Exposure and Response Prevention (ERP)','Family systems',
  'Gestalt','Humanistic','Internal Family Systems (IFS)','Interpersonal','Mindfulness-based (MBCT)',
  'Motivational interviewing','Narrative','Person-centred','Play therapy','Psychoanalytic',
  'Psychodynamic','Solution-focused','Somatic','Strength-based','Trauma-focused',
];

export const INSURANCES = [
  'Aetna','Anthem','Blue Cross Blue Shield','Cigna','Humana','Kaiser Permanente','Medicaid',
  'Medicare','Optum','Oscar Health','Oxford','TRICARE','UnitedHealthcare','Out of network',
  'Self-pay only','Sliding scale available',
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
