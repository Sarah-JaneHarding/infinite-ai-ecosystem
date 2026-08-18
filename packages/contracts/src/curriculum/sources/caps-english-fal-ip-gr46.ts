// Derived structure from English First Additional Language Intermediate Phase Grades 4-6.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_ENG_FAL_IP_DOC_ID = 'caps-english-fal-ip-gr46-2011' as const;
export const CAPS_ENG_FAL_IP_VERSION = '2011-ratified' as const;
export const CAPS_ENG_FAL_IP_ISBN = '978-1-4315-0466-4' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_ENG_FAL_IP_DOC_ID,
    documentVersion: CAPS_ENG_FAL_IP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_ENG_FAL_IP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Reading and Viewing',
  'Writing and Presenting',
  'Language Structures and Conventions',
] as const;
export type CapsengfalipContentArea = (typeof CAPS_ENG_FAL_IP_CONTENT_AREAS)[number];

export interface CapsengfalipTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_ENG_FAL_IP_TOPIC_PROGRESSIONS: readonly CapsengfalipTopicProgression[] =
  [
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'FAL Grades 4-6 Phase Overview: Listening and Speaking',
      grade: 'ALL',
      description:
        'Content: Listening comprehension; different forms of oral communication \u2014 conversation; directions and instructions; retelling stories; storytelling; role-play; group discussion; short talks; short poems and rhymes; language games. Strategies: make notes, lists, summaries; retell, describe, ask clarifying questions, express opinions; recall specific detail; reflect on values/messages/stereotyping; describe characters/storyline/setting. Communication for social purposes: initiating and sustaining conversations; turn taking; sharing ideas; encouraging use of the additional language. Prepared and unprepared short talks: research, organise coherently, develop main/supporting ideas, correct format/vocabulary/conventions, tone/voice projection/pace/eye contact/posture/gestures/visual aids. Time: 2 hrs per 2-week cycle, all grades.',
      basis: ref('Section 3.1, Overview of content, skills and strategies'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grades 4-6 Phase Overview: Reading and Viewing',
      grade: 'ALL',
      description:
        'Prescribed text types: stories (contemporary realistic fiction, traditional stories, myths/legends, folk tales, fables, adventure, science fiction, biographies, historical fiction); plays; poetry; information texts (procedures, factual recounts, general knowledge, reports); social texts (invitations, cards, letters, notices); media texts (advertisements, newspaper reports, magazine articles, pamphlets); visual literacy (posters, advertisements, notices, drawings, photographs, cartoons, comics, diagrams/graphs/ tables/charts). Reading types: close reading (comprehension, summaries); extended reading (oral discussions, book reviews, projects); prepared/unprepared reading aloud. Strategies: pre-reading (prior knowledge, predictions), reading (skimming, scanning, contextual clues, inferences), post-reading (graphic organisers, summaries, conclusions). Time: Grades 4-5 = 5 hrs per 2-week cycle; Grade 6 = 4 hrs.',
      basis: ref('Section 3.1, Overview of content, skills and strategies'),
    },
    {
      contentArea: 'Writing and Presenting',
      topicCode: null,
      topicName: 'FAL Grades 4-6 Phase Overview: Writing and Presenting',
      grade: 'ALL',
      description:
        'Types: word/sentence/paragraph writing; creative writing (descriptive, narrative, imaginative/poems, dialogue and play scripts); transactional writing (notes, messages, letters, cards, invitations, posters, notices, brochures, advertisements, short speeches, procedures/recipes/instructions/experiments, factual recounts/news reports, information texts, visual literacy texts). Process writing: pre-writing/planning (purpose, audience, brainstorming, organise); drafting (word choice, structuring sentences, main/supporting ideas, specific text features, reads own writing critically, peer feedback); revising (improves content and structure); editing (grammar, spelling, punctuation); presenting (neat, legible). Text lengths: Grade 4 \u2014 paragraph 30-40 words; story at least 50 words (1-2 paragraphs); letter 40-60 words. Grade 5 \u2014 paragraph 40-50 words; story at least 100 words (2-4 paragraphs). Grade 6 \u2014 paragraph 50-60 words; story at least 150 words (3-5 paragraphs). Oral: Grade 4-5 = 1 min; Grade 6 = 1-2 min. Time: Grades 4-5 = 2 hrs per 2-week cycle; Grade 6 = 3 hrs.',
      basis: ref('Section 3.1, Overview of content, skills and strategies'),
    },
    {
      contentArea: 'Language Structures and Conventions',
      topicCode: null,
      topicName: 'FAL Grades 4-6 Phase Overview: Language Structures and Conventions',
      grade: 'ALL',
      description:
        "Taught in context; 30 minutes per week for formal instruction. All grades build on FP foundation. Nouns: countable/uncountable, plurals, possessive, proper (capital), gender forms, abstract, concrete, compound. Determiners: a/an/the, quantity words. Pronouns: personal, demonstrative, possessive, reflexive. Adjectives: comparative/superlative, before/after nouns, different types (age, temperature, material). Verbs: subject-verb concord, command form, regular/irregular, 'to be' forms, negatives. Tenses: simple past/present/future, present progressive, present perfect, past progressive, future progressive. Modals: can/may (ability/permission), must/should/have to (obligation), shall/will (intention). Adverbs: time, place, manner, frequency, degree. Prepositions: position, direction, time, possession. Connecting words: addition (and), sequence (then/next), contrast (but), reason (because). Sentence structure: simple, compound, command, question forms, negative, conditional, passive, direct/reported speech. Punctuation: capital letters, full stop, comma, question mark, exclamation mark, apostrophe, quotation marks, colon. Vocabulary: lexical fields, synonyms, antonyms, homonyms, compound words, prefixes/suffixes, abbreviations, phrasal verbs, collocations, idioms. Spelling rules: plurals (-s/-es), long vowel silent-e, word families, sight words, dictionary use.",
      basis: ref('Section 3.1, Overview of content, skills and strategies'),
    },
    {
      contentArea: 'Language Structures and Conventions',
      topicCode: null,
      topicName:
        'FAL Grades 4-6: Vocabulary targets by term and text length expectations (Sections 3.2.3-3.2.5)',
      grade: 'ALL',
      description:
        'Vocabulary \u2014 common spoken words: Grade 4: T1=1600-2000, T2=1700-2500, T3=1850-3000, T4=2000-3500. Grade 5: T1=2200-3750, T2=2400-4000, T3=2700-4250, T4=3000-4500. Grade 6: T1=3250-4750, T2=3500-5000, T3=3700-5250, T4=4000-5500. Text lengths (to produce) \u2014 Grade 4: paragraph 30-40 words; story at least 50 words; letter 40-60 words; message 20-30 words; summary 30-40 words from 100-word text. Grade 5: paragraph 40-50 words; story at least 100 words; letter 60-80 words. Grade 6: paragraph 50-60 words; story at least 150 words; letter 80-100 words. Reading comprehension texts \u2014 Grade 4: 100-150 words; Grade 5: 150-200 words; Grade 6: 200-250 words.',
      basis: ref('Sections 3.2.3-3.2.5'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 1: Text type sequence',
      grade: '4',
      description:
        'W1-2: Story + personal recount. W3-4: Information text (news report/factual recount/map). W5-6: Story + descriptions of people or characters. W7-8: Information text \u2014 procedures, instructions, lists. W9-10: Song/poem + language game.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 2: Text type sequence',
      grade: '4',
      description:
        'W1-2: Story + personal recount + message. W3-4: Information text with visuals (charts/tables/diagrams/pictures/graphs) + poster + directions + description of an object + visual text (poster). W5-6: Story + poem. W7-8: Information text \u2014 procedures/instructions + visual text. W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 3: Text type sequence',
      grade: '4',
      description:
        'W1-2: Story + description of person/animal/character + dialogue + book review. W3-4: Information text (factual recount/news article/report) + visual text (poster/notices). W5-6: Story + poem. W7-8: Information text with visuals (charts/tables/diagrams/pictures/descriptions/procedures). W9-10: Play + role-play + dialogue + book review.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 4: Text type sequence',
      grade: '4',
      description:
        'W1-2: Conversation + language game + story. W3-4: Information text with visuals + interviews/talk shows + visual text (posters/notices) + messages. W5-6: Story + language game + diary. W7-8: Conversation + short talk/announcement + information text + visual text (poster/notice). W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 5 Term 1: Text type sequence',
      grade: '5',
      description:
        'W1-2: Story + personal recount. W3-4: Information text with visuals (charts/tables/diagrams/mindmaps/maps) + conversation + factual recount. W5-6: Story + role-play + description of people + invitation + message. W7-8: Information text \u2014 procedures/instructions/factual recount + language game. W9-10: Poem/song.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 5 Term 2: Text type sequence',
      grade: '5',
      description:
        'W1-2: Story + conversation + book/story review. W3-4: Information text with visuals + descriptions of objects/plants/animals/places + mindmap summary. W5-6: Story. W7-8: Information text \u2014 procedures/instructions/factual recounts + role-play. W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 5 Term 3: Text type sequence',
      grade: '5',
      description:
        'W1-2: Story + oral description of places/people + personal recount. W3-4: Short talk + information text with visuals + mindmap summary. W5-6: Story + poem. W7-8: Information text \u2014 procedures/conversation/language game/report. W9-10: Play + conversation + dialogue.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 5 Term 4: Text type sequence',
      grade: '5',
      description:
        'W1-2: Story + language game + personal recount + word puzzle. W3-4: Information text \u2014 magazine article/news report + factual text + poster. W5-6: Story + poem + personal recount + book review. W7-8: Information text (report) + conversation + visual text (poster). W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 6 Term 1: Text type sequence',
      grade: '6',
      description:
        'W1-2: Story + language game + word puzzle. W3-4: Information text (factual recount/news report/letter) + media text (advert) + conversation. W5-6: Story + personal recounts (diary/diary entries). W7-8: Information text with visuals + procedures/instructions/definitions + factual recounts + word puzzle. W9-10: Poem + description of person + description of object/animal/plant/place + language game.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 6 Term 2: Text type sequence',
      grade: '6',
      description:
        'W1-2: Story. W3-4: Information text (report) + description of object/animal/plant/place + visual text. W5-6: Story + personal recount + personal diary/letter + role-play. W7-8: Information text with visuals (timetables/TV schedules/charts) + definitions + book review + survey + questionnaire + language game + conversation + word puzzles. W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 6 Term 3: Text type sequence',
      grade: '6',
      description:
        'W1-2: Story + personal letter + diary + oral descriptions of places/animals/plants/objects. W3-4: Information text with visuals (charts/tables/diagrams/maps) + talk + survey + report. W5-6: Story + poem. W7-8: Information text \u2014 procedures/instructions/report + language game + mindmap summary. W9-10: Conversation + play.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 6 Term 4: Text type sequence',
      grade: '6',
      description:
        'W1-2: Story + letter + book review. W3-4: Information text (report) + short talk + visual text + language game + definitions + word puzzle. W5-6: Story + poem + book review + personal letter. W7-8: Media text (magazine article/news report) + poster + advertisement + conversation + discussion. W9-10: Summative assessment.',
      basis: ref('Section 3.2.1, Spread of texts table'),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 1 W1-2: Story + personal recount',
      grade: '4',
      description:
        'L&S: Listens to story \u2014 answers simple questions, retells in right sequence, names characters, expresses feelings; gives a simple personal recount (stays on topic, tells events in sequence); daily practice: rhyme/poem/song or language game. R&V: Reads a story \u2014 pre-reading (prediction from title/pictures), reading strategies (phonic/contextual clues), answers questions, explains storyline, identifies main characters, retells in sequence, expresses feelings; does comprehension activity (oral or written), discusses vocabulary, spells 10 words, uses dictionary; reflects on independent reading. W&P: Writes about story (sentences/summary/own ending) + writes simple personal recount using frame (Yesterday I... Then I...); creates a personal dictionary. LSC: Countable/uncountable nouns; determiners (one, two, first, second, last); simple past tense; synonyms. Spelling \u2014 full stop, capital/small letters.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 1 W3-4: Information text \u2014 factual recount/news report/map',
      grade: '4',
      description:
        'L&S: Listens to information text (factual recount/news report) \u2014 answers questions, describes event, shares opinions; listens to and responds to simple oral directions (follows, shows understanding). R&V: Reads factual recount/news report \u2014 pre-reading (title/pictures), contextual clues, discusses headline/headings, answers questions about main idea and specific details; reads a simple map (identifies places, follows and describes route). W&P: Writes a factual recount/news event (using frame, title, appropriate vocabulary); labels a simple map. LSC: Adjectives (before nouns); verbs describing actions; simple past and present progressive; connecting words (contrast=but, reason=because, purpose=so that); antonyms; abbreviations (acronyms, initialism).',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 1 W5-6: Story + description of characters',
      grade: '4',
      description:
        'L&S: Listens to story \u2014 predicts, answers questions, retells in right sequence, names characters, identifies characters from oral descriptions; describes people/characters using adjectives. R&V: Reads story \u2014 predicting from title/pictures, makes predictions, uses phonic/contextual clues, explains storyline and identifies main characters, retells in sequence, answers questions; reads aloud with clear pronunciation, expression and tempo. W&P: Writes about story (summary/own ending/opinions) + writes description of people/characters (what people look like, adjectives, new vocabulary). LSC: Subject-verb concord; regular verb forms; adverbs of frequency; prepositions of position; connecting words (addition=and, sequence=then/before); adjectives (age); compound words.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 1 W7-8: Information text \u2014 procedures/instructions',
      grade: '4',
      description:
        'L&S: Listens to and carries out instructions (e.g. recipe) \u2014 answers questions, asks questions, describes what needs to be done; gives simple instructions (correct details, sequence, command form). R&V: Reads procedural text (recipe/instructions) \u2014 predicts from title/pictures, uses contextual clues, answers questions, describes sequence of instructions, follows instructions; reads aloud. W&P: Writes simple instructions using frame (numbered steps, command form, correct sequence) + writes a list with headings (format, heading, singular/plural correctly). LSC: Command form; negative forms; countable nouns/plurals; present perfect; must/should/have to.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 1 W9-10: Song/poem + language game',
      grade: '4',
      description:
        "L&S: Listens to song/simple poem \u2014 recalls main idea, identifies rhyme and rhythm, identifies words with same starting sound, expresses feelings, performs selected lines; plays a more complex language game (follows instructions, uses range of vocabulary, takes turns). R&V: Reads simple poem/s \u2014 identifies rhythm and rhyme, breaks words into syllables, expresses feelings, answers questions; reads and solves a word puzzle; reads aloud with appropriate pronunciation, rhythm and expression. W&P: Writes sentences that rhyme or simple poem (using frame) \u2014 pairs of same-length rhyming sentences, appropriate rhythm/rhyme, knowledge of syllables; practises writing words with same starting sound. LSC: Verb 'to be' forms; present progressive; adjectives before nouns; pronouns; lexical fields.",
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 2 W1-2: Story + personal recount + message',
      grade: '4',
      description:
        'L&S: Listens to story \u2014 predicts, answers questions, retells in right sequence, names characters, gives personal response; gives a personal recount. R&V: Reads story \u2014 pre-reading, makes predictions and inferences, asks and answers questions, identifies plot/setting/character, explains opinions; reads aloud with pronunciation/expression/tempo; reflects on independent reading. W&P: Writes a message (appropriate content, format, addresses to person, ends with own name) + writes personal recount using frame. LSC: Proper nouns (capital letters); adjectives (age, temperature); irregular verb forms; simple sentences (subject-verb-object); plurals with -es.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 2 W3-4: Information text + visuals + description of object',
      grade: '4',
      description:
        'L&S: Listens to information text (weather report/description of place) \u2014 identifies specific details, interprets information; listens to and responds to simple oral directions; listens to and describes objects using adjectives. R&V: Reads information text with visuals (charts/tables/maps) \u2014 skimming, asks and answers questions, main idea and specific details, interprets visuals; reads visual text (poster) \u2014 purpose, language use, design features. W&P: Summarises information text with support (fills in missing words in chart/table/mindmap) + designs a visual text (poster) \u2014 appropriate information, correct format, design features. LSC: Articles (a/an/the/no article with uncountable); simple present for universal statements; future tense; connecting words. Words with long vowel silent-e.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 2 W5-6: Story + poem',
      grade: '4',
      description:
        "L&S: Listens to story \u2014 identifies specific details, retells, describes cause and effect, explains message; listens to poem/s \u2014 identifies rhyme and rhythm, expresses feelings, performs. R&V: Reads story \u2014 identifies plot, explains message, describes cause and effect, identifies stereotypes; reads poem/s \u2014 identifies rhythm/rhyme, breaks into syllables, expresses feelings; reads aloud with expression and tempo. W&P: Writes a story using frame (variety of vocabulary, connecting words, grammar, spelling, punctuation) + writes sentences that rhyme (same-length rhyming pairs, rhythm from syllable knowledge). LSC: Countable nouns; adjectives before nouns; verb 'to be'; simple past; adverbs of degree; alliteration, assonance, consonance, personification, rhyme, rhythm; phrasal verbs.",
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 2 W7-8: Procedures/instructions + information text with visuals',
      grade: '4',
      description:
        'L&S: Listens to and carries out instructions (e.g. recipe) \u2014 discusses specific details, asks questions; gives instructions (at least two steps, correct vocabulary and sequence); classifies things into groups. R&V: Reads procedural text \u2014 discusses specific details and sequence; reads information text with visuals (diagrams/tables/charts/mindmaps) \u2014 main ideas and specific details, interprets visual; answers comprehension. W&P: Writes about procedure with support (fills in details into frame); labels/completes a visual text (diagram/chart/mindmap). LSC: Command form; modals (can=ability, may=permission, must=necessity); shall/will (intention); adverbs of place and manner; antonyms.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 3 W1-2: Story + description of person/animal/place + book review',
      grade: '4',
      description:
        'L&S: Listens to story \u2014 discusses plot/setting/characters, answers questions, retells in right sequence, expresses feelings, describes causes and effects; describes person/animal/place. R&V: Reads story \u2014 interprets message, makes predictions/inferences, retells in sequence, describes feelings, discusses characters; reads book review (identifies key info, main points, format); role-plays based on the story; reads aloud. W&P: Writes dialogue (logical organisation, frame, direct speech, grammar) + writes description of person/animal/place (clear, complete sentences, adjectives, grammar). LSC: Personal pronouns; demonstrative pronouns; countable nouns; regular verbs; direct speech; quotation marks; colon for lists/direct speech.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 3 W3-4: Information text (factual recount/report) + visual text (poster/notices)',
      grade: '4',
      description:
        'L&S: Listens to information text \u2014 answers questions, describes events, shares opinions; participates in short conversation on familiar topic (takes turns, stays on topic, asks questions). R&V: Reads information text (factual recount/report) \u2014 pre-reading, scans/skims, answers complex questions; reads visual text (poster/notice) \u2014 discusses purpose, language, design features. W&P: Summarises information text with support (fills in missing words) + designs/produces a visual text (poster/notice) \u2014 correct format, design features. LSC: Nouns that only have plurals (scissors, trousers); comparative adjectives; reported speech; subject-verb concord; shortening words; acronyms, initialism.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 3 W5-6: Story + poem',
      grade: '4',
      description:
        "L&S: Listens to story \u2014 identifies specific details, retells in correct sequence, describes cause and effect, explains moral; listens to poem \u2014 discusses what it is about, identifies rhyme and rhythm. R&V: Reads story \u2014 identifies plot, explains moral, describes cause and effect, identifies stereotypes; reads poem \u2014 identifies rhythm/rhyme, expresses feelings; reads aloud. W&P: Writes a story using frame + writes sentences that rhyme. LSC: Countable nouns; adjectives before nouns; verb 'to be'; simple past; adverbs of degree; alliteration, assonance, consonance, personification; phrasal verbs.",
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 3 W7-8: Information text with visuals + procedural text',
      grade: '4',
      description:
        "L&S: Listens to and describes places/plants/animals/objects \u2014 identifies places, uses adjectives. R&V: Reads information text with visuals (charts/tables/maps) \u2014 skims for general idea, identifies and comments on main idea and specific details; reads procedural text \u2014 predicts, discusses specific details and sequence of instructions. W&P: Labels/completes visual text (charts/maps) \u2014 appropriate vocabulary, labels correctly; uses information from visual text to write information text. LSC: Prepositions (direction/time/possession); verb 'to be'; modals; connecting words (contrast/reason/purpose).",
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 3 W9-10: Play + role-play + dialogue',
      grade: '4',
      description:
        'L&S: Listens to play read aloud or from radio/TV \u2014 predicts from title, retells drama in sequence, names characters; role-plays a character or familiar situation (appropriate content, expresses feelings, stays on topic, social awareness). R&V: Reads a play \u2014 identifies story-line, discusses characters and setting, expresses feelings, discusses punctuation and format, acts out play/section; reflects on independent reading (book review). W&P: Writes a dialogue (appropriate characters, logical conversation, direct speech, variety of vocabulary) + writes simple book review using frame. LSC: Simple present and future; present progressive; adverbs of time; reported speech.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 4 W1-2: Conversation + language game + story',
      grade: '4',
      description:
        'L&S: Participates in conversation on familiar topic (takes turns, stays on topic, asks questions); plays complex language game (follows instructions, uses vocabulary range); daily practice: rhyme/poem/song. R&V: Reads a story \u2014 pre-reading, reading strategies, answers questions, discusses characters/setting/plot, expresses feelings; reads aloud. W&P: Writes a personal recount using frame + writes a message or note. LSC: Review of all nouns; possessive pronouns (mine, yours, his, hers, ours, theirs); reflexive pronouns; irregular verb forms; simple present tense.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 4 W3-4: Information text with visuals + poster/notices',
      grade: '4',
      description:
        'L&S: Listens to information text with visuals + descriptions \u2014 identifies specific details, interprets information, discusses usefulness; participates in discussions. R&V: Reads information text with visuals (charts/tables/diagrams) \u2014 main idea/specific details, interprets visuals; reads posters/notices \u2014 purpose, information, design features. W&P: Summarises information text + designs/produces a poster/notice. LSC: All tenses review; modals review; passive voice; reported speech; connecting words review.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'FAL Grade 4 Term 4 W5-6: Story + language game + diary',
      grade: '4',
      description:
        'L&S: Listens to story \u2014 listens/relates to own experience, identifies specific details; plays complex language game; daily practice activities. R&V: Reads story \u2014 predicts, uses reading strategies, identifies plot/setting/characters, discusses values; reflects on independent reading. W&P: Writes a diary entry (dated, past tense, first person, informal, describes own experiences). LSC: Review of sentence types; question forms; conditionals; all tenses.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName:
        'FAL Grade 4 Term 4 W7-8: Conversation + short talk/announcement + information text + visual text',
      grade: '4',
      description:
        'L&S: Participates in conversations \u2014 takes turns, stays on topic, asks relevant questions; prepares and gives a short talk or announcement. R&V: Reads information text + visual text (poster/notice) \u2014 main idea/specific details, interprets visuals, discusses purpose and design features. W&P: Writes a short speech or announcement; writes from information text to a visual (or vice versa). LSC: Review of all language structures covered during the year; vocabulary consolidation.',
      basis: ref(
        'Section 3.4, Content and Teaching Plans for English First Additional Language, Grade 4',
      ),
    },
  ];

export const CAPS_ENG_FAL_IP_METADATA = {
  documentId: CAPS_ENG_FAL_IP_DOC_ID,
  documentVersion: CAPS_ENG_FAL_IP_VERSION,
  title: 'English First Additional Language Intermediate Phase Grades 4-6',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0466-4',
  phase: 'Intermediate Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
