/* ==========================================================================
   Theraglee — the library of common goals (Goals & tracking, Premium).
   --------------------------------------------------------------------------
   A hundred goals people often want to work on, each in the words a member
   might type, with the theme it belongs to and, where one fits, the set of
   milestones written for that kind of goal. Three things come out of it:

     - the words under LIBRARY_WORDS teach the matcher (quest-goals.js) to
       recognize these goals and others put the same way;
     - LIBRARY_SETS are milestone sets keyed by a word tag: a goal whose words
       carry the tag is offered that set instead of its theme's general one;
     - GOAL_LIBRARY itself is the "Browse common goals" list in setup, and
       the test's list of sentences that must match.

   Twenty new goals join every week (docs/goal-library.md). Everything here is
   general wellness: nothing names a condition, a symptom or a treatment.
   No imports, so tests can load it under plain Node.
   ========================================================================== */

/* Everyday words, grouped under a tag, merged into the matcher's WORDS. A tag
   that is new here needs a weight in LIBRARY_THEME_TAGS below. */
export const LIBRARY_WORDS = {
  sleep:      ['sleep through', 'sleeping', 'sleepless', 'lying awake', 'lie awake', 'awake at night', 'rested', 'well rested', 'feeling rested', 'wake up rested', 'wake up feeling', 'bedtime', 'staying up', 'stay up', 'too late', 'snooze'],
  screen:     ['checking email', 'check my phone', 'checking my phone', 'phone-free', 'phone free', 'screen-free', 'screen free', 'present instead', 'put the phone down', 'less time on my phone'],
  work:       ['work', 'working', 'job', 'boss', 'office', 'workday', 'workload', 'career', 'colleague', 'colleagues', 'coworker', 'coworkers', 'overtime', 'log off', 'at work', 'thinking about work', 'about work', 'work in the evening', 'overwhelmed at work', 'working late', 'checking email', 'balance', 'inbox', 'email', 'emails', 'meeting', 'meetings', 'deadline', 'deadlines', 'to-do list', 'to do list'],
  morning:    ['snooze', 'get out the door', 'out the door', 'make my bed', 'bed made', 'mornings', 'first thing', 'before work'],
  tidy:       ['kitchen', 'piles', 'stuff', 'laundry', 'chores', 'dishes', 'closet', 'garage', 'declutter', 'decluttering', 'organize', 'organizing', 'tidier', 'tidy up', 'living in clutter'],
  patience:   ['patience', 'patient', 'snap', 'snapping', 'snapped', 'temper', 'yell', 'yelling', 'shout', 'shouting', 'lose my cool', 'keep my cool', 'react', 'reacting', 'overreact', 'overreacting', 'irritable', 'irritated', 'short with', 'calmer parent', 'frustrated', 'frustration', 'respond more'],
  friends:    ['friend', 'friends', 'friendship', 'friendships', 'lonely', 'loneliness', 'invitation', 'invitations', 'say yes', 'reach out', 'reaches out', 'reaching out', 'cancel', 'canceling', 'plans', 'social life', 'meet people', 'my people', 'new people', 'old friends'],
  family:     ['family', 'parents', 'parent', 'mom', 'dad', 'mother', 'father', 'kids', 'children', 'child', 'son', 'daughter', 'teenager', 'teen', 'siblings', 'sibling', 'sister', 'brother', 'grandparents', 'grandma', 'grandpa', 'after school', 'family dinner', 'family dinners'],
  move:       ['sitting', 'sit less', 'exercising', 'workout', 'workouts', 'lift weights', 'strength', 'cardio', 'jog', 'jogging', 'treadmill', 'hiking'],
  energy:     ['stronger', 'strong', 'capable', 'stamina', 'fit'],
  food:       ['vegetables', 'veggies', 'fruit', 'skipping', 'skip meals', 'ordering in', 'takeout', 'home-cooked', 'home cooked', 'groceries', 'hydrated', 'hydration', 'snacking', 'snacks'],
  outside:    ['sunset', 'sunsets', 'sunrise', 'indoors', 'hiking', 'camping', 'weekends in nature', 'the outdoors', 'garden'],
  hobby:      ['hobby', 'hobbies', 'guitar', 'piano', 'instrument', 'learn', 'learning', 'practice', 'practicing', 'creative outlet', 'make things', 'making things', 'pick up my', 'pick back up', 'get back into'],
  reading:    ['read', 'reading', 'book', 'books', 'novel', 'novels', 'library', 'pages'],
  confidence: ['believe in myself', 'comparing', 'compare myself', 'comparison', 'speak up', 'say no', 'saying no', 'apologizing', 'apologize', 'sorry', 'own skin', 'comfortable in', 'decisions', 'trust myself', 'people-pleasing', 'people pleasing', 'people pleaser', 'assertive', 'boundaries', 'boundary', 'self-doubt', 'doubt myself', 'imposter', 'stand up for myself'],
  grateful:   ['complain', 'complaining', 'the good', 'good things', 'dwelling', 'went wrong', 'bright side', 'optimistic', 'outlook', 'appreciating'],
  calm:       ['calmer', 'calmly', 'overthinking', 'overthink', 'worry', 'worrying', 'worries', 'rushed', 'rushing', 'hurry', 'hurried', 'on edge', 'wound up', 'racing mind', 'racing thoughts', 'slow down', 'slowing down', 'pressure', 'under pressure', 'juggling', 'spread thin', 'cope', 'coping'],
  kind:       ['care of myself', 'running on empty', 'burned out', 'burnt out', 'rest', 'resting', 'recharge', 'put myself first', 'look after myself'],
  purpose:    ['what i want', 'next chapter', 'meaning', 'meaningful', 'purpose', 'stuck', 'drifting', 'direction', 'what matters to me', 'fulfilled', 'fulfilling', 'what i care about', 'priorities'],
};

