// Derived structure from English Home Language Intermediate Phase Grades 4-6.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_ENG_HL_IP_DOC_ID = 'caps-english-hl-ip-gr46-2011' as const;
export const CAPS_ENG_HL_IP_VERSION = '2011-ratified' as const;
export const CAPS_ENG_HL_IP_ISBN = '978-1-4315-0455-8' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_ENG_HL_IP_DOC_ID,
    documentVersion: CAPS_ENG_HL_IP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_ENG_HL_IP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Reading and Viewing',
  'Writing and Presenting',
  'Language Structures and Conventions',
] as const;
export type CapsenghlipContentArea = (typeof CAPS_ENG_HL_IP_CONTENT_AREAS)[number];

export interface CapsenghlipTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_ENG_HL_IP_TOPIC_PROGRESSIONS: readonly CapsenghlipTopicProgression[] = [
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'HL Grades 4-6 Phase Overview: Listening and Speaking',
    grade: 'ALL',
    description:
      'Content: Listening comprehension; different forms of oral communication \u2014 prepared/unprepared speech; prepared/unprepared reading aloud; speaking directions and instructions; storytelling; vote of thanks; role-play; group discussion; debate; interview. Strategies: re-tell the story; recall specific detail; reflect on values/messages/stereotyping; discuss character, plot and setting; express opinions; clarifying questions. Communication for social purposes: initiating and sustaining conversations; turn taking; defending a position; negotiation; sharing ideas. Prepared speech: research; organise material; develop main ideas with examples; correct format, vocabulary and conventions; tone, voice projection, pace, eye contact, posture, gestures; visual/audio aids. Time: 2 hrs per 2-week cycle, all grades.',
    basis: ref('Section 3.1, Overview of content, skills and strategies'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'HL Grades 4-6 Phase Overview: Reading and Viewing',
    grade: 'ALL',
    description:
      "Prescribed literature genres: folklore, short story, drama, poetry. Reading/viewing strategies (pre-reading, reading, post-reading): understand the text; close and critical reading (comprehension); independent reading for pleasure, information and learning. Text features: titles, illustrations, graphs, charts, headings, subheadings, captions, format. Text structures: lists, sequential order, description, procedures, main point and supporting points, narrative sequence. Strategies: skimming, scanning, inferring, rereading, making notes, summarising, clarifying, making inferences, explaining writer's point of view, drawing conclusions. Visual literacy: advertising, cartoons, comics, diagrams/graphs/tables/charts. Poetry: literal/figurative meaning, theme, imagery, sound devices (rhyme, rhythm, alliteration, onomatopoeia). Stories/drama: plot, characters, characterisation, theme, setting, text structure. Information and social texts: audience/purpose, main idea, text structure. Time: 5 hrs per 2-week cycle, all grades.",
    basis: ref('Section 3.1, Overview of content, skills and strategies'),
  },
  {
    contentArea: 'Writing and Presenting',
    topicCode: null,
    topicName: 'HL Grades 4-6 Phase Overview: Writing and Presenting',
    grade: 'ALL',
    description:
      'Types: word/sentence/paragraph writing; creative writing (descriptive, narrative, imaginative, dialogue, short play scripts); transactional writing (notes, messages, letters, cards, invitations, posters, notices, brochures, advertisements, short speeches, procedural texts, factual recounts, news reports, information texts, graphic texts). Process writing: pre-writing/planning (purpose, audience, mind-maps, brainstorming, organise); drafting (word choice, structuring sentences, main/supporting ideas); revising (improves content and structure); editing/proofreading (grammar, spelling, punctuation); presenting (neat, legible final version). Text lengths: Grade 4 \u2014 paragraph 50-60 words; essay 100-120 words; short story 120-140 words; summary 40-50 words; comprehension texts 150-200 words. Grade 5 \u2014 paragraph 60-80 words; essay 120-140 words; short story 140-160 words; summary 50-60 words. Grade 6 \u2014 paragraph 80-100 words; essay 140-150 words; short story 160-170 words; summary 60-70 words. Time: 4 hrs per 2-week cycle, all grades.',
    basis: ref('Section 3.1, Overview of content, skills and strategies'),
  },
  {
    contentArea: 'Language Structures and Conventions',
    topicCode: null,
    topicName: 'HL Grades 4-6 Phase Overview: Language Structures and Conventions',
    grade: 'ALL',
    description:
      'Taught in context integrated with other skills. 30 minutes per week for formal instruction. Key areas: punctuation (full stop, comma, colon, semi-colon, apostrophe, quotation marks, parentheses, ellipses, hyphen, exclamation mark, question mark); spelling (patterns, rules, abbreviations, dictionary); parts of words (prefixes, roots, suffixes); nouns (common, proper, abstract, concrete, compound, collective, countable/uncountable, possessive, gender, diminutive, augmentative); determiners; pronouns (personal, reflexive, relative, interrogative, demonstrative, indefinite); adjectives (position, -ing/-ed, comparison, numerical, demonstrative, relative); adverbs (manner, time, frequency, probability, duration, degree); prepositions (simple, compound, complex); verbs (main, transitive, intransitive, finite, non-finite, copulative, regular, irregular, phrasal, stative; moods \u2014 subjunctive/imperative/indicative; auxiliary/modals; all tenses: simple/progressive/perfect/future); conjunctions and transition words; clauses (main, dependent, adverbial, adjectival, noun, conditional); phrases; sentence types (simple, compound, complex); conditional sentences; passive voice; reported speech; vocabulary development (synonyms, antonyms, paronyms, polysemes, homonyms, homophones, figures of speech, idioms, proverbs, neologisms, etymology).',
    basis: ref('Section 3.1, Overview of content, skills and strategies'),
  },
  {
    contentArea: 'Language Structures and Conventions',
    topicCode: null,
    topicName: 'HL Grades 4-6: Vocabulary targets by term (Section 3.2.5)',
    grade: 'ALL',
    description:
      'Common spoken words \u2014 Grade 4: T1=1700-2500, T2=1850-3000, T3=2000-3500, T4=3500-4000. Grade 5: T1=2400-4000, T2=2700-4250, T3=3000-4500, T4=4500-5000. Grade 6: T1=3500-5000, T2=3700-5250, T3=4000-5500, T4=5500-6000. Reading vocabulary (new words per term) \u2014 Grade 4: T1=800-1900 (75-250 new), T2=900-2200, T3=1000-2500, T4=2500-3000. Grade 5: T1=1500-3000, T2=1750-3300, T3=2000-3500, T4=3500-4000. Grade 6: T1=2200-3800, T2=2400-4200, T3=2700-4600, T4=3000-5000.',
    basis: ref('Section 3.2.5, Vocabulary to be achieved by Home Language learners'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1: Text type sequence (5 two-week cycles)',
    grade: '4',
    description:
      'W1-2: Short story + personal recount. W3-4: Poetry. W5-6: Folklore (myth or legend). W7-8: Instructional text. W9-10: Newspaper or magazine article.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 2: Text type sequence (4 teaching cycles + assessment)',
    grade: '4',
    description:
      'W1-2: Information text \u2014 weather report + info text with visuals (charts/maps). W3-4: Short story (character description). W5-6: Folklore (fable/myth/legend). W7-8: Instructional text \u2014 procedures/instructions + information text with visuals. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 3: Text type sequence (5 two-week cycles)',
    grade: '4',
    description:
      'W1-2: Novel (diary entries). W3-4: Information text \u2014 factual recount/news article + visual text (poster/notice). W5-6: Poem. W7-8: Information text with visuals (charts/tables/maps/descriptions/procedures). W9-10: Drama (dialogue writing).',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 4: Text type sequence (4 teaching cycles + assessment)',
    grade: '4',
    description:
      'W1-2: Newspaper or magazine article on social issues. W3-4: Short story + friendly letter/diary entry. W5-6: Information text \u2014 advertisement (visual text). W7-8: Drama/dialogue + character sketch. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 5 Term 1: Text type sequence (5 two-week cycles)',
    grade: '5',
    description:
      'W1-2: Short story + personal recount (book review writing). W3-4: Information text with visuals (charts/tables/diagrams/mindmaps/maps) + conversation + factual recount. W5-6: Newspaper/magazine article. W7-8: Folklore (myth/legend). W9-10: Poetry.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 5 Term 2: Text type sequence (4 teaching cycles + assessment)',
    grade: '5',
    description:
      'W1-2: Information text \u2014 instructions. W3-4: Information text with visuals (charts/tables/descriptions of objects/plants/animals/places). W5-6: Poetry. W7-8: Folklore. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 5 Term 3: Text type sequence (5 two-week cycles)',
    grade: '5',
    description:
      'W1-2: Novel. W3-4: Information text with visuals (charts/tables/diagrams/mindmaps/maps). W5-6: Folklore. W7-8: Information text \u2014 weather report. W9-10: Drama.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 5 Term 4: Text type sequence (4 teaching cycles + assessment)',
    grade: '5',
    description:
      'W1-2: Short story. W3-4: Information text with visuals (charts/tables/diagrams/pictures). W5-6: Information text with visuals (charts/diagrams/mindmaps/graphs). W7-8: Information text \u2014 procedures/instructions. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 6 Term 1: Text type sequence (5 two-week cycles)',
    grade: '6',
    description:
      'W1-2: Newspaper/magazine/radio article. W3-4: Folklore. W5-6: Persuasive text \u2014 advertisement. W7-8: Drama. W9-10: Poetry.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 6 Term 2: Text type sequence (4 teaching cycles + assessment)',
    grade: '6',
    description:
      'W1-2: Information text \u2014 instructions. W3-4: Novel. W5-6: Short story. W7-8: Information text \u2014 weather chart. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 6 Term 3: Text type sequence (5 two-week cycles)',
    grade: '6',
    description:
      'W1-2: Novel. W3-4: Folklore. W5-6: Short story + letter + diary. W7-8: Visual text. W9-10: Drama.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 6 Term 4: Text type sequence (4 teaching cycles + assessment)',
    grade: '6',
    description:
      'W1-2: Information text + descriptive essay. W3-4: Instructional text. W5-6: Short story. W7-8: Poetry. W9-10: Summative assessment.',
    basis: ref('Section 3.2.1, Spread of texts table'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1 W1-2: Short story + personal recount',
    grade: '4',
    description:
      'L&S: Listens to short story \u2014 prediction, identifies characters, recalls main idea, answers oral questions; retells events in correct sequence. R&V: Reads a short story \u2014 pre-reading, uses reading strategies (predictions/phonic/contextual clues), discusses vocabulary and characters, gives feelings about text, reads aloud; reflects on independent reading. W&P: Writes a story based on personal experience using story structure frame, appropriate vocabulary, grammar, spelling, punctuation; uses writing process (plan/draft/revise/edit/proofread/present). LSC: Word level \u2014 common/proper/countable/uncountable nouns. Sentence level \u2014 simple sentences. Spelling/punctuation \u2014 full stop, capital letters.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1 W3-4: Poetry/song',
    grade: '4',
    description:
      'L&S: Listens to and discusses poem/song \u2014 recall main idea, discusses central idea, identifies rhyme and rhythm, expresses feelings, performs selected lines. R&V: Reads poem/song \u2014 discusses main ideas, identifies rhythm and rhyme and their effects, breaks words into syllables; reflects on independent reading. W&P: Writes a simple poem/song \u2014 appropriate content, relevant structure, rhythm and rhyme. LSC: Word level \u2014 abstract and concrete nouns, compound nouns. Sentence level \u2014 simple sentences. Spelling/punctuation \u2014 full stop, comma.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1 W5-6: Folklore (myth or legend)',
    grade: '4',
    description:
      'L&S: Listens to folklore \u2014 prediction, identifies plot/characters/setting, discusses message, retells in correct sequence, expresses thoughts and feelings. R&V: Reads folklore \u2014 pre-reading, makes predictions, uses contextual clues, discusses plot/ characters/setting/message, expresses opinions, distinguishes realistic from unrealistic events; relates to own life. W&P: Writes a story/folklore (myth/legend) \u2014 develops beginning/middle/end, characters and setting, uses language imaginatively, variety of vocabulary, process writing. LSC: Word level \u2014 prefix, roots, suffixes. Sentence level \u2014 simple/complex sentences. Word meaning \u2014 proverbs, idioms. Punctuation \u2014 colon, semi-colon.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1 W7-8: Instructional text',
    grade: '4',
    description:
      'L&S: Listens to and discusses instructional text (e.g. recipe) \u2014 prediction, recalls procedure, identifies features of instructional text, gives instructions (e.g. how to make a cup of tea), makes notes, asks clarifying questions. R&V: Reads instructional text \u2014 pre-reading, discusses specific details and sequence of instructions. W&P: Writes instructions \u2014 lists materials/ingredients, uses correct specific details and sequence, uses command form of verb, correct structure and format. LSC: Word level \u2014 personal/possessive/demonstrative pronouns. Sentence level \u2014 subject, object. Word meaning \u2014 borrowed words.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 1 W9-10: Newspaper or magazine article',
    grade: '4',
    description:
      'L&S: Listens to/discusses current issues from newspaper/magazine \u2014 listens for specific details, identifies main message, discusses main ideas, uses information from text in responses, discusses social/moral/cultural values; presents a prepared speech. R&V: Reads information text (news article) \u2014 pre-reading, uses headline/by-line/lead paragraph/Who-What-Where-When-Why/How; discusses headlines and central idea, explains unfamiliar words. W&P: Writes a news report \u2014 uses headline/by-line/lead paragraph, selects appropriate content, sequences events correctly, appropriate vocabulary, grammar, spelling and punctuation. LSC: Word level \u2014 Articles. Sentence level \u2014 simple sentences, statements, questions. Word meaning \u2014 antonyms. Punctuation \u2014 question mark, exclamation mark, dictionary use.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 2 W1-2: Information text \u2014 weather report + visual',
    grade: '4',
    description:
      'L&S: Listens to weather reports \u2014 identifies features of weather reports, compares conditions, discusses usefulness, participates in discussions justifying own opinion. R&V: Reads information texts with visuals (charts/tables/maps) \u2014 skims for general idea, scans for specific details, identifies text organisation, compares differences and similarities; uses dictionary. W&P: Writes information text (e.g. weather chart) \u2014 organises information logically, includes specific details, uses topic and supporting sentences, designs appropriate visuals. LSC: Word level \u2014 adjectives, degrees of comparison. Sentence level \u2014 simple past tense, future tense.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 2 W3-4: Short story \u2014 character description',
    grade: '4',
    description:
      'L&S: Listens to and discusses short story \u2014 identifies main ideas, discusses plot/setting/characters, participates in group discussion, takes turns, gives balanced and constructive feedback. R&V: Reads short story \u2014 pre-reading, discusses character, plot and setting; infers reasons for actions; uses reading strategies. W&P: Writes a description of a character \u2014 specific details, topic and supporting sentences, synonyms and antonyms, adjectives; brainstorms using mind maps, produces first draft. LSC: Word level \u2014 adjectives, main verbs, regular verbs, transitive and intransitive verbs. Sentence level \u2014 subject, object, subject-verb agreement, present tense.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 2 W5-6: Folklore (fable/myth/legend)',
    grade: '4',
    description:
      "L&S: Listens to and discusses fable/myth/legend \u2014 identifies central idea, plot, setting, characters; distinguishes realistic from unrealistic; gives balanced constructive feedback. R&V: Reads fable/myth/legend \u2014 pre-reading, skimming and scanning, identifies and comments on plot, setting, characters; gives reasons for characters' actions; identifies values. W&P: Writes a fable/myth/legend \u2014 uses animals as characters, story structure frame, linking paragraphs, variety of vocabulary. LSC: Word level \u2014 regular and irregular verbs, finite and infinite verbs, stative verbs. Sentence level \u2014 subject-verb agreement, past tense. Word meaning \u2014 idioms and proverbs.",
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 2 W7-8: Instructional text + directions',
    grade: '4',
    description:
      'L&S: Listens to and gives directions; listens to and carries out instructions (e.g. recipe/making something) \u2014 recalls procedure, notes key headings, asks for clarity. R&V: Reads instructional text \u2014 discusses specific details and sequence. W&P: Writes an instructional text (e.g. how to make a sandwich) \u2014 orders information logically, topic and supporting sentences, headings, spacing. LSC: Word level \u2014 auxiliary verbs, modal verbs, moods. Sentence level \u2014 future tense.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 3 W1-2: Novel \u2014 diary entries',
    grade: '4',
    description:
      'L&S: Listens to extract from novel \u2014 listens for specific details, identifies main message, discusses main ideas and values, participates in group discussion, asks relevant questions. R&V: Reads novel \u2014 pre-reading, skims and scans, makes predictions, uses contextual clues, describes feelings, discusses characters/plot/setting. W&P: Writes diary entries \u2014 correct format, emotive words, first person narration, appropriate grammar. LSC: Word level \u2014 adverbs. Sentence level \u2014 complex sentences. Word meaning \u2014 one word for a phrase.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName:
      'Grade 4 Term 3 W3-4: Information text \u2014 factual recount + visual text',
    grade: '4',
    description:
      'L&S: Listens and discusses information text \u2014 discusses specific details, asks questions, answers oral questions, relates own experiences. R&V: Reads information text on social issues \u2014 pre-reading, scans for specific details, reads printed resources, locates information, identifies different purposes, discusses values; compares texts read. W&P: Writes a descriptive paragraph (2 paragraphs) \u2014 appropriate content, topic and supporting sentences, creates visual aids. LSC: Word level \u2014 conjunctions, prepositions. Sentence level \u2014 past/future continuous tense. Word meaning \u2014 figurative language, similes, metaphors.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 3 W5-6: Poem',
    grade: '4',
    description:
      'L&S: Listens to a poem \u2014 discusses central idea, identifies rhyme/rhythm and their effect, identifies atmosphere; performs poem with appropriate intonation/body language/pace/volume. R&V: Reads a poem \u2014 describes emotional response, identifies rhyme, alliteration, onomatopoeia, similes and metaphors. W&P: Writes a poem \u2014 appropriate format, imaginative language, alliteration, assonance, consonance, figurative language, rhythm and rhyme. LSC: Word level \u2014 conjunctions. Sentence level \u2014 statements, simple sentences. Word meaning \u2014 personification, alliteration, similes, metaphors, rhythm, rhyme.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 3 W7-8: Information text with visuals (charts/tables/maps)',
    grade: '4',
    description:
      'L&S: Listens to information text with visuals \u2014 identifies specific details, interprets visuals, discusses usefulness. R&V: Reads information text with visuals \u2014 skims for general idea, scans for specific details, interprets visuals. W&P: Writes information from a table/graph/map into a paragraph \u2014 translates graphical information correctly, links sentences into coherent paragraph using pronouns and connecting words. LSC: Word level \u2014 stems. Sentence level \u2014 simple/complex sentences, verb clause. Punctuation \u2014 colon.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 3 W9-10: Drama \u2014 dialogue',
    grade: '4',
    description:
      'L&S: Listens to drama from radio/TV/text \u2014 retells scene in sequence, names characters, expresses thoughts and feelings; role plays a character. R&V: Reads a drama \u2014 discusses characters, central idea and setting, expresses feelings. W&P: Writes a dialogue \u2014 appropriate characters, correct format, logical organisation, variety of vocabulary, appropriate grammar, spelling, punctuation and spacing. LSC: Word level \u2014 collective nouns, reflexive pronouns, stems. Sentence level \u2014 subject-verb agreement. Punctuation \u2014 full stop, commas, colon, semi-colon, question marks.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 4 W1-2: Newspaper/magazine article on social issues',
    grade: '4',
    description:
      'L&S: Listens to newspaper/magazine \u2014 listens for specific details, identifies main message, discusses social/moral/cultural values; participates in discussions, gives constructive feedback. R&V: Reads newspaper/magazine \u2014 infers reasons for actions, identifies cause and effect, discusses values, word choices and imagery, recognises structure/purpose/audience. W&P: Writes a newspaper article about a social issue \u2014 appropriate to audience/purpose, language imaginatively, linking paragraphs. LSC: Word level \u2014 conjunctions, auxiliary verbs. Sentence level \u2014 subject-verb agreement, tenses. Word meaning \u2014 synonyms, antonyms.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 4 W3-4: Short story + letter/diary',
    grade: '4',
    description:
      "L&S: Listens to short story \u2014 listens/relates to own experience, identifies specific details, retells story; participates in group discussions. R&V: Reads short story \u2014 identifies/comments on plot/setting/characters, gives reasons for characters' actions, discusses values. W&P: Writes a friendly letter/diary entry \u2014 correct format, appropriate content, coherent paragraphs, variety of vocabulary. LSC: Word level \u2014 adverbs of place/degree, tenses, conjunctions, pronouns. Sentence level \u2014 noun phrase, noun clause.",
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 4 W5-6: Advertisement \u2014 visual literacy',
    grade: '4',
    description:
      'L&S: Listens to advertisements \u2014 interprets and discusses message including values, discusses structure/language use/purpose/audience; participates in group discussion on social issues. R&V: Reads information text (advertisement) \u2014 interprets message, discusses language use including persuasive/emotive language, identifies stereotypes, discusses graphical techniques (colour, design, images). W&P: Writes an advertisement \u2014 appropriate for purpose and audience, appropriate visuals and layout, language creatively. LSC: Sentence level \u2014 adjectives, adverbs. Punctuation \u2014 exclamation mark, colons, capital letters.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Grade 4 Term 4 W7-8: Drama \u2014 character sketch',
    grade: '4',
    description:
      'L&S: Listens to a dialogue \u2014 listens/relates to own experience, identifies specific details; participates in group discussions. R&V: Reads a drama \u2014 identifies/comments on plot, gives reasons for actions, discusses values. W&P: Writes a character sketch \u2014 thinks about characterisation, uses descriptive words to compare characters, shows understanding of setting/plot/characters/conflict/theme, correct use of tenses. LSC: Word level \u2014 infinitive verbs. Sentence level \u2014 main clause, dependent clause. Word meaning \u2014 similes, metaphors, idioms, proverbs.',
    basis: ref(
      'Section 3.4, Content and Teaching Plans for English Home Language, Grade 4',
    ),
  },
];

export const CAPS_ENG_HL_IP_METADATA = {
  documentId: CAPS_ENG_HL_IP_DOC_ID,
  documentVersion: CAPS_ENG_HL_IP_VERSION,
  title: 'English Home Language Intermediate Phase Grades 4-6',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0455-8',
  phase: 'Intermediate Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
