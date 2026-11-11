// Derived structure from Sepedi Home Language Foundation Phase Grades R-3.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s). The source is written in Sepedi;
// every description below is an English paraphrase of the skills it lists.
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and time allocations only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_SEPEDI_HL_FP_DOC_ID = 'caps-sepedi-hl-fp-gr-r3-2011' as const;
export const CAPS_SEPEDI_HL_FP_VERSION = '2011-ratified' as const;
export const CAPS_SEPEDI_HL_FP_ISBN = '978-1-4315-0404-6' as const;

const OVERVIEW =
  'Section 3, Overview of Language Skills (CAPS pp.24-28), Sepedi HL CAPS document';
const TERMS = 'Section 3, Requirements per term (Grades R-3), Sepedi HL CAPS document';

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_SEPEDI_HL_FP_DOC_ID,
    documentVersion: CAPS_SEPEDI_HL_FP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_SEPEDI_HL_FP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Phonics',
  'Reading and Viewing',
  'Group Guided Reading',
  'Handwriting',
  'Writing',
] as const;
export type CapsSepediHlFpContentArea = (typeof CAPS_SEPEDI_HL_FP_CONTENT_AREAS)[number];

export interface CapsSepediHlFpTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_SEPEDI_HL_FP_TOPIC_PROGRESSIONS: readonly CapsSepediHlFpTopicProgression[] =
  [
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade R)',
      grade: 'R',
      description:
        'Listens to stories and acts them out; answers simple questions; repeats rhythm patterns; remembers short sequences of words; names and points to body parts; sings simple songs and acts out rhymes; talks about pictures, posters and books; compares and sorts objects by shape or colour; joins discussions and asks questions; uses terms such as sentence, capital letter and full stop.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 1)',
      grade: '1',
      description:
        'Listens to a story and gives a personal response; follows instructions and announcements; listens without interrupting and asks questions to get more detail; enjoys and responds to pictures, rhymes, riddles and jokes; talks about own experiences and feelings; retells a familiar story with a beginning, middle and end; answers yes/no and explanation questions; plays different roles; takes part in class discussions.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 2)',
      grade: '2',
      description:
        'Listens to stories and poems and answers higher-order questions; follows a sequence of complex instructions; listens politely and asks questions to clarify; talks about own experiences and news; tells a story with a beginning, middle and end; gives an opinion about a story or poem with reasons; answers questions that need explanation; makes up rhymes; plays roles; reports back on group work; uses language terms such as noun, verb, question mark and paragraph.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 3)',
      grade: '3',
      description:
        'Listens for main idea and detail and answers questions needing explanation; listens to a story and looks for cause and effect; gives an opinion about a text with reasons; follows complex instructions; uses social language skills in conversation, accepting and respecting what others say; gives a prepared oral presentation; tells a short story with several characters; uses figurative language such as jokes and riddles; holds a conversation on a set topic; uses language terms such as verb, adjective, synonym, antonym, exclamation mark and quotation marks.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade R)',
      grade: 'R',
      description:
        'Recognises words that sound alike in rhymes; begins to notice that words are built from sounds, for example the first letters of own name; splits spoken sentences into single words; splits multi-syllable words into syllables; identifies the first sound and the vowels in a spoken word by listening and by looking.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 1)',
      grade: '1',
      description:
        'Links letters to sounds for all single-letter sounds; builds words from the letter sounds taught; blends and splits words using consonant clusters that start a word; recognises sounds made of two or three letters; recognises singular and plural forms; notices diminutives and present and past tense; understands the use of capital letters, full stops and question marks; uses prefixes and suffixes to show smallness.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 2)',
      grade: '2',
      description:
        'Revises the Grade 1 sounds; practises consonant clusters at the start of words; recognises sounds of two to four letters; recognises singular and plural; understands present and past tense; understands adjectives and adverbs through examples; uses punctuation correctly; builds words with prefixes and suffixes; understands synonyms and antonyms; builds a spelling pattern for words with sounds and word endings.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 3)',
      grade: '3',
      description:
        'Revises the Grade 1 and 2 sounds; practises consonant clusters that start a word; recognises sounds made of several letters; splits words into syllables; recognises vowels; recognises and uses spelling patterns for singular and plural; recognises present, past and future tense; understands and uses adjectives, adverbs, conjunctions and pronouns; uses punctuation including quotation marks and the apostrophe; uses prefixes and suffixes; understands homonyms, synonyms and antonyms; builds three-, four- and five-letter words; puts words in alphabetical order; spells words correctly using sound knowledge.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and emergent reading (Grade R)',
      grade: 'R',
      description:
        'Recognises and points to common objects in pictures; arranges pictures in order to make a story; reads pictures; acts out parts of a story, song or rhyme; holds a book correctly and turns pages; pretends to read by using the sound of reading; recognises own name and the names of classmates; begins to read common words seen often around the classroom and school; takes part in shared reading of enlarged texts; names and describes characters; predicts what happens next from pictures; answers questions about a story heard; draws a picture of the main idea of a story.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and reading skills (Grade 1)',
      grade: '1',
      description:
        'Builds the habit of holding a book properly; reads pictures to make up a story; uses the cover and pictures to predict what the story is about; reads signs and labels in the classroom; builds basic print concepts such as concept of a book, word and letter; begins reading at the start of a page, left to right and top to bottom; takes part in shared reading with the teacher; links the text to own experience; describes characters; predicts events from pictures; finds cause and effect in a story; says what is liked in a story; reads information from posters, pictures and simple charts.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade 2)',
      grade: '2',
      description:
        'Reads enlarged texts shared with the teacher, both story and information texts, poems and songs; reads signs and print in the environment and electronic texts; predicts from the cover and pictures; identifies main ideas, characters, the problem and the setting; gives and justifies an opinion on a story; answers higher-order and comparison questions on a text; reads a variety of poems; uses visual clues; uses sources of information such as pictures, notices, newspapers and posters; uses a table of contents and page numbers to find information; uses a dictionary to find new words and their meanings.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade 3)',
      grade: '3',
      description:
        'Reads enlarged and other texts both story and information, including electronic texts; reads signs and print in the environment; discusses a text, its main idea, characters, problem, plot and values; says why a story is liked; answers a mix of higher-order questions; reads a variety of poems; uses visual clues to talk about a text; finds and uses information sources such as pictures, newspapers, notices and library books; uses the table of contents, key words and headings to find information; uses a dictionary to find new words.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade R)',
      grade: 'R',
      description:
        'Looks at picture books with a guided reading group and the teacher; reads the same story together as a group; uses common words, sounds and picture clues when reading; checks own reading for sense; reads aloud with attention to punctuation; reads own writing; reads to a friend; reads picture and simple story books from the class reading corner on own; plays reading and word-completion games.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 1)',
      grade: '1',
      description:
        'Reads aloud from a graded reader and from fiction and non-fiction books with the guided group and teacher; uses sounds, picture clues and common words; self-corrects while reading; reads with the right pace and expression; reads own writing and the work of others; reads to a friend; reads simple fiction and non-fiction books and rhymes alone; plays word games.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 2)',
      grade: '2',
      description:
        'Reads slowly and sounds out words from a graded text with the guided group and teacher; uses sound knowledge and word-structure analysis, and self-corrects; checks own reading for word recognition and comprehension; reads with the right pace and expression; reads aloud pictures and simple texts; reads the same text with a partner; reads own and others’ work; reads simple story and information books, poems and comics independently.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 3)',
      grade: '3',
      description:
        'Reads slowly and sounds out words from a graded text with the guided group and teacher; applies sound knowledge and analysis of word structure to unfamiliar words; self-corrects; checks own reading for word recognition and comprehension; uses pictures and illustrations to support understanding; reads with the right pace, expression and pausing; reads independently and with a partner; reads a wide variety of story and information books, poems and comics.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Fine motor skills and writing (Grade R)',
      grade: 'R',
      description:
        'Builds fine motor control with finger play, clay and threading; draws patterns and shapes; builds eye-hand coordination by colouring, drawing and painting; traces and copies own name, simple shapes, patterns and letters; makes letters with finger paint, brush and wax crayons; holds a pencil and crayon correctly; copies short words with the right starting point and direction.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 1)',
      grade: '1',
      description:
        'Practises holding and using pencil and crayon correctly; writes on 17 mm lined paper; forms small and capital letters correctly; writes with good spacing between letters and words; copies own name, short words and sentences; copies letters, words and numbers from the board; writes patterns with the right starting point and direction; moves towards print handwriting.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 2)',
      grade: '2',
      description:
        'Uses writing tools correctly; forms small and capital letters correctly; writes sentences with correct spacing between letters and words; copies a paragraph of three to four lines from a printed text; copies different forms of writing such as short invitations and messages; uses print handwriting across all written records; makes the move to joined or cursive handwriting where the school chooses it.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 3)',
      grade: '3',
      description:
        'Uses writing tools correctly; writes readable sentences in print or joined handwriting; forms small and capital letters correctly with correct spacing; writes short words and sentences in print or joined handwriting; copies words and sentences from the board, textbooks and charts; writes tidily and at a good pace in print or joined handwriting; practises using a pen; transfers to joined handwriting where the school has chosen it.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Emergent and shared writing (Grade R)',
      grade: 'R',
      description:
        'Draws pictures to express own ideas and experiences; talks about own drawings; copies teacher-written labels and captions; takes part in shared writing where the teacher writes down the class ideas; sees writing used for different purposes in the classroom; tries to write own name and simple words from sounds learned.',
      basis: ref(TERMS),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Early writing (Grade 1)',
      grade: '1',
      description:
        'Draws pictures to give a message; writes words that describe a picture; writes words using the sounds learned; copies one sentence of news from the board; contributes ideas to a class story in shared writing, recorded by the teacher; writes labels and a short sentence; builds a personal word bank; writes in three sessions a week built on shared reading and personal experience.',
      basis: ref(TERMS),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Developing writing (Grade 2)',
      grade: '2',
      description:
        'Writes in three to four short sessions per week using shared, group and independent writing; writes about personal experiences and own news; writes captions and short sentences with a picture; follows the steps of the writing process; uses capital letters, full stops and question marks; uses correct spelling for common words; builds a personal word bank and a picture dictionary.',
      basis: ref(TERMS),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Independent writing (Grade 3)',
      grade: '3',
      description:
        'Writes in two to three sessions per week of about 20 minutes using shared, group and independent writing; writes a paragraph of at least eight sentences such as news about self, a story or an event; writes instructions and a message to a friend; uses capital letters, full stops, question marks, exclamation marks and quotation marks; uses sound knowledge and spelling rules for unfamiliar words; uses adverbs and tense correctly; checks subject-verb agreement; builds a personal word bank and dictionary arranged by first sound.',
      basis: ref(TERMS),
    },
  ];