/* How strongly each tag points at a theme, added to the matcher's THEME_TAGS. */
export const LIBRARY_THEME_TAGS = {
  calm_evenings:   { sleep: 1 },
  steady_routines: { morning: 1, tidy: 2 },
  connection:      { friends: 3, family: 3 },
  energy:          { food: 1, move: 1 },
  self_kindness:   { confidence: 3, grateful: 2 },
  creativity:      { hobby: 3, reading: 3 },
  focus:           { work: 3, purpose: 3, screen: 2 },
  calm:            { patience: 4, calm: 1 },
};

/* Milestone sets for a kind of goal, keyed by the tag that picks them. Each
   is five things a person could notice in real life, with four stepping
   stones each (ACTIONS keys in quest-paths.js). */
export const LIBRARY_SETS = {
  sleep: { theme: 'calm_evenings', milestones: [
    { title: 'Screens off half an hour before bed most nights',      steps: ['hab_screen_curfew', 'sc_dim_lights', 'hab_grayscale_evening', 'hab_book_by_bed'] },
    { title: 'The same bedtime, within half an hour, most nights',   steps: ['hab_same_bed', 'sc_same_wind_down', 'hab_clock_away', 'sc_cool_dark_room'] },
    { title: 'A wind-down I actually look forward to',               steps: ['sc_wind_down_music', 'sc_warm_drink', 'mv_gentle_stretch', 'sc_slow_face_wash'] },
    { title: 'Caffeine finished by early afternoon most days',       steps: ['hab_caffeine_cutoff', 'hab_water_bottle', 'sc_bright_song', 'mv_shake_out'] },
    { title: 'Worries on paper before bed, not in bed',              steps: ['hab_worry_list', 'hab_close_the_day', 'ref_what_can_wait', 'gr_evening_glad'] },
  ] },
  screen: { theme: 'focus', milestones: [
    { title: 'The phone stays out of reach during meals',           steps: ['hab_phone_other_room_meal', 'sc_screen_free_meal', 'co_ask_question', 'sc_snack_sit'] },
    { title: 'One stretch of the day with no notifications',         steps: ['hab_notifications_off_hour', 'hab_single_task', 'hab_one_tab', 'mv_between_tasks'] },
    { title: 'Mornings start without a screen',                      steps: ['hab_glass_water', 'hab_morning_light', 'hab_alarm_across_room', 'na_morning_birds'] },
    { title: 'An evening a week with the phone switched off',        steps: ['hab_screen_curfew', 'co_evening_chat', 'cr_doodle', 'na_evening_air'] },
    { title: 'I notice the urge to scroll and let it pass',          steps: ['ref_urge_note', 'sc_do_nothing', 'hab_grayscale_evening', 'na_park_phone_away'] },
  ] },
  work: { theme: 'focus', milestones: [
    { title: 'A clear stopping time most workdays',                 steps: ['hab_shutdown_ritual', 'hab_close_the_day', 'hab_email_windows', 'mv_shake_out'] },
    { title: "Tomorrow's three things chosen before I log off",     steps: ['hab_tomorrow_three', 'ref_one_thing_tomorrow', 'hab_bag_by_door', 'hab_tidy_surface'] },
    { title: 'A real lunch break away from the desk',               steps: ['hab_lunch_away', 'mv_walk_block', 'sc_sit_in_sun', 'na_sky_minute'] },
    { title: 'One hour a day on one thing, notifications off',      steps: ['hab_single_task', 'hab_one_tab', 'hab_two_minute_start', 'cr_doodle_before_task'] },
    { title: 'Work stays at work most evenings',                     steps: ['hab_shutdown_ritual', 'sc_screen_free_meal', 'co_evening_chat', 'ref_keep_from_tonight'] },
  ] },
  morning: { theme: 'steady_routines', milestones: [
    { title: 'Up with the first alarm most mornings',                steps: ['hab_alarm_across_room', 'hab_same_wake', 'hab_morning_light', 'hab_same_bed'] },
    { title: "Tomorrow's bag and clothes ready the night before",    steps: ['hab_clothes_out', 'hab_bag_by_door', 'hab_tomorrow_three', 'hab_evening_reset'] },
    { title: 'Ten unhurried minutes before the day starts',          steps: ['hab_buffer_time', 'sc_warm_drink', 'na_morning_birds', 'mv_morning_stretch'] },
    { title: 'Breakfast and water before the first screen',          steps: ['hab_glass_water', 'hab_breakfast_sit', 'sc_bright_song', 'hab_water_bottle'] },
    { title: 'A made bed most mornings',                             steps: ['hab_make_bed', 'hab_tidy_surface', 'hab_kind_start', 'gr_routine_glad'] },
  ] },
  tidy: { theme: 'steady_routines', milestones: [
    { title: 'The kitchen is reset most nights',                     steps: ['hab_dishes_before_bed', 'hab_evening_reset', 'hab_kitchen_closed', 'hab_tidy_surface'] },
    { title: 'One surface stays clear all week',                     steps: ['hab_tidy_surface', 'hab_bag_by_door', 'cr_rearrange_corner', 'sc_do_it_beautifully'] },
    { title: 'Ten minutes of tidying most days',                     steps: ['hab_ten_min_tidy', 'hab_laundry_one_load', 'sc_bright_song', 'mv_hourly_stand'] },
    { title: 'One drawer or shelf sorted each week',                 steps: ['hab_one_drawer', 'hab_donate_bag', 'cr_rearrange_corner', 'gr_routine_glad'] },
    { title: 'Laundry done before it piles up',                      steps: ['hab_laundry_one_load', 'hab_clothes_out', 'hab_ten_min_tidy', 'hab_make_bed'] },
  ] },
  patience: { theme: 'calm', milestones: [
    { title: 'A breath before I answer, most of the time',           steps: ['sc_pause_count_five', 'sc_box_breath', 'sc_shoulders_drop', 'sc_slow_breaths'] },
    { title: 'I notice the warning signs early',                     steps: ['ref_trigger_note', 'hab_buffer_time', 'sc_hands_warm_water', 'mv_shake_out'] },
    { title: 'One hard moment a day handled the way I would like',   steps: ['sc_pause_count_five', 'ref_handled_well', 'sc_one_thing_slowly', 'na_sit_outside_two'] },
    { title: 'I repair quickly after a sharp word',                  steps: ['co_repair_quick', 'co_kind_last_words', 'co_compliment', 'sc_kind_note'] },
    { title: 'Evenings end on a kind note',                          steps: ['co_kind_last_words', 'co_goodnight', 'gr_evening_glad', 'sc_dim_lights'] },
  ] },
  friends: { theme: 'connection', milestones: [
    { title: 'I reach out to one person most days',                  steps: ['co_text_friend', 'co_old_friend_message', 'co_compliment', 'hab_hello_passerby'] },
    { title: 'One plan on the calendar each week',                   steps: ['co_plan_to_meet', 'co_keep_plan', 'co_shared_meal', 'co_walk_and_talk'] },
    { title: 'I say yes to one invitation a week',                   steps: ['co_say_yes', 'co_join_group', 'co_ask_question', 'co_share_find'] },
    { title: 'A longer catch-up with an old friend each month',      steps: ['co_call', 'co_old_friend_message', 'mv_walk_on_phone', 'gr_thank_someone'] },
    { title: 'I show up when I said I would',                        steps: ['co_keep_plan', 'co_plan_to_meet', 'hab_bag_by_door', 'ref_who_crossed_mind'] },
  ] },
  family: { theme: 'connection', milestones: [
    { title: 'A family meal with no screens most days',              steps: ['sc_screen_free_meal', 'hab_phone_other_room_meal', 'co_ask_question', 'hab_dinner_time'] },
    { title: 'Ten undistracted minutes with each child most days',   steps: ['co_ten_minutes_child', 'co_family_ritual', 'co_goodnight', 'na_share_view'] },
    { title: 'I call a parent or sibling each week',                 steps: ['co_call_parent', 'co_call', 'co_photo_of_made', 'gr_thank_someone'] },
    { title: 'A real conversation with each person at home weekly',  steps: ['co_ask_question', 'co_evening_chat', 'co_walk_and_talk', 'co_kind_last_words'] },
    { title: 'A small family ritual that holds',                     steps: ['co_family_ritual', 'co_goodnight', 'cr_card_for_someone', 'na_eat_outside'] },
  ] },
  move: { theme: 'energy', milestones: [
    { title: 'I move a little every day',                            steps: ['mv_stand_stretch', 'mv_ten_squats', 'mv_stairs', 'mv_hourly_stand'] },
    { title: 'A walk most days',                                     steps: ['mv_walk_block', 'mv_one_lap', 'mv_walk_meeting', 'mv_evening_stroll'] },
    { title: 'Two stretches built into the day',                     steps: ['mv_morning_stretch', 'mv_gentle_stretch', 'sc_stretch_neck', 'mv_shake_out'] },
    { title: 'One longer session a week that I enjoy',               steps: ['mv_try_class', 'mv_long_walk', 'mv_dance_song', 'co_walk_and_talk'] },
    { title: 'Movement feels like a gift, not a chore',              steps: ['mv_kind_pace', 'mv_move_to_music', 'mv_dance_song', 'gr_body_thanks'] },
  ] },
  food: { theme: 'energy', milestones: [
    { title: 'A glass of water with every meal',                     steps: ['hab_water_bottle', 'hab_glass_water', 'sc_snack_sit', 'hab_dinner_time'] },
    { title: 'Breakfast most mornings',                              steps: ['hab_breakfast_sit', 'hab_glass_water', 'hab_morning_light', 'hab_clothes_out'] },
    { title: 'One home-cooked meal a day',                           steps: ['hab_cook_simple', 'cr_new_recipe', 'hab_add_one_veg', 'hab_dinner_time'] },
    { title: 'Something green on the plate most days',               steps: ['hab_add_one_veg', 'hab_cook_simple', 'na_plant_care', 'sc_snack_sit'] },
    { title: 'Meals eaten sitting down, without a screen',           steps: ['sc_screen_free_meal', 'hab_phone_other_room_meal', 'sc_snack_sit', 'hab_kitchen_closed'] },
  ] },
  hobby: { theme: 'creativity', milestones: [
    { title: 'Ten minutes of my hobby most days',                    steps: ['cr_ten_minutes_hobby', 'cr_instrument_five', 'cr_doodle', 'hab_pen_by_chair'] },
    { title: 'A corner with my things ready to use',                 steps: ['cr_rearrange_corner', 'hab_pen_by_chair', 'cr_reading_nook', 'hab_one_drawer'] },
    { title: 'One small finished thing each week',                   steps: ['cr_finish_small', 'cr_six_words', 'cr_photo', 'cr_tiny_note'] },
    { title: 'An hour a week that is mine to make things',           steps: ['cr_mandala', 'cr_evening_page', 'cr_sketch_outside', 'cr_new_recipe'] },
    { title: 'I learn one small new thing a week',                   steps: ['cr_learn_one_thing', 'cr_read_ten_pages', 'cr_instrument_five', 'co_share_find'] },
  ] },
  reading: { theme: 'creativity', milestones: [
    { title: 'Ten pages most days',                                  steps: ['cr_read_ten_pages', 'hab_book_by_bed', 'sc_warm_drink', 'hab_lunch_away'] },
    { title: 'A book by the bed where the phone used to be',         steps: ['hab_book_by_bed', 'hab_screen_curfew', 'sc_dim_lights', 'hab_lamp_light'] },
    { title: 'A reading spot I like',                                steps: ['cr_reading_nook', 'cr_rearrange_corner', 'sc_warm_drink', 'na_sit_by_tree'] },
    { title: 'One book finished a month',                            steps: ['cr_read_ten_pages', 'cr_finish_small', 'hab_book_by_bed', 'gr_made_thing'] },
    { title: 'I talk about what I read',                             steps: ['co_share_find', 'co_ask_question', 'cr_six_words', 'co_text_friend'] },
  ] },
  confidence: { theme: 'self_kindness', milestones: [
    { title: 'I catch the comparison and turn back to my own day',   steps: ['ref_compare_catch', 'sc_kind_note', 'ref_small_win', 'na_park_phone_away'] },
    { title: 'One small no a week, without a long excuse',           steps: ['co_small_no', 'hab_thank_not_sorry', 'ref_handled_well', 'sc_kind_note'] },
    { title: 'I say one thing in every meeting or gathering',        steps: ['co_speak_once', 'co_ask_question', 'co_compliment', 'hab_kind_start'] },
    { title: 'A running list of things that went well',              steps: ['ref_small_win', 'ref_went_well', 'ref_future_self', 'gr_one_thing'] },
    { title: 'Thank you instead of sorry, when nothing was wrong',   steps: ['hab_thank_not_sorry', 'sc_mirror_kind', 'sc_kind_note', 'co_small_no'] },
  ] },
  grateful: { theme: 'self_kindness', milestones: [
    { title: 'Three good things written most nights',                steps: ['gr_three_things', 'gr_one_thing', 'gr_evening_glad', 'ref_went_well'] },
    { title: 'One thank-you said out loud each day',                 steps: ['gr_say_it_aloud', 'gr_thank_someone', 'co_compliment', 'gr_body_thanks'] },
    { title: 'I notice one small pleasure in an ordinary day',       steps: ['gr_senses', 'gr_photo_good', 'na_sky_minute', 'sc_warm_drink'] },
    { title: 'One complaint a day turned into a request',            steps: ['gr_complaint_swap', 'co_ask_question', 'ref_what_can_wait', 'sc_kind_note'] },
    { title: 'I end the day on what went right',                     steps: ['ref_went_well', 'gr_evening_glad', 'hab_close_the_day', 'co_kind_last_words'] },
  ] },
};

