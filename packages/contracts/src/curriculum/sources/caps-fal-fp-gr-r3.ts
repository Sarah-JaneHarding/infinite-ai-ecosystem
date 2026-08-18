// Derived structure from First Additional Language Foundation Phase Grades R-3 (generic).
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_FAL_FP_DOC_ID = 'caps-fal-fp-gr-r3-2011' as const;
export const CAPS_FAL_FP_VERSION = '2011-final-draft' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_FAL_FP_DOC_ID,
    documentVersion: CAPS_FAL_FP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_FAL_FP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Emergent Reading',
  'Emergent Writing',
  'Phonics',
  'Reading and Viewing',
  'Writing',
  'Reading and Phonics',
] as const;
export type CapsfalfpContentArea = (typeof CAPS_FAL_FP_CONTENT_AREAS)[number];

export interface CapsfalfpTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_FAL_FP_TOPIC_PROGRESSIONS: readonly CapsfalfpTopicProgression[] = [
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: greetings and songs',
    grade: 'R',
    description:
      "Responds to simple greetings and farewells ('Good morning', 'Goodbye'); follows simple classroom instructions ('stand', 'listen'); sings simple songs and does actions with help (e.g. 'Heads and Shoulders'); recites simple rhymes with actions; sings birthday songs in a number of languages; listens to well-illustrated short stories with enjoyment and joins in choruses (e.g. 'The Very Hungry Caterpillar'). No Formal Assessment in Term 1.",
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading/pictorial cues',
    grade: 'R',
    description:
      'Recognises and points out objects in picture stories; draws a picture of a story, song or rhyme; sequences pictures in a story. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing',
    grade: 'R',
    description: 'Draws pictures about a story. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: vocabulary building (topics: Me, Things I Like, My Family)',
    grade: 'R',
    description:
      'Begins to build oral vocabulary using topics such as Me, Things I Can Do, Things I Like, My Family, Birthdays; responds to simple greetings and farewells; follows simple instructions; sings songs with actions; recites rhymes; sings birthday songs; listens to short stories and joins in choruses; names and points to body parts (e.g. Heads, Shoulders, Knees and Toes). No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading/phonemic awareness',
    grade: 'R',
    description:
      'Recognises and points out objects in pictures or classroom environment; practises sequencing activities (3 picture cards); identifies picture from background; recognises sounds at the beginnings of own name. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing',
    grade: 'R',
    description: 'Draws pictures about a story. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: vocabulary building (topics: Me and My Friends, Farm Animals)',
    grade: 'R',
    description:
      'Builds oral vocabulary using topics such as Me and My Friends, Things I Can Do at School, Farm Animals; responds to greetings; listens to and follows simple instructions; sings songs with actions; recites rhymes; listens to simple questions and responds; listens to short stories; listens to and recalls simple instructions; sings action songs. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading/phonemic awareness',
    grade: 'R',
    description:
      'Recognises and points out objects in pictures/classroom; finds image/object in a busy picture; listens to a simple story and sequences three pictures to retell it (Home Language or code-switching permitted); draws a picture of a story/song/rhyme. Phonemic awareness: distinguishes aurally between different letter sounds at the beginning of names; identifies what words begin with the same sound; begins to recognise that words are made up of sounds (c-a-t). No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing',
    grade: 'R',
    description:
      'Draws pictures about a story/rhyme learned in class; begins to write one or two letters or own name. No Formal Assessment.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: vocabulary building (topics: My Body, Transport)',
    grade: 'R',
    description:
      "Builds oral vocabulary using topics such as My Body, Things I Can Do at Home, Transport; responds to greetings and farewells in multiple forms ('Good night', 'Good afternoon'); sings songs and does actions; recites rhymes; sings birthday songs; listens to simple questions and responds; listens to simple instructions; listens to short stories; recalls simple word sequences (3-4 words in order); names and points to body parts through action songs. Formal Assessment Task: recites simple rhymes, sings songs, responds to stories.",
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading/phonemic awareness',
    grade: 'R',
    description:
      'Recognises and points out objects in pictures/classroom; finds image in a busy picture; sequences three pictures to make a story; talks about illustrations in a picture book as a group. Phonics: slow-speak game (says word after it is said slowly \u2014 m-a-t = mat); identifies which word begins with a different sound (Odd One Out). Formal Assessment Task: sequences pictures; identifies word by initial sound.',
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing',
    grade: 'R',
    description:
      "Makes pictures from waste materials and adds a teacher-written phrase/word (e.g. 'Thabo's bicycle'); traces own name and numerals. No Formal Assessment.",
    basis: ref(
      'Section 3, Grade R First Additional Language, CAPS document (fetched from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level FAL oral skills (Grade R)',
    grade: 'R',
    description:
      'Begins to build oral vocabulary using everyday topics (My Body, Things I Can Do at Home, Transport); responds to simple greetings and farewells; follows simple classroom instructions; sings simple songs and does actions; sings birthday songs in a number of languages; listens to simple stories told and read aloud.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level FAL oral skills (Grade 1)',
    grade: '1',
    description:
      "Builds oral vocabulary using topics such as Clothes, People who Help Me, Wild Animals, Family Occasions; responds to greetings/farewells and makes simple requests using formulaic phrases; responds physically to two simple oral instructions; memorises and performs action rhymes and songs; understands short, simple stories by miming, drawing a picture or sequencing pictures; answers simple 'yes/no' questions with one-word answers; understands simple oral sentences in simple present and present progressive tenses; understands some negative sentences; identifies a person/animal/object from a simple oral description; expresses herself/himself in simple ways using short phrases; understands 'How much\u2026?' and 'Which\u2026?' questions; understands some plurals, adverbs and prepositions; understands concepts relating to direction, sequence, ability and identity.",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level FAL oral skills (Grade 2)',
    grade: '2',
    description:
      "Continues to build oral vocabulary using topics such as the Sea, Moving House, Festivals and Holidays; uses and responds to simple greetings and farewells; follows a short sequence of instructions; gives very simple instructions; makes simple requests and statements; memorises and performs simple poems, action rhymes and songs; recounts a short sequence of simple experiences or events; identifies an object from a simple oral description; answers simple 'yes/no' and open questions with short answers; understands simple stories (e.g. by acting out, sequencing pictures, matching captions); says how a story made them feel and how it links to own life; understands and uses simple present and present progressive tenses; understands concepts relating to counting, time, sequence and colour; understands and uses some question forms (When did you\u2026? Have you ever\u2026?); modifies adjectives and adverbs (quite slow, very fast).",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level FAL oral skills (Grade 3)',
    grade: '3',
    description:
      'Continues to build oral vocabulary using topics such as Finding Out, My Country, Stories from Long Ago; follows a sequence of instructions correctly; makes requests and understands question forms; performs a rhyme, poem or song; recalls experiences and events in the right sequence; talks about a picture or photograph using some adjectives; understands stories using the title for prediction and predicting what will happen next; expresses feelings about a story; answers literal comprehension questions using words or phrases; retells parts of a story; summarises a story with teacher support; participates in a conversation on a familiar topic; understands and uses simple present, present progressive, simple past and future tenses; understands and uses a variety of question forms (Where\u2026? When\u2026? Why\u2026?); understands and uses personal pronouns (I, me, you, mine, yours).',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level FAL phonics (Grade R)',
    grade: 'R',
    description:
      'Distinguishes aurally between different letter sounds at the beginning of names; recognises the letter sounds at the beginning of own name; begins to recognise that words are made up of sounds (cat = c-a-t); identifies what words begin with the same sound.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level FAL phonics (Grade 1)',
    grade: '1',
    description:
      'Hears/identifies different initial sounds of words; identifies letter-sound relationships of common single letters (at least 2 vowels and 14 consonants by end of year \u2014 a, b, c, d, g, h, l, m, n, o, p, r, s, t, w); makes sense of picture stories using illustration/text.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level FAL phonics (Grade 2)',
    grade: '2',
    description:
      "Identifies letter-sound relationships of most single letters; builds up and breaks down 3-letter words (p-e-n, p-en, pen); recognises common endings ('ed', 'ing', 'y', 's'); groups words into word families (bin, pin, tin); recognises common consonant digraphs (sh, ch, th); builds up/breaks down words with common consonant blends (fl-at, sl-ip, cl-ap, pl-um; br-im, cr-op, dr-ip, gr-ab, tr-ip); recognises vowel digraphs (oo/boot, ee/feet).",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level FAL phonics (Grade 3)',
    grade: '3',
    description:
      "Identifies letter-sound relationships of all single letters in Home Language and FAL; recognises consonant digraphs (sh, ch, th, wh) at beginning of words; recognises consonant digraphs (sh, ch, th) at end of words (fish, rich, with); recognises vowel digraphs (oo/boot, oa/boat, ar/far, er/her, ir/bird, or/short, ur/hurt); recognises silent 'e' (cake, time); uses consonant blends to build/break down words (ri-ng, i-nk); recognises known rhyming words (fly, sky); distinguishes between long and short vowel sounds (boot/book); recognises onset and rime in more complex patterns (dr-eam, scr-eam); recognises more complex word families (hatch, match); recognises and uses suffixes (-es, -ies, -ly, -ing, -ed); builds and sounds out words using sounds learnt.",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Emergent reading (Grade R FAL)',
    grade: 'R',
    description:
      'Recognises and points out objects in picture stories and classroom environment; finds an image/object in a busy picture; listens to a simple story and sequences pictures to retell it; draws a picture of a story, song or rhyme; sequences three pictures to make a story; talks about illustrations in a picture book.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared Reading (Grade 1 FAL)',
    grade: '1',
    description:
      'Recognises some common sight words (environmental print: STOP, Spar, KFC, MTN, Coke); makes sense of a picture story read by the teacher; reads picture books with one- or two-word captions using illustrations to understand captions; matches written words with pictures and objects; follows printed instructions on one-word flashcards (stand, jump).',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared and Guided Reading (Grade 2 FAL)',
    grade: '2',
    description:
      'Reads a short written text (Big Book or enlarged text) with the teacher using the title for prediction and answering short oral questions; makes sense of a short written story with pictures (sequencing, matching captions to pictures, drawing); relates a story to own experience; retells part of a story with help (2-3 sentences). Group Guided Reading: reads aloud from own book in a group; builds sight vocabulary. Paired/Independent Reading: reads picture books to a partner.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared and Guided Reading (Grade 3 FAL)',
    grade: '3',
    description:
      'Reads fiction and non-fiction texts including visual/graphical texts with the teacher; retells a story identifying the sequence of events; describes how a story made them feel; reads a description of a process (e.g. How paper is made); answers literal questions about a story, non-fiction text and visual/graphical text; discusses pictures/photos and compares to own experience. Group Guided Reading: reads stories, dialogues, simple non-fiction, familiar poems and rhymes; reads aloud with increasing speed and fluency; uses sight words, phonics and comprehension skills; uses self-correcting strategies. Paired/Independent Reading: reads simple story books and own writing; reads familiar poems and rhymes.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Emergent writing (Grade R FAL)',
    grade: 'R',
    description:
      'Draws pictures about a story; draws pictures about a story/rhyme learned in class; begins to write one or two letters or own name; traces own name and numerals.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 1 FAL)',
    grade: '1',
    description:
      'Draws pictures about stories heard or rhymes learned in class; draws pictures for news, stories or topic-linked activities and copies familiar words and short sentences.',
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 2 FAL)',
    grade: '2',
    description:
      "Draws pictures for news/a story/topic; writes a caption for a picture (e.g. 'The red car is big'); completes sentences by filling in missing words; writes sentences using a frame (e.g. 'In the morning I go to\u2026'); uses capital letters and full stops in sentences; spells words correctly from memory or using phonic knowledge.",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 3 FAL)',
    grade: '3',
    description:
      "Writes individual words such as labels; writes sentences using sentence starters (e.g. 'At the library\u2026', 'In South Africa\u2026'); writes sentences without a frame (expressing feelings and personal opinions); writes a simple recount using a frame ('Yesterday I\u2026, Then\u2026, After that\u2026, Finally\u2026'); writes a short dialogue with support; sequences and copies sentences to make a paragraph; uses information from a chart/graph/diagram/picture to write or complete a short text; uses punctuation including full stops, commas, question marks, exclamation marks and inverted commas; understands plural forms of some common nouns; understands and uses some adjectives; understands necessity expressions ('You must wash your hands'); uses 'and' to join sentences; spells common words correctly; writes words in a personal dictionary.",
    basis: ref('Section 3, Overview of Language Skills (pp.13-16), FAL CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 1, Term 1)',
    grade: '1',
    description:
      'Builds oral vocabulary using topics such as Myself and My Family; responds to simple greetings/farewells; joins in action rhymes and songs; responds physically to simple instructions (Sit, Stand, Walk, Run); understands short, simple stories by miming or drawing; understands dramatised story using Home Language; understands simple oral sentences in simple present tense; understands concepts relating to identity, number, age and size. FAT 1: joins in action rhymes and songs.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 1, Term 2)',
    grade: '1',
    description:
      "Builds and revises oral vocabulary using topics such as My School, My Body, My Home, Shopping; uses and responds to greetings; memorises and performs action rhymes and songs; understands short simple stories and answers 'yes/no' questions with one-word answers; responds physically to simple instructions; understands a simple description by identifying a picture; understands simple present tense sentences; understands adjectives (big, small, fat, thin); understands concepts of shape, number, colour and size; understands personal pronouns (my, your, his, her, our, their); understands prepositions (in, at, on, to).",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 1, Term 3)',
    grade: '1',
    description:
      "Builds/revises oral vocabulary using topics such as My Friends, Food, Transport, Domestic Animals; uses and responds to greetings and makes simple requests; memorises/performs action rhymes and songs; understands short simple stories; responds to two simple oral instructions; answers 'yes/no' and closed questions with one-word answers; identifies a person or object from a simple oral description; expresses herself/himself in simple phrases ('I like\u2026', 'My friend is\u2026', 'I eat\u2026'); understands negative sentences; understands adjectives (slow, quick); understands and responds to 'Who can\u2026?' and 'Where is\u2026?'; understands simple present and present progressive tenses; understands some pronouns and prepositions (above, below, to, from); understands vocabulary relating to time, number, direction and ability.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 1, Term 4)',
    grade: '1',
    description:
      "Builds/revises oral vocabulary using topics such as Clothes, People Who Help Me, Wild Animals, Family Occasions; uses and responds to greetings and makes simple requests using formulaic phrases; memorises/performs action rhymes with correct intonation and pronunciation; understands short simple stories; answers 'yes/no' and open questions with one-word answers; responds physically to two simple oral instructions; expresses self in simple phrases ('I love wearing\u2026', 'I want to be\u2026'); understands simple present and present progressive tenses; understands negative sentences; understands some plurals (tooth/teeth); understands adverbs (slowly, quickly); understands 'How much\u2026?' and 'Which\u2026?' questions; understands prepositions (inside, outside, under, over); understands vocabulary relating to direction, sequence and ability.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 1, Term 1)',
    grade: '1',
    description:
      'Phonemic awareness: begins to hear/identify different initial sounds of FAL words (head, toes, body, me, sit, run). Reading: makes sense of a picture story (Big Book) read by the teacher; recognises some common sight words (environmental print \u2014 STOP, Spar, KFC, MTN, Coke).',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 1, Term 2)',
    grade: '1',
    description:
      "Phonics: continues to hear/identify different initial sounds of FAL words (door, table, cupboard, window, pencil). Reading: makes sense of a picture story (Big Book) read by the teacher (placing pictures in sequence or drawing part of the story); recognises common sight words (Vodacom, Police, School, Checkers, Shoprite, Pick 'n Pay).",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 1, Term 3)',
    grade: '1',
    description:
      'Phonics: hears/identifies different initial sounds of words (bus, car, bicycle; cow, bull, horse); identifies letter-sound relationships of at least 7 consonants (b, c, d, h, m, s, t). Reading: reads picture books (Big Books or other enlarged texts) with one- or two-word captions using illustrations to understand the captions.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 1, Term 4)',
    grade: '1',
    description:
      'Phonics: hears/identifies initial sounds (nurse, teacher, doctor, farmer); identifies letter-sound relationships of common single sounds \u2014 at least 2 vowels and 14 consonants (a, b, c, d, g, h, l, m, n, o, p, r, s, t, w) by end of term. Reading: reads picture books with one- or two-word captions; matches written words with pictures and objects; follows printed instructions on one-word flashcards (stand, jump).',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 1, Term 1)',
    grade: '1',
    description: 'Draws pictures about stories heard or rhymes learned in class.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 1, Term 2)',
    grade: '1',
    description: 'Draws pictures linked to stories, rhymes or topics for the term.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 1, Term 3)',
    grade: '1',
    description:
      'Draws pictures linked to stories, rhymes or topics and copies a one- or two-word caption.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 1, Term 4)',
    grade: '1',
    description:
      'Draws pictures for news, stories or topic-linked activities and copies familiar words and short sentences.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 2, Term 1)',
    grade: '2',
    description:
      "Builds/revises oral vocabulary using topics such as Me and My Family, Weather, Wild Animals, Money; uses and responds to greetings; memorises/performs action rhymes and songs; follows two simple oral instructions; makes simple requests/statements; shows respect for classmates by listening; answers simple 'yes/no' questions about a story; understands counting vocabulary, time and colour; identifies an object from a simple oral description; talks about a drawing/picture; understands simple present and present progressive tenses; understands adjectives; understands ways of asking questions (What\u2026? Who\u2026? Which\u2026?); understands verbs and adverbs; understands the simple past tense.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 2, Term 2)',
    grade: '2',
    description:
      "Builds/revises oral vocabulary using topics such as Play and Sport, Journeys, Visiting Friends, The Supermarket; uses and responds to greetings; memorises/performs action rhymes and songs; follows a short sequence of instructions; makes simple requests/statements; answers simple 'yes/no' questions about a story; understands and uses some question forms; recounts a short sequence of simple experiences; understands adjectives (concepts of shape and size); understands the simple past tense; understands verbs and adverbs; understands stories using the title for prediction.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 2, Term 3)',
    grade: '2',
    description:
      "Builds/revises oral vocabulary using topics such as Keeping Fit, Farming, An Accident, Fantasy Stories; memorises/performs action rhymes and songs; recognises some rhyming words; follows a short sequence of instructions; makes simple requests/statements; listens to simple stories and mimes them; answers 'yes/no' and open questions with short answers; understands the simple past tense; acts out a simple story; says how a story made them feel; understands ways of asking questions (What\u2026? Who\u2026? Which\u2026?); understands vocabulary relating to direction, time and ability.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 2, Term 4)',
    grade: '2',
    description:
      "Builds/revises oral vocabulary using topics such as the Sea, Moving House, Festivals and Holidays; recounts a short sequence of simple experiences or events; uses and responds to greetings showing respect to different cultures; memorises/performs simple poems; answers 'yes/no' and open questions with short answers; follows a short sequence of instructions; gives very simple instructions; makes simple requests/statements; understands simple stories; says how a story made them feel; understands and uses some question forms (When did you go\u2026? Have you ever\u2026?); understands simple present and present progressive tenses; understands sequence vocabulary; identifies an object from a simple oral description; modifies adjectives and adverbs (quite slow, very fast); understands adverbs in correct word order.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 2, Term 1)',
    grade: '2',
    description:
      'Phonics: distinguishes aurally between sounds often confused (a/e, b/p); identifies letter-sound relationships of most single letters; builds up and breaks down 3-letter words (p-e-n, p-en, pen). Shared Reading: reads picture story books with the teacher following pointer, using illustrations; shows understanding (places pictures in sequence; adds captions). Group Guided Reading: reads aloud from own book in a group; builds sight vocabulary.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 2, Term 2)',
    grade: '2',
    description:
      "Phonics: identifies letter-sound relationships of all single letters; recognises common endings ('ed', 'ing', 'y', 's'); builds up/breaks down simple words (f-at, p-in, r-ed); distinguishes long/short vowel sounds (not/note, hat/hate). Shared Reading: reads Big Books with pointer, using illustrations; shows understanding; relates story to own experience. Group Guided Reading: reads aloud from own book; builds sight vocabulary.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 2, Term 3)',
    grade: '2',
    description:
      "Phonics: builds up/breaks down simple words by onset and rime (p-ig, h-en); groups common word families (bin, pin, tin); recognises common endings ('ing', 'ed'); recognises common consonant digraphs (sh, ch, th). Shared Reading: reads Big Books using title for prediction; shows understanding; relates to own experience. Group Guided Reading: reads aloud from own book; builds sight vocabulary. Paired reading: reads picture books to a partner.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 2, Term 4)',
    grade: '2',
    description:
      'Phonics: groups common word families; builds up/breaks down words with consonant blends (fl-at, sl-ip, cl-ap, pl-um; br-im, cr-op, dr-ip, gr-ab, tr-ip); recognises vowel digraphs (oo/boot, ee/feet); distinguishes sounds often confused. Shared Reading: reads text using title for prediction; shows understanding; relates story to own experience; retells part of story (2-3 sentences). Group Guided Reading: reads aloud from own book; builds sight vocabulary. Paired/Independent Reading: reads books from Shared Reading sessions and simple picture story books.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 2, Term 1)',
    grade: '2',
    description:
      'Chooses and copies a caption that accurately describes a picture; draws a picture that accurately matches a caption; draws pictures for news/a story/topic; copies familiar words and short sentences.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 2, Term 2)',
    grade: '2',
    description:
      "Writes a caption for a picture / draws a picture for a caption; draws pictures for news/a story/topic; copies familiar words and short sentences; completes sentences by filling in missing words ('I see the \u2026. Station'; 'Mum goes to\u2026'); labels pictures.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 2, Term 3)',
    grade: '2',
    description:
      "Writes a caption for a picture; completes sentences by filling in missing words; writes sentences using sentence starters ('It was so\u2026' 'They felt\u2026'); spells words correctly from memory or using phonic knowledge.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 2, Term 4)',
    grade: '2',
    description:
      "Completes sentences by filling in missing words ('We are\u2026', 'My sister has\u2026'); writes sentences using a frame ('In the morning I go to\u2026, At school I do\u2026, At home I\u2026'); uses capital letters and full stops; spells some familiar words correctly.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 3, Term 1)',
    grade: '3',
    description:
      'Builds/revises oral vocabulary using topics such as Me and My Family at Home, Out and About to School, Friends and the Community; performs a rhyme, poem or song; recalls experiences and events; understands stories and acts them out/sequences pictures/matches captions; makes requests; understands variety of question forms (Where\u2026? When\u2026? Why\u2026?); follows a sequence of instructions; talks about a picture or own drawing; describes a process (getting ready for school, making tea); understands and uses simple present and simple past tenses; understands and uses some adjectives; recalls parts of a story; expresses feelings about a story; understands personal pronouns (I, me, you, mine, yours); uses adverbs in correct word order.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 3, Term 2)',
    grade: '3',
    description:
      "Builds/revises oral vocabulary using topics such as Growing Things, Making Things, Keeping Healthy; performs a rhyme, poem or song; recalls experiences and events in the right sequence; understands stories; recounts an experience or event; makes requests; talks about an object or picture using some adjectives; sequences things using 'next' and 'then'; understands variety of question forms; understands and uses simple present, present progressive and simple past tenses; understands personal pronouns; answers literal comprehension questions; recalls and expresses feelings about a story; modifies adjectives and adverbs; understands vocabulary relating to size and direction.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 3, Term 3)',
    grade: '3',
    description:
      "Builds/revises oral vocabulary using topics such as Small Creatures, Our Heroes, Peoples and Cultures of South Africa; performs a rhyme, poem or song; recalls experiences and events in the right sequence; participates in a conversation on a familiar topic; makes requests; talks about an object/picture using some adjectives; asks questions for clarification ('What do you mean by\u2026?'); understands variety of question forms; understands and uses the future tense; understands stories using title for prediction; answers literal comprehension questions; retells parts of a story; expresses feelings about a story; understands and uses simple present, present progressive and simple past tenses; understands sequencing vocabulary (firstly, secondly, finally).",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral (Grade 3, Term 4)',
    grade: '3',
    description:
      'Builds/revises oral vocabulary using topics such as Our Beautiful Country, Stories and Legends, Saving the Environment; performs a rhyme, poem or song; recalls and summarises a story with teacher support; participates in a conversation; makes requests; talks about a picture/photograph using adjectives; discusses a process; recalls experiences and events; understands and uses variety of question forms (Where\u2026? When\u2026? Why\u2026?); understands all tenses (simple present, present progressive, simple past, future); understands and uses personal pronouns; retells and expresses feelings about a story.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 3, Term 1)',
    grade: '3',
    description:
      'Phonics: builds/sounds out short (3- and 4-letter) words; identifies letter-sound relationships of all single letters; recognises consonant digraphs (sh, ch, th, wh) at beginning of words; distinguishes between different vowel sounds orally; recognises consonant digraphs (sh, ch, th) at end of words; recognises vowel digraphs (oo/boot, oa/boat). Shared Reading: reads a short text (Big Book) with teacher using title for prediction; answers literal questions; describes how story made them feel; understands a comic strip (captions/speech bubbles + visual text). Group Guided Reading: reads stories at own level; reads aloud with increasing fluency; uses sight words, phonics and comprehension skills. Paired/Independent Reading: reads simple picture story books and own writing; reads familiar poems and rhymes.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 3, Term 2)',
    grade: '3',
    description:
      "Phonics: recognises at least 3 new vowel digraphs (ea/eat, oa/boat, short oo/book etc); recognises silent 'e' (cake, time, hope, note); uses consonant blends to build/break down words (ri-ng, i-nk, bla-ck, ch-op, cl-ap); recognises known rhyming words (fly, sky, dry, cry, try); distinguishes long/short vowel sounds (boot/book, fool/full, kite/kit). Shared Reading: reads story/non-fiction text relating it to own experience; answers literal questions; describes how story made them feel; identifies cause and effect; identifies plural forms of nouns in texts. Group Guided Reading: reads stories and rhymes; reads aloud with increasing speed and fluency; uses prediction; uses self-correcting strategies. Paired/Independent Reading: reads simple story books; reads and follows instructions.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 3, Term 3)',
    grade: '3',
    description:
      "Phonics: distinguishes between different vowel sounds aurally; builds/sounds out words using sounds learnt; recognises some differences between sound/spelling relationships in Home Language and FAL; recognises more vowel digraphs (ar/car, er/her, ir/bird, or/short, ur/hurt); recognises silent 'e'; recognises more complex consonant blends; recognises word families. Shared Reading: reads stories and non-fiction texts with teacher; retells story identifying sequence of events; identifies the 'problem' and 'solution' in a story; answers literal questions; discusses pictures/photos comparing to own experience. Group Guided Reading: reads stories, dialogues, simple non-fiction; reads with increasing speed and fluency; uses sight words/phonics/comprehension skills. Paired/Independent Reading: reads simple story books; reads familiar poems and rhymes.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Reading and Phonics',
    topicCode: null,
    topicName: 'Phonics and Reading (Grade 3, Term 4)',
    grade: '3',
    description:
      'Phonics: consolidates all phonics from Grade 3 \u2014 consonant digraphs, vowel digraphs, consonant blends, silent letters, word families, rhyming words, prefixes and suffixes; builds/sounds out words using all sounds learnt. Shared Reading: reads fiction and non-fiction texts including visual/graphical texts; retells a story identifying sequence of events; describes how story made them feel; reads a description of a process; answers literal questions; discusses pictures/photos and compares to own experience. Group Guided Reading: reads stories, dialogues, simple non-fiction, familiar poems and rhymes; reads with increasing speed and fluency; uses sight words/phonics/comprehension skills; uses self-correcting strategies. Paired/Independent Reading: reads simple story books and own writing; reads familiar poems and rhymes.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 3, Term 1)',
    grade: '3',
    description:
      "Writes individual words such as labels (e.g. labels a family picture); writes sentences using sentence starters ('While we were outside\u2026', 'This evening\u2026', 'When I woke up\u2026'); writes a simple sentence linked to the topic using capital letters and full stops; writes words in a personal dictionary; understands personal pronouns (I, me, you, mine, yours).",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 3, Term 2)',
    grade: '3',
    description:
      "Writes 2-4 sentences using sentence starters ('When I am at\u2026', 'While my friend was\u2026', 'To keep healthy we must\u2026'); writes short formulaic texts (invitations, letters, greeting cards); uses information from a visual or written text to label a diagram; answers literal comprehension questions (true/false, yes/no, matching); writes a simple sentence using capital letters, full stops, exclamation marks and question marks; spells common words correctly; writes words in a personal dictionary.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 3, Term 3)',
    grade: '3',
    description:
      'Writes 2-4 sentences using sentence starters; writes short formulaic texts; answers literal comprehension questions; writes individual words such as labels; spells common words correctly; uses information from charts/graphs/diagrams/pictures to write or complete short text; writes sentences without a frame expressing feelings and personal opinions; uses correct punctuation (full stops, commas, question marks, exclamation marks, inverted commas); writes in a personal dictionary.',
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing (Grade 3, Term 4)',
    grade: '3',
    description:
      "Writes a simple recount using a frame ('Yesterday I\u2026, Then\u2026, After that\u2026, Finally\u2026'); writes a short dialogue with support; sequences and copies sentences to make a paragraph; uses information from a chart/graph/diagram/picture to write or complete a short text; uses punctuation including full stops, commas, question marks, exclamation marks and inverted commas; understands plural forms of some common nouns; understands and uses some adjectives; understands how necessity is expressed ('You must/should wash your hands'); uses 'and' to join sentences; spells common words correctly; writes words in a personal dictionary.",
    basis: ref('Section 3, Grade 1-3 First Additional Language English, CAPS document'),
  },
];

export const CAPS_FAL_FP_METADATA = {
  documentId: CAPS_FAL_FP_DOC_ID,
  documentVersion: CAPS_FAL_FP_VERSION,
  title: 'First Additional Language Foundation Phase Grades R-3 (generic)',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Foundation Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
