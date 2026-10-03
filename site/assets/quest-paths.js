/* ==========================================================================
   Theraglee — the quest map behind the Premium Goals & tracking page.
   --------------------------------------------------------------------------
   Everything here is general wellness: habits, short self-care, reflection
   prompts, gratitude, movement, nature, connection and creativity. Nothing
   asks about symptoms, screens, scores, diagnoses or treats anything.

   No imports, so tests/quest-paths/check.mjs can run it under plain Node.

   VALUES and CATEGORIES keys, and the scene and minute choices, are a data
   contract: supabase/migrations/20260927190000_quest_maps.sql lists them in
   its checks, and the test fails if the two stop matching. To add one, add it
   to both, in a new migration. Never change an ACTIONS key once shipped —
   quest_steps rows point at it; retire an action by adding `retired: true`.

   docs/quest-map.md is the guide.
   ========================================================================== */

/** What the member would like more of in everyday life: the quest's focus.
 *  `phrase` finishes "a quest toward …", `example` is an intention in a
 *  member's own words (the setup's placeholder, matched to the focus so the
 *  words and the actions agree), and `does` says what its actions look like. */
export const VALUES = [
  { key: 'calm_evenings',    label: 'More calm in the evenings',      phrase: 'calmer evenings',            icon: '🌙',
    example: 'Evenings that feel like mine again',
    does: 'Actions for the end of the day: lights down, phone away, a slower last hour.' },
  { key: 'steady_routines',  label: 'Steadier daily routines',        phrase: 'steadier days',              icon: '🧭',
    example: 'Days with a shape to them',
    does: 'Actions that repeat: the same wake time, small resets, tomorrow set up tonight.' },
  { key: 'connection',       label: 'A stronger sense of connection', phrase: 'closer connection',          icon: '🤝',
    example: 'More real conversations',
    does: 'Small reaches toward people: a message, a call, a question asked and listened to.' },
  { key: 'energy',           label: 'More energy in my days',         phrase: 'livelier days',              icon: '☀️',
    example: 'Mornings I actually feel awake',
    does: 'Short boosts for the body: water, daylight, a little movement, a snack sitting down.' },
  { key: 'time_outdoors',    label: 'More time outdoors',             phrase: 'more time outside',          icon: '🌿',
    example: 'Fresh air every day, not just weekends',
    does: 'Reasons to step out: the sky, the nearest patch of green, a meal outside.' },
  { key: 'self_kindness',    label: 'Being kinder to myself',         phrase: 'a kinder way with yourself', icon: '💛',
    example: 'Talking to myself like a friend',
    does: 'Gentle things: a kind word, an unhurried shower, a pace that is not hard.' },
  { key: 'creativity',       label: 'More room for creativity',       phrase: 'room to make things',        icon: '🎨',
    example: 'Making things again, just for me',
    does: 'Small makings: a doodle, a photo, six words about today.' },
  { key: 'focus',            label: 'More focus on what matters',     phrase: 'time for what matters',      icon: '🎯',
    example: 'Fewer tabs open in my head',
    does: 'Ways to narrow the day: one task, three things for tomorrow, notifications off.' },
];

/** Kinds of practice the member can choose from. */
export const CATEGORIES = [
  { key: 'habits',      label: 'Small habits',        icon: '🔁' },
  { key: 'self_care',   label: 'Short self-care',     icon: '🛁' },
  { key: 'reflection',  label: 'Reflection prompts',  icon: '📓' },
  { key: 'gratitude',   label: 'Gratitude',           icon: '🙏' },
  { key: 'movement',    label: 'Movement',            icon: '🚶' },
  { key: 'nature',      label: 'Nature',              icon: '🌳' },
  { key: 'connection',  label: 'Connection',          icon: '💬' },
  { key: 'creativity',  label: 'Creativity',          icon: '✏️' },
];

/** How long the member usually has, in minutes. */
export const MINUTES = [2, 5, 10, 20];

/** What grows along the trail as days are added. One map, three ways to
 *  decorate it; nothing in any of them ever shrinks or wilts. */
export const SCENES = [
  { key: 'garden',  label: 'Flowers along the trail',    blurb: 'A flower blooms beside the path for every day you show up.' },
  { key: 'lights',  label: 'Lanterns along the trail',   blurb: 'A lantern lights beside the path for every day you show up.' },
  { key: 'scenery', label: 'A landscape that fills in',  blurb: 'The sky, trees and hills around the trail fill in as each place opens.' },
];