/* The goals themselves: the words a member might type, the theme, and the
   set (a LIBRARY_SETS or MILESTONE_SETS key) when one is written for them.
   `week` is the Monday of the week they were added (docs/goal-library.md). */
export const GOAL_LIBRARY = [
  // Sleep and evenings
  { text: 'Sleep through the night more often',               theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  { text: 'Fall asleep without my phone',                     theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  { text: 'Stop lying awake with my thoughts',                theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  { text: 'Wake up feeling rested',                           theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  { text: 'A bedtime that actually sticks',                   theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  { text: 'Stop staying up too late',                         theme: 'calm_evenings', set: 'sleep',  week: '2026-10-05' },
  // Screens
  { text: 'Spend less time on my phone',                      theme: 'focus', set: 'screen', week: '2026-10-05' },
  { text: 'Stop doomscrolling',                               theme: 'focus', set: 'screen', week: '2026-10-05' },
  { text: 'Less social media, more real life',                theme: 'focus', set: 'screen', week: '2026-10-05' },
  { text: 'Be more present instead of on my phone',           theme: 'focus', set: 'screen', week: '2026-10-05' },
  { text: 'Stop checking email at night',                     theme: 'focus', set: 'screen', week: '2026-10-05' },
  { text: 'A phone-free dinner table',                        theme: 'focus', set: 'screen', week: '2026-10-05' },
  // Work
  { text: 'Leave work at work',                               theme: 'focus', set: 'work', week: '2026-10-05' },
  { text: 'Stop thinking about work in the evening',          theme: 'focus', set: 'work', week: '2026-10-05' },
  { text: 'Feel less overwhelmed at work',                    theme: 'focus', set: 'work', week: '2026-10-05' },
  { text: 'Stop procrastinating',                             theme: 'focus',              week: '2026-10-05' },
  { text: 'Take real breaks during the workday',              theme: 'focus', set: 'work', week: '2026-10-05' },
  { text: 'A better balance between work and life',           theme: 'focus', set: 'work', week: '2026-10-05' },
  { text: 'Stop working late',                                theme: 'focus', set: 'work', week: '2026-10-05' },
  // Mornings
  { text: 'A calmer morning routine',                         theme: 'steady_routines', set: 'morning', week: '2026-10-05' },
  { text: 'Stop hitting snooze',                              theme: 'steady_routines', set: 'morning', week: '2026-10-05' },
  { text: 'Get out the door without a rush',                  theme: 'steady_routines', set: 'morning', week: '2026-10-05' },
  { text: 'Start my mornings on the right foot',              theme: 'steady_routines', set: 'morning', week: '2026-10-05' },
  { text: 'Make my bed every day',                            theme: 'steady_routines', set: 'morning', week: '2026-10-05' },
  // Home
  { text: 'A tidier home',                                    theme: 'steady_routines', set: 'tidy', week: '2026-10-05' },
  { text: 'Stop living in clutter',                           theme: 'steady_routines', set: 'tidy', week: '2026-10-05' },
  { text: 'Keep the kitchen clean',                           theme: 'steady_routines', set: 'tidy', week: '2026-10-05' },
  { text: 'Finally deal with the piles of stuff',             theme: 'steady_routines', set: 'tidy', week: '2026-10-05' },
  { text: 'Stay on top of the laundry',                       theme: 'steady_routines', set: 'tidy', week: '2026-10-05' },
  // Patience
  { text: 'More patience with my kids',                       theme: 'calm', set: 'patience', week: '2026-10-05' },
  { text: 'Stop snapping at everyone',                        theme: 'calm', set: 'patience', week: '2026-10-05' },
  { text: 'Keep my cool when things go wrong',                theme: 'calm', set: 'patience', week: '2026-10-05' },
  { text: 'React less and respond more',                      theme: 'calm', set: 'patience', week: '2026-10-05' },
  { text: 'Be a calmer parent',                               theme: 'calm', set: 'patience', week: '2026-10-05' },
  // Friends
  { text: 'Make new friends as an adult',                     theme: 'connection', set: 'friends', week: '2026-10-05' },
  { text: 'Rebuild old friendships',                          theme: 'connection', set: 'friends', week: '2026-10-05' },
  { text: 'Say yes to more invitations',                      theme: 'connection', set: 'friends', week: '2026-10-05' },
  { text: 'Feel less lonely',                                 theme: 'connection', set: 'friends', week: '2026-10-05' },
  { text: 'Be the one who reaches out',                       theme: 'connection', set: 'friends', week: '2026-10-05' },
  { text: 'Stop canceling plans',                             theme: 'connection', set: 'friends', week: '2026-10-05' },
  // Family
  { text: 'Call my parents more',                             theme: 'connection', set: 'family', week: '2026-10-05' },
  { text: 'Family dinners that feel like family',             theme: 'connection', set: 'family', week: '2026-10-05' },
  { text: 'Better conversations with my teenager',            theme: 'connection', set: 'family', week: '2026-10-05' },
  { text: 'Stay in touch with my siblings',                   theme: 'connection', set: 'family', week: '2026-10-05' },
  { text: 'Be there for my kids after school',                theme: 'connection', set: 'family', week: '2026-10-05' },
  // Movement
  { text: 'Move my body every day',                           theme: 'energy', set: 'move', week: '2026-10-05' },
  { text: 'Get back to exercising',                           theme: 'energy', set: 'move', week: '2026-10-05' },
  { text: 'Stretch more often',                               theme: 'energy', set: 'move', week: '2026-10-05' },
  { text: 'Stop sitting all day',                             theme: 'energy', set: 'move', week: '2026-10-05' },
  { text: 'Start running again',                              theme: 'energy', set: 'move', week: '2026-10-05' },
  { text: 'Feel stronger and more capable',                   theme: 'energy',              week: '2026-10-05' },
  { text: 'Enjoy exercise instead of dreading it',            theme: 'energy', set: 'move', week: '2026-10-05' },
  // Food and water
  { text: 'Drink more water',                                 theme: 'energy', set: 'food', week: '2026-10-05' },
  { text: 'Eat more vegetables',                              theme: 'energy', set: 'food', week: '2026-10-05' },
  { text: 'Stop skipping meals',                              theme: 'energy', set: 'food', week: '2026-10-05' },
  { text: 'Cook real meals instead of ordering in',           theme: 'energy', set: 'food', week: '2026-10-05' },
  { text: 'Eat lunch away from my desk',                      theme: 'energy', set: 'food', week: '2026-10-05' },
  { text: 'Stop skipping breakfast',                          theme: 'energy', set: 'food', week: '2026-10-05' },
  // Outdoors
  { text: 'Get outside every day',                            theme: 'time_outdoors', week: '2026-10-05' },
  { text: 'Spend more weekends in nature',                    theme: 'time_outdoors', week: '2026-10-05' },
  { text: 'Take up hiking',                                   theme: 'time_outdoors', week: '2026-10-05' },
  { text: 'Start a garden',                                   theme: 'time_outdoors', week: '2026-10-05' },
  { text: 'Watch more sunsets',                               theme: 'time_outdoors', week: '2026-10-05' },
  { text: 'Spend less time indoors',                          theme: 'time_outdoors', week: '2026-10-05' },
  // Hobbies and reading
  { text: 'Pick up my guitar again',                          theme: 'creativity', set: 'hobby',   week: '2026-10-05' },
  { text: 'Start journaling',                                 theme: 'creativity',                 week: '2026-10-05' },
  { text: 'Paint again',                                      theme: 'creativity',                 week: '2026-10-05' },
  { text: 'Write the book I keep talking about',              theme: 'creativity', set: 'reading', week: '2026-10-05' },
  { text: 'Learn something new every week',                   theme: 'creativity', set: 'hobby',   week: '2026-10-05' },
  { text: 'Make time for a hobby',                            theme: 'creativity', set: 'hobby',   week: '2026-10-05' },
  { text: 'Read more books',                                  theme: 'creativity', set: 'reading', week: '2026-10-05' },
  { text: 'Finish a book a month',                            theme: 'creativity', set: 'reading', week: '2026-10-05' },
  // Confidence
  { text: 'Believe in myself more',                           theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Stop comparing myself to others',                  theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Speak up more',                                    theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Say no without feeling guilty',                    theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Stop apologizing for everything',                  theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Feel comfortable in my own skin',                  theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Trust my own decisions',                           theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  { text: 'Stop people-pleasing',                             theme: 'self_kindness', set: 'confidence', week: '2026-10-05' },
  // Gratitude and outlook
  { text: 'Be more grateful for what I have',                 theme: 'self_kindness', set: 'grateful', week: '2026-10-05' },
  { text: 'A more positive outlook',                          theme: 'self_kindness', set: 'grateful', week: '2026-10-05' },
  { text: 'Complain less',                                    theme: 'self_kindness', set: 'grateful', week: '2026-10-05' },
  { text: 'Notice the good in ordinary days',                 theme: 'self_kindness', set: 'grateful', week: '2026-10-05' },
  { text: 'Stop dwelling on what went wrong',                 theme: 'self_kindness', set: 'grateful', week: '2026-10-05' },
  // Calm
  { text: 'Feel less stressed',                               theme: 'calm', week: '2026-10-05' },
  { text: 'Stop overthinking everything',                     theme: 'calm', week: '2026-10-05' },
  { text: 'Worry less',                                       theme: 'calm', week: '2026-10-05' },
  { text: 'Slow down',                                        theme: 'calm', week: '2026-10-05' },
  { text: 'Stop feeling rushed all the time',                 theme: 'calm', week: '2026-10-05' },
  { text: 'Handle stress better',                             theme: 'calm', week: '2026-10-05' },
  { text: 'Remember to breathe',                              theme: 'calm', week: '2026-10-05' },
  // Looking after myself
  { text: 'Take better care of myself',                       theme: 'self_kindness', week: '2026-10-05' },
  { text: 'Rest without feeling guilty',                      theme: 'self_kindness', week: '2026-10-05' },
  { text: 'Stop running on empty',                            theme: 'self_kindness', week: '2026-10-05' },
  { text: 'Make time for me',                                 theme: 'self_kindness', week: '2026-10-05' },
  // Direction
  { text: 'Figure out what I want next',                      theme: 'focus', week: '2026-10-05' },
  { text: 'Find more meaning in my days',                     theme: 'focus', week: '2026-10-05' },
  { text: 'Feel less stuck',                                  theme: 'focus', week: '2026-10-05' },
  { text: 'Do more of what matters to me',                    theme: 'focus', week: '2026-10-05' },
];
