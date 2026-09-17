/* Reference lists used by therapist profiles and directory filters.
   Edit these in one place — every dropdown on the site reads from here. */

// Specialties a therapist can pick, alphabetized. The dashboard also takes up to
// three written in, which are saved alongside these but never offered as a filter.
export const SPECIALTIES = [
  'Addiction','ADHD','Adoption','Alcohol Use','Anger Management','Antisocial Personality',
  'Anxiety','Autism','Behavioral Issues','Bipolar Disorder','Bisexual','Blended Families',
  'Body Image','Borderline Personality (BPD)','Burnout','Cancer','Career Counseling',
  'Caregivers','Child','Chronic Illness','Chronic Impulsivity','Chronic Pain','Chronic Relapse',
  'Codependency','Coping Skills','Dementia','Depression','Developmental Disorders',
  'Dissociative Disorders (DID)','Divorce','Domestic Abuse','Domestic Violence','Drug Abuse',
  'Dual Diagnosis','Eating Disorders','Education and Learning Disabilities',
  'Emotional Disturbance','Emotional Regulation','Family Conflict','First Responders',
  'Gambling','Gay','Geriatric and Seniors','Grief','Hoarding','Impulse Control Disorders',
  'Infertility','Infidelity','Intellectual Disability','Internet Addiction','Lesbian','LGBTQ+',
  'Life Coaching','Life Transitions','Marital and Premarital','Medical Detox',
  'Medication Management',"Men's Issues",'Menopause','Mood Disorders','Narcissistic Abuse',
  'Narcissistic Personality (NPD)','Neurodivergence','Obesity','Obsessive-Compulsive (OCD)',
  'Oppositional Defiance (ODD)','Panic Attacks','Parenting','Peer Relationships',
  'Personality Disorders','Phobias','Polyamory & ENM','Pregnancy, Prenatal, Postpartum',
  'Premenstrual Dysphoric Disorder (PMDD)','Psychosis','Racial Identity','Relationship Issues',
  'School Issues','Self Esteem','Self-Harming','Sex Therapy','Sex-Positive & Kink Friendly',
  'Sexual Abuse','Sexual Addiction','Sleep or Insomnia','Social Anxiety','Spirituality',
  'Sports Performance','Stress','Substance Use','Suicidal Ideation','Teen Violence',
  'Testing and Evaluation','Thinking Disorders','Transgender','Trauma and PTSD',
  'Traumatic Brain Injury (TBI)','Veterans','Video Game Addiction','Weight Loss',
  "Women's Issues",'Workplace Issues',
];

// Treatment modalities, alphabetized. The dashboard also takes up to three
// written in, saved alongside these.
export const MODALITIES = [
  'Acceptance and Commitment (ACT)','Adlerian','AEDP','Applied Behavioral Analysis (ABA)',
  'Art Therapy','Attachment-based','Biofeedback','Brainspotting','Christian Counseling',
  'Clinical Supervision and Licensed Supervisors','Coaching','Cognitive Behavioral (CBT)',
  'Cognitive Processing (CPT)','Compassion Focused','Culturally Sensitive',
  'Dance Movement Therapy','Dialectical Behavior (DBT)','Eclectic','EMDR','Emotionally Focused',
  'Energy Psychology','Existential','Experiential Therapy','Exposure Response Prevention (ERP)',
  'Expressive Arts','Family / Marital','Family Systems','Feminist','Forensic Psychology',
  'Gestalt','Gottman Method','Humanistic','Hypnotherapy','Imago','Integrative',
  'Internal Family Systems (IFS)','Interpersonal','Intervention','Jungian','Ketamine-Assisted',
  'Mindfulness-Based (MBCT)','Motivational Interviewing','Multicultural','Music Therapy',
  'Narrative','Neuro-Linguistic (NLP)','Neurofeedback','Parent-Child Interaction (PCIT)',
  'Person-Centered','Play Therapy','Positive Psychology','Prolonged Exposure Therapy',
  'Psychoanalytic','Psychobiological Approach Couple Therapy','Psychodynamic',
  'Psychological Testing and Evaluation','Rational Emotive Behavior (REBT)','Reality Therapy',
  'Relational','Sandplay','Schema Therapy','Solution Focused Brief (SFBT)','Somatic',
  'Strength-Based','Structural Family Therapy','The Cortina Method (TCM)','Transpersonal',
  'Trauma Focused',
];

// Insurance plans a therapist can be in-network with. Shown on the listing and
// offered as the directory's insurance filter, so keep the names exactly as a
// visitor would look for them.
export const INSURANCES = [
  'AARP','Aetna','Aetna EAP','Aetna Medicare','Aetna Student Health','All Savers',
  'Allegiance','Ambetter',"America's Choice Provider Network (ACPN)",'AmeriHealth','Anthem',
  'Anthem EAP','Anthem Medicare','Beech Street','BHS | Behavioral Health Systems','Blue Cross',
  'Blue Shield',
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

// The Ages seen chips. The specific ages a therapist sees go in the two
// optional age-range boxes under them (age_range_1 and age_range_2).
export const AGE_RANGES = ['Children','Teens','Young adults','Adults','Senior adults'];

export const PARTICIPANTS = ['Individuals','Couples','Families','Groups','Children','Teens'];

// Languages a therapist offers sessions in, alphabetized: the owner's reference
// list plus English, Haitian Creole and Tagalog from the earlier list. Also the
// directory's Language filter, so keep the names as a visitor would look for them.
export const LANGUAGES = [
  'American Sign Language (ASL)','Arabic','Armenian','Bosnian','Cantonese','Creole','Croatian',
  'Dutch','English','Farsi','Filipino','French','German','Greek','Gujarati','Haitian Creole',
  'Hebrew','Hindi','Hungarian','Italian','Japanese','Korean','Mandarin','Polish','Portuguese',
  'Punjabi','Romanian','Russian','Serbian','Sinhalese','Spanish','Tagalog','Turkish','Ukrainian',
  'Urdu','Vietnamese','Yiddish',
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