/**
 * Micro-actions. `values` lists the VALUES each suits best; an action with no
 * `values` suits them all. `min` is roughly how long it takes. `write` marks
 * the ones done by writing something down: tapping one on the page opens a
 * note box, and what the member writes is kept with the step.
 */
export const ACTIONS = [
  // Small habits
  { key: 'hab_glass_water',     cat: 'habits', min: 2,  text: 'Drink a glass of water before your first screen of the day.', values: ['energy', 'steady_routines'] },
  { key: 'hab_same_wake',       cat: 'habits', min: 2,  text: 'Get up within the same half hour as yesterday.', values: ['steady_routines', 'energy'] },
  { key: 'hab_tidy_surface',    cat: 'habits', min: 5,  text: 'Clear one surface, like a nightstand or a corner of a desk.', values: ['steady_routines', 'focus', 'calm_evenings'] },
  { key: 'hab_tomorrow_three',  cat: 'habits', min: 5, write: true,  text: 'Write the three things you want to do tomorrow, then stop.', values: ['focus', 'steady_routines'] },
  { key: 'hab_screen_curfew',   cat: 'habits', min: 2,  text: 'Pick a time tonight when the phone goes to charge in another room.', values: ['calm_evenings'] },
  { key: 'hab_single_task',     cat: 'habits', min: 20, text: 'Work on one thing for twenty minutes with notifications off.', values: ['focus'] },
  { key: 'hab_evening_reset',   cat: 'habits', min: 10, text: 'Do a ten-minute evening reset: dishes, bag packed, clothes out.', values: ['calm_evenings', 'steady_routines'] },
  { key: 'hab_clothes_out',     cat: 'habits', min: 2,  text: 'Set out tomorrow\'s clothes before bed.', values: ['steady_routines', 'calm_evenings'] },
  { key: 'hab_same_bed',        cat: 'habits', min: 2,  text: 'Head to bed within the same half hour as last night.', values: ['steady_routines', 'calm_evenings'] },
  { key: 'hab_dinner_time',     cat: 'habits', min: 5,  text: 'Eat dinner at about the same time as yesterday.', values: ['steady_routines'] },
  { key: 'hab_morning_light',   cat: 'habits', min: 2,  text: 'Open the curtains and stand in the daylight for a minute after you wake.', values: ['energy', 'steady_routines'] },
  { key: 'hab_bag_by_door',     cat: 'habits', min: 2,  text: 'Put tomorrow\'s bag or keys by the door tonight.', values: ['steady_routines', 'focus'] },
  { key: 'hab_one_tab',         cat: 'habits', min: 2,  text: 'Close every browser tab but the one you are using.', values: ['focus'] },
  { key: 'hab_lamp_light',      cat: 'habits', min: 2,  text: 'Switch to a lamp instead of the overhead light for the rest of the evening.', values: ['calm_evenings'] },
  { key: 'hab_close_the_day',   cat: 'habits', min: 2, write: true, text: 'Write one line that closes the day: what is done, and what can wait.', values: ['calm_evenings', 'focus', 'steady_routines'] },
  { key: 'hab_outside_first',   cat: 'habits', min: 5,  text: 'Step outside for five minutes before the day\'s first task.', values: ['time_outdoors', 'energy'] },
  { key: 'hab_kind_start',      cat: 'habits', min: 2,  text: 'Start the day with one kind sentence to yourself, out loud or in your head.', values: ['self_kindness'] },
  { key: 'hab_pen_by_chair',    cat: 'habits', min: 5,  text: 'Keep a pen and paper by your chair, and doodle while the kettle boils.', values: ['creativity'] },
  { key: 'hab_hello_passerby',  cat: 'habits', min: 2,  text: 'Say hello to one person you would usually pass by.', values: ['connection'] },

  // Short self-care
  { key: 'sc_slow_breaths',     cat: 'self_care', min: 2,  text: 'Take five slow breaths, a little longer out than in.' },
  { key: 'sc_warm_drink',       cat: 'self_care', min: 5,  text: 'Make a warm drink and have it without a screen.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_stretch_neck',     cat: 'self_care', min: 2,  text: 'Roll your shoulders and stretch your neck, slowly, both sides.', values: ['energy', 'focus'] },
  { key: 'sc_kind_note',        cat: 'self_care', min: 2,  text: 'Say one thing to yourself you would say to a friend who had your day.', values: ['self_kindness'] },
  { key: 'sc_wind_down_music',  cat: 'self_care', min: 10, text: 'Put on three songs you find soothing and do nothing else.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_long_shower',      cat: 'self_care', min: 10, text: 'Take an unhurried shower or bath and notice the warmth.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_snack_sit',        cat: 'self_care', min: 5,  text: 'Eat a snack sitting down, without doing anything else.', values: ['self_kindness', 'energy'] },
  { key: 'sc_dim_lights',       cat: 'self_care', min: 2,  text: 'Dim the lights an hour before bed and let the evening slow down.', values: ['calm_evenings'] },
  { key: 'sc_slow_face_wash',   cat: 'self_care', min: 5,  text: 'Wash your face slowly with warm water, as if there is all the time in the world.', values: ['calm_evenings', 'self_kindness'] },
  { key: 'sc_sit_in_sun',       cat: 'self_care', min: 5,  text: 'Sit in a patch of sunlight, or by a bright window, for five minutes.', values: ['energy', 'time_outdoors'] },
  { key: 'sc_do_nothing',       cat: 'self_care', min: 2,  text: 'Sit and do nothing at all for two minutes.', values: ['calm_evenings', 'focus'] },
  { key: 'sc_bright_song',      cat: 'self_care', min: 5,  text: 'Put on one song that brightens the morning while you get ready.', values: ['energy'] },
  { key: 'sc_hand_lotion',      cat: 'self_care', min: 2,  text: 'Rub lotion into your hands slowly and notice the scent.', values: ['self_kindness', 'calm_evenings'] },
  { key: 'sc_drink_outside',    cat: 'self_care', min: 5,  text: 'Take your warm drink outside, or to an open window.', values: ['time_outdoors', 'calm_evenings'] },
  { key: 'sc_screen_free_meal', cat: 'self_care', min: 20, text: 'Have one meal today with no screen in sight.', values: ['focus', 'connection', 'steady_routines'] },
  { key: 'sc_same_wind_down',   cat: 'self_care', min: 5,  text: 'Have the same small wind-down as last night: a drink, a page, lights down.', values: ['steady_routines', 'calm_evenings'] },
  { key: 'sc_face_same_time',   cat: 'self_care', min: 2,  text: 'Wash your face at about the same time as last night.', values: ['steady_routines'] },
  { key: 'sc_two_warm_drinks',  cat: 'self_care', min: 5,  text: 'Make a warm drink for yourself and one for someone else.', values: ['connection', 'self_kindness'] },
  { key: 'sc_do_it_beautifully', cat: 'self_care', min: 5, text: 'Do one everyday thing a little more beautifully: plate the food, fold the towel.', values: ['creativity', 'self_kindness'] },

  // Reflection prompts (personal reflection, not assessment)
  { key: 'ref_went_well',       cat: 'reflection', min: 5, write: true,  text: 'Write one thing that went a bit better than expected today.' },
  { key: 'ref_ideal_evening',   cat: 'reflection', min: 5, write: true,  text: 'Describe, in a few lines, an evening you would enjoy.', values: ['calm_evenings'] },
  { key: 'ref_small_win',       cat: 'reflection', min: 2, write: true,  text: 'Note a small thing you finished today, however small.', values: ['focus', 'steady_routines', 'self_kindness'] },
  { key: 'ref_what_matters',    cat: 'reflection', min: 10, write: true, text: 'List what you spent time on today, and star what you want more of.', values: ['focus'] },
  { key: 'ref_person_admire',   cat: 'reflection', min: 5, write: true,  text: 'Write about someone you admire and one thing they do that you like.', values: ['connection', 'self_kindness'] },
  { key: 'ref_future_self',     cat: 'reflection', min: 10, write: true, text: 'Write a short note from you a year from now, about an ordinary good day.', values: ['self_kindness', 'focus'] },
  { key: 'ref_idea_page',       cat: 'reflection', min: 10, write: true, text: 'Fill half a page with ideas you would like to try, good or silly.', values: ['creativity'] },
  { key: 'ref_keep_from_tonight', cat: 'reflection', min: 5, write: true, text: 'Write what you would keep from tonight, and one thing you would skip next time.', values: ['calm_evenings'] },
  { key: 'ref_routine_held',    cat: 'reflection', min: 5, write: true,  text: 'Note the one part of today\'s routine that held, and what made it easy.', values: ['steady_routines'] },
  { key: 'ref_energy_high',     cat: 'reflection', min: 5, write: true,  text: 'List when your energy was highest today and what you were doing.', values: ['energy'] },
  { key: 'ref_outside_moment',  cat: 'reflection', min: 2, write: true,  text: 'Describe one moment outdoors today in a sentence.', values: ['time_outdoors'] },
  { key: 'ref_who_crossed_mind', cat: 'reflection', min: 2, write: true, text: 'Name one person who crossed your mind today, and why.', values: ['connection'] },
  { key: 'ref_handled_well',    cat: 'reflection', min: 2, write: true,  text: 'Write one sentence about something you handled well today.', values: ['self_kindness'] },
  { key: 'ref_one_thing_tomorrow', cat: 'reflection', min: 2, write: true, text: 'Name the one thing that matters most tomorrow.', values: ['focus'] },
  { key: 'ref_three_odd_words', cat: 'reflection', min: 2, write: true,  text: 'Write three words about today that nobody else would choose.', values: ['creativity'] },

  // Gratitude
  { key: 'gr_three_things',     cat: 'gratitude', min: 5, write: true,  text: 'Write three things you are glad of today, one line each.' },
  { key: 'gr_one_thing',        cat: 'gratitude', min: 2, write: true,  text: 'Name one thing from today you are glad happened.' },
  { key: 'gr_thank_someone',    cat: 'gratitude', min: 5,  text: 'Send someone a short thank-you for something specific.', values: ['connection'] },
  { key: 'gr_senses',           cat: 'gratitude', min: 2,  text: 'Notice one pleasant thing for each of three senses.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'gr_letter',           cat: 'gratitude', min: 20, write: true, text: 'Write a longer thank-you letter, whether or not you send it.', values: ['connection', 'self_kindness'] },
  { key: 'gr_evening_glad',     cat: 'gratitude', min: 2, write: true,  text: 'Name one thing about this evening you are glad of.', values: ['calm_evenings'] },
  { key: 'gr_body_thanks',      cat: 'gratitude', min: 2,  text: 'Thank your body, silently, for one thing it did today.', values: ['self_kindness', 'energy'] },
  { key: 'gr_routine_glad',     cat: 'gratitude', min: 2, write: true,  text: 'Name one everyday routine you are glad to have.', values: ['steady_routines'] },
  { key: 'gr_outdoors_glad',    cat: 'gratitude', min: 2, write: true,  text: 'Note one thing outside today you were glad to see.', values: ['time_outdoors'] },
  { key: 'gr_made_thing',       cat: 'gratitude', min: 2, write: true,  text: 'Name one thing someone made that you enjoyed today.', values: ['creativity'] },
  { key: 'gr_own_time',         cat: 'gratitude', min: 2, write: true,  text: 'Name one stretch of today that was yours to spend as you chose.', values: ['focus'] },

  // Movement
  { key: 'mv_walk_block',       cat: 'movement', min: 10, text: 'Walk around the block at an easy pace.', values: ['energy', 'time_outdoors'] },
  { key: 'mv_stand_stretch',    cat: 'movement', min: 2,  text: 'Stand up and reach for the ceiling, then the floor.', values: ['energy', 'focus'] },
  { key: 'mv_dance_song',       cat: 'movement', min: 5,  text: 'Move however you like to one song you enjoy.', values: ['energy', 'creativity', 'self_kindness'] },
  { key: 'mv_stairs',           cat: 'movement', min: 2,  text: 'Take the stairs once today where you would take the elevator.', values: ['energy'] },
  { key: 'mv_gentle_stretch',   cat: 'movement', min: 10, text: 'Do ten minutes of gentle stretching before bed.', values: ['calm_evenings'] },
  { key: 'mv_long_walk',        cat: 'movement', min: 20, text: 'Take a twenty-minute walk somewhere you like.', values: ['energy', 'time_outdoors'] },
  { key: 'mv_evening_stroll',   cat: 'movement', min: 10, text: 'Take a slow ten-minute stroll after dinner.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'mv_morning_stretch',  cat: 'movement', min: 5,  text: 'Stretch for five minutes before breakfast, at the same time as yesterday if you can.', values: ['steady_routines', 'energy'] },
  { key: 'mv_walk_with',        cat: 'movement', min: 20, text: 'Invite someone along on a walk, in person or on the phone.', values: ['connection'] },
  { key: 'mv_between_tasks',    cat: 'movement', min: 5,  text: 'Walk for five minutes between two tasks instead of scrolling.', values: ['focus', 'energy'] },
  { key: 'mv_kind_pace',        cat: 'movement', min: 10, text: 'Move for ten minutes at a pace that feels kind, not hard.', values: ['self_kindness'] },
  { key: 'mv_one_foot',         cat: 'movement', min: 2,  text: 'Stand on one foot while the kettle boils, then the other.', values: ['energy', 'steady_routines'] },
  { key: 'mv_shake_out',        cat: 'movement', min: 2,  text: 'Shake out your arms and legs for a minute, like shaking off the day.', values: ['calm_evenings', 'energy'] },
  { key: 'mv_move_to_music',    cat: 'movement', min: 5,  text: 'Move to one song in a way nobody has to see.', values: ['creativity', 'self_kindness'] },
  { key: 'mv_walk_on_phone',    cat: 'movement', min: 5,  text: 'Take a five-minute walk while on the phone with someone.', values: ['connection', 'energy'] },
  { key: 'mv_one_lap',          cat: 'movement', min: 5,  text: 'Walk one lap of the yard, the block or the parking lot.', values: ['time_outdoors', 'energy'] },

  // Nature
  { key: 'na_sky_minute',       cat: 'nature', min: 2,  text: 'Step outside, or to a window, and look at the sky for a minute.' },
  { key: 'na_plant_care',       cat: 'nature', min: 5,  text: 'Water or tend a plant, or pick one to bring home.', values: ['steady_routines', 'self_kindness'] },
  { key: 'na_find_green',       cat: 'nature', min: 10, text: 'Find the nearest patch of green and spend ten minutes there.', values: ['time_outdoors', 'energy'] },
  { key: 'na_sunset',           cat: 'nature', min: 10, text: 'Watch the light change at sunset, or the sky after dark.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'na_eat_outside',      cat: 'nature', min: 20, text: 'Have a meal or a drink outdoors.', values: ['time_outdoors', 'connection'] },
  { key: 'na_notice_five',      cat: 'nature', min: 5,  text: 'On a walk, notice five living things you had not noticed before.', values: ['time_outdoors', 'focus'] },
  { key: 'na_evening_air',      cat: 'nature', min: 2,  text: 'Step outside for a minute of evening air before you settle in.', values: ['calm_evenings', 'time_outdoors'] },
  { key: 'na_same_spot',        cat: 'nature', min: 5,  text: 'Visit the same outdoor spot as yesterday and notice what changed.', values: ['steady_routines', 'time_outdoors'] },
  { key: 'na_morning_birds',    cat: 'nature', min: 2,  text: 'Listen for birds for a minute at the start of the day.', values: ['energy', 'time_outdoors'] },
  { key: 'na_park_phone_away',  cat: 'nature', min: 10, text: 'Spend ten minutes in a park or yard with the phone put away.', values: ['time_outdoors', 'focus'] },
  { key: 'na_photo_sky',        cat: 'nature', min: 2,  text: 'Take a photo of today\'s sky.', values: ['creativity', 'time_outdoors'] },
  { key: 'na_share_view',       cat: 'nature', min: 5,  text: 'Send someone a photo of something outside that you liked.', values: ['connection', 'time_outdoors'] },
  { key: 'na_sit_by_tree',      cat: 'nature', min: 10, text: 'Sit under or near a tree for ten minutes and do nothing in particular.', values: ['self_kindness', 'calm_evenings'] },

  // Connection
  { key: 'co_text_friend',      cat: 'connection', min: 2,  text: 'Send a friend a message about something that made you think of them.', values: ['connection'] },
  { key: 'co_call',             cat: 'connection', min: 10, text: 'Call someone you have not spoken to in a while.', values: ['connection'] },
  { key: 'co_ask_question',     cat: 'connection', min: 5,  text: 'Ask someone a question about their day, and listen to the answer.', values: ['connection'] },
  { key: 'co_shared_meal',      cat: 'connection', min: 20, text: 'Share a meal or a walk with someone.', values: ['connection', 'time_outdoors'] },
  { key: 'co_compliment',       cat: 'connection', min: 2,  text: 'Give someone a sincere compliment.', values: ['connection', 'self_kindness'] },
  { key: 'co_evening_chat',     cat: 'connection', min: 10, text: 'Spend ten screen-free minutes talking with someone at home, or on a call.', values: ['calm_evenings', 'connection'] },
  { key: 'co_morning_message',  cat: 'connection', min: 2,  text: 'Send a good-morning message to the same person as yesterday.', values: ['steady_routines', 'connection'] },
  { key: 'co_small_favor',      cat: 'connection', min: 5,  text: 'Ask someone for a small favor, and let them say yes.', values: ['self_kindness', 'connection'] },
  { key: 'co_plan_to_meet',     cat: 'connection', min: 5,  text: 'Put one plan to see someone on the calendar.', values: ['connection', 'focus'] },
  { key: 'co_share_find',       cat: 'connection', min: 2,  text: 'Share something you made or found with one person.', values: ['creativity', 'connection'] },
  { key: 'co_walk_and_talk',    cat: 'connection', min: 20, text: 'Go for a walk with someone and leave the phones in your pockets.', values: ['time_outdoors', 'connection', 'energy'] },
  { key: 'co_goodnight',        cat: 'connection', min: 2,  text: 'Say goodnight to someone, in person or by message.', values: ['calm_evenings', 'connection'] },
  { key: 'co_swap_energy',      cat: 'connection', min: 5,  text: 'Ask someone what gave them energy today, and swap answers.', values: ['energy', 'connection'] },
  { key: 'co_step_out_together', cat: 'connection', min: 2, text: 'Invite someone to step outside with you for a few minutes.', values: ['time_outdoors', 'connection'] },
  { key: 'co_photo_of_made',    cat: 'connection', min: 2,  text: 'Send someone a photo of something you made today, even a meal.', values: ['connection', 'creativity'] },

  // Creativity
  { key: 'cr_doodle',           cat: 'creativity', min: 5,  text: 'Doodle for five minutes, with no aim at all.', values: ['creativity', 'calm_evenings'] },
  { key: 'cr_photo',            cat: 'creativity', min: 2,  text: 'Take one photo of something ordinary that looks good.', values: ['creativity', 'time_outdoors'] },
  { key: 'cr_mandala',          cat: 'creativity', min: 20, text: 'Color part of a mandala on the Mandalas page.', values: ['creativity', 'calm_evenings'] },
  { key: 'cr_new_recipe',       cat: 'creativity', min: 20, text: 'Cook something slightly new, or an old favorite a new way.', values: ['creativity', 'connection'] },
  { key: 'cr_six_words',        cat: 'creativity', min: 2, write: true,  text: 'Describe today in exactly six words.', values: ['creativity', 'self_kindness'] },
  { key: 'cr_evening_page',     cat: 'creativity', min: 10, write: true, text: 'Write a page of whatever comes, no editing, to end the day.', values: ['calm_evenings', 'creativity'] },
  { key: 'cr_hum_a_song',       cat: 'creativity', min: 2,  text: 'Hum or sing one song while you do a chore.', values: ['energy', 'creativity'] },
  { key: 'cr_rearrange_corner', cat: 'creativity', min: 10, text: 'Rearrange one shelf or corner until it pleases you.', values: ['steady_routines', 'creativity', 'focus'] },
  { key: 'cr_sketch_outside',   cat: 'creativity', min: 10, text: 'Sketch one thing you can see outside; badly is fine.', values: ['time_outdoors', 'creativity'] },
  { key: 'cr_card_for_someone', cat: 'creativity', min: 20, text: 'Make a small card or drawing for someone.', values: ['connection', 'creativity'] },
  { key: 'cr_friendly_playlist', cat: 'creativity', min: 10, text: 'Put together a short playlist of songs that feel like a friend.', values: ['self_kindness', 'creativity'] },
  { key: 'cr_same_shape',       cat: 'creativity', min: 2,  text: 'Doodle the same little shape you drew yesterday, or start one today.', values: ['steady_routines', 'creativity'] },
  { key: 'cr_doodle_before_task', cat: 'creativity', min: 2, text: 'Doodle for two minutes before you start a task, to clear the way.', values: ['focus', 'creativity'] },
  { key: 'cr_tiny_note',        cat: 'creativity', min: 5,  text: 'Draw or write a tiny note for someone and leave it where they will find it.', values: ['connection', 'creativity'] },
];

/**
 * The chapters of every quest, in order. `at` is how many days the member must
 * have shown up — on any days, in a row or not — for the chapter to open.
 * The story lines are filled with the value's phrase.
 */
export const CHAPTERS = [
  { at: 0,  place: 'The Trailhead',     story: (p) => `You set out toward ${p}. The path is short to start, and there is no hurry.` },
  { at: 3,  place: 'The First Clearing', story: (p) => `Three days in, the trees open up. You have already made a little room for ${p}.` },
  { at: 7,  place: 'The Stream Crossing', story: () => `A week of showing up. The stepping stones are the small things you keep choosing.` },
  { at: 12, place: 'The Quiet Grove',    story: () => `The path is familiar now. Some days it will be longer, some shorter, and both count.` },
  { at: 18, place: 'The Lookout',        story: (p) => `From up here you can see how far you have come toward ${p}.` },
  { at: 25, place: 'The Open Meadow',    story: () => `This part of the map is yours to shape. Keep what helped and let the rest go.` },
  { at: 35, place: 'The Far Hills',      story: () => `The path keeps going as long as you like. Pick a new side path whenever you want one.` },
];

/** Actions shown on each chapter, and optional side paths. */
export const MAIN_PER_CHAPTER = 3;

const byKey = new Map(ACTIONS.map(a => [a.key, a]));
export const action = (key) => byKey.get(key) || null;
export const valueOf = (key) => VALUES.find(v => v.key === key) || null;

/** A small seeded shuffle so the same quest always draws the same map. */
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}
function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const fits = (a, value) => !a.values || a.values.includes(value);
/** True when the action was written with this focus in mind (not merely fine for anyone). */
export const suits = (a, value) => !!a?.values && a.values.includes(value);

/**
 * The actions that fit a member's choices: the chosen categories, no longer
 * than their time, and suited to their focus where possible. Returned best
 * first: actions written for the focus, then ones that suit anyone, and only
 * if those two together come to fewer than a chapter's worth, the rest of
 * the category.
 */
export function pool({ value, categories, minutes }) {
  const cats = new Set(categories || []);
  const live = ACTIONS.filter(a => !a.retired && cats.has(a.cat) && a.min <= minutes);
  const own = live.filter(a => suits(a, value));
  const anyone = live.filter(a => !a.values);
  const suited = [...own, ...anyone];
  return suited.length >= MAIN_PER_CHAPTER ? suited : [...suited, ...live.filter(a => !fits(a, value))];
}

/**
 * A few short actions written for a focus, across kinds of practice, so the
 * setup can show what picking it leads to. Shortest first, one per category.
 */
export function samplesFor(value, n = 3) {
  const seen = new Set(), out = [];
  for (const a of [...ACTIONS].filter(a => !a.retired && suits(a, value)).sort((x, y) => x.min - y.min)) {
    if (seen.has(a.cat)) continue;
    seen.add(a.cat); out.push(a);
    if (out.length === n) break;
  }
  return out;
}

/**
 * Draws the quest map. Same inputs, same map.
 * Returns { value, chapters: [{ index, place, story, at, main: [action], side: action|null }] }.
 * Main actions come from the member's own categories; the side path on each
 * chapter is an optional idea from a category they did not pick, still no
 * longer than their time, so there is always something new to try but never
 * something they must do.
 */
export function buildQuest({ id = '', value, categories, minutes }) {
  const v = valueOf(value);
  if (!v) throw new Error(`unknown value ${value}`);
  const rand = seeded(`${id}|${value}|${[...categories].sort().join(',')}|${minutes}`);
  const fit = pool({ value, categories, minutes });
  // A fresh deck holds the actions written for this focus when there are
  // enough of them for seven different chapters, so what a chapter shows
  // speaks to what the member asked for; with fewer, the ones that suit
  // anyone (and then the rest of the category) are dealt after them.
  const own = fit.filter(a => suits(a, value));
  const freshDeck = () => own.length >= 2 * MAIN_PER_CHAPTER ? shuffle(own, rand)
    : [...shuffle(own, rand), ...shuffle(fit.filter(a => !suits(a, value)), rand)];
  const picked = new Set(categories);
  const others = shuffle(ACTIONS.filter(a => !a.retired && !picked.has(a.cat) && a.min <= minutes), rand);
  const size = Math.min(MAIN_PER_CHAPTER, fit.length);
  const seen = new Set();
  let deck = [];
  const chapters = CHAPTERS.map((c, i) => {
    // Deal from a deck, so every action turns up before any repeats.
    // If that would give this chapter the same set as an earlier one, draw a
    // fresh set instead (a few tries), so the story keeps offering new mixes.
    let main = [];
    for (let tries = 0; tries < 12; tries++) {
      const hand = new Map();
      while (hand.size < size) {
        if (!deck.length) deck = freshDeck();
        const a = deck.shift();
        hand.set(a.key, a);
      }
      main = [...hand.values()];
      const id = main.map(a => a.key).sort().join();
      if (!seen.has(id)) { seen.add(id); break; }
      deck = freshDeck();
    }
    return {
      index: i, place: c.place, at: c.at, story: c.story(v.phrase),
      main,
      side: others.length ? others[i % others.length] : null,
    };
  });
  return { value: v, chapters };
}

/**
 * How far along the member is. `days` is the list of dates (YYYY-MM-DD) on
 * which they did anything on the quest or logged a goal; duplicates are fine.
 * Only ever counts up: a missed day takes nothing away.
 */
export function progress(days, chapters = CHAPTERS) {
  const shown = new Set(days).size;
  let open = 0;
  chapters.forEach((c, i) => { if (shown >= c.at) open = i; });
  const next = chapters[open + 1] || null;
  return {
    days: shown,
    open,                                   // index of the newest open chapter
    next: next ? { index: open + 1, place: next.place, at: next.at, left: next.at - shown } : null,
  };
}

/** Milestones worth a small celebration, by days shown up. */
export const MILESTONES = [1, 3, 7, 12, 18, 25, 35, 50, 75, 100];
export const milestoneFor = (n) => MILESTONES.includes(n);

/**
 * The suggestion helper. Optional, off by default, and rule-based: it only
 * looks at the minutes and categories the member already chose, never at
 * anything they wrote, and makes no decisions about them.
 */
export const helper = {
  /** A shorter action in the same category, if there is one. */
  shorter(key, { categories } = {}) {
    const a = action(key);
    if (!a) return null;
    const cands = ACTIONS.filter(x => !x.retired && x.cat === a.cat && x.min < a.min);
    if (cands.length) return cands.sort((x, y) => y.min - x.min)[0];
    const cats = new Set(categories || []);
    return ACTIONS.filter(x => !x.retired && cats.has(x.cat) && x.min < a.min)
      .sort((x, y) => y.min - x.min)[0] || null;
  },
  /** A nudge for the What helped note, drawn from the member's own categories. */
  prompt(categories, seed = Date.now()) {
    const ideas = (categories || []).flatMap(c => PROMPT_IDEAS[c] || []);
    const list = ideas.length ? ideas : PROMPT_IDEAS.reflection;
    return list[Math.floor(seeded(seed)() * list.length)];
  },
};

/** Nudges for the What helped note, by category: each asks what helped today,
 *  in the member's own kinds of practice. Personal reflection only. */
export const PROMPT_IDEAS = {
  habits:     ['Which small routine made today run a little smoother?', 'What did you do today that you would do again tomorrow?'],
  self_care:  ['When did you feel most at ease today, and what were you doing?', 'What was one kind thing you did for yourself today?'],
  reflection: ['What is one moment from today you would like to remember?', 'What helped more than you expected it to today?'],
  gratitude:  ['Who or what made today a little better?', 'What is one ordinary thing from today you were glad of?'],
  movement:   ['Did moving, even a little, change how the day felt?', 'Where did your feet take you today?'],
  nature:     ['What did you notice outside today that helped?', 'When were you outdoors today, and how did it feel?'],
  connection: ['Which conversation or message helped today?', 'Who did you feel close to today, even for a moment?'],
  creativity: ['Did making or noticing something, even a doodle, help today?', 'What caught your eye today in a good way?'],
};