// Recommended weekly home language hours. Source: Section 1.4.1 (hours per week by grade)
// and Section 2.3 (minimum and maximum). Schools may choose within the range.
export const CAPS_SEPEDI_HL_FP_WEEKLY_HOURS = [
  {
    grade: 'R',
    minimumHours: 10,
    maximumHours: 10,
    basis: ref('Section 1.4.1, Time allocation'),
  },
  {
    grade: '1',
    minimumHours: 7,
    maximumHours: 8,
    basis: ref('Section 2.3, Time allocation'),
  },
  {
    grade: '2',
    minimumHours: 7,
    maximumHours: 8,
    basis: ref('Section 2.3, Time allocation'),
  },
  {
    grade: '3',
    minimumHours: 7,
    maximumHours: 8,
    basis: ref('Section 2.3, Time allocation'),
  },
] as const;

// Formal assessment tasks per term for Home Language. Source: Section 2.4, Assessment.
export const CAPS_SEPEDI_HL_FP_FORMAL_TASKS_PER_TERM = [
  {
    grade: '1',
    term1: 1,
    term2: 2,
    term3: 2,
    term4: 2,
    total: 7,
    basis: ref('Section 2.4, Assessment'),
  },
  {
    grade: '2',
    term1: 1,
    term2: 2,
    term3: 2,
    term4: 2,
    total: 7,
    basis: ref('Section 2.4, Assessment'),
  },
  {
    grade: '3',
    term1: 1,
    term2: 3,
    term3: 3,
    term4: 2,
    total: 9,
    basis: ref('Section 2.4, Assessment'),
  },
] as const;

export const CAPS_SEPEDI_HL_FP_METADATA = {
  documentId: CAPS_SEPEDI_HL_FP_DOC_ID,
  documentVersion: CAPS_SEPEDI_HL_FP_VERSION,
  title: 'Sepedi Home Language Foundation Phase Grades R-3',
  publisher: 'Department of Basic Education, South Africa',
  isbn: CAPS_SEPEDI_HL_FP_ISBN,
  phase: 'Foundation Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
