// Derived structure from Sesotho Home Language Foundation Phase Grades R-3.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s). The source is written in Sesotho;
// every description below is an English paraphrase of the skills it lists.
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and time allocations only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_SESOTHO_HL_FP_DOC_ID = 'caps-sesotho-hl-fp-gr-r3-2011' as const;
export const CAPS_SESOTHO_HL_FP_VERSION = '2011-ratified' as const;
export const CAPS_SESOTHO_HL_FP_ISBN = '978-1-4315-0403-9' as const;

const OVERVIEW =
  'Section 3, Overview of Language Skills (CAPS pp.25-30), Sesotho HL CAPS document';

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_SESOTHO_HL_FP_DOC_ID,
    documentVersion: CAPS_SESOTHO_HL_FP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_SESOTHO_HL_FP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Phonics',
  'Reading and Viewing',
  'Group Guided Reading',
  'Handwriting',
  'Writing',
] as const;
export type CapsSesothoHlFpContentArea =
  (typeof CAPS_SESOTHO_HL_FP_CONTENT_AREAS)[number];

export interface CapsSesothoHlFpTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS: readonly CapsSesothoHlFpTopicProgression[] =
  [
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade R)',
      grade: 'R',
      description:
        'Listens to a story and acts it out; listens to simple questions and responds; repeats rhythm patterns accurately; remembers a short sequence of words; names and points to body parts; sings simple songs with actions; talks about pictures on posters, charts and in books; sorts and matches objects by shape or colour; joins discussions and asks questions; uses terms such as sentence, capital letter and full stop.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 1)',
      grade: '1',
      description:
        'Listens to a story and gives a personal response; follows instructions and announcements and responds correctly; listens without interrupting, takes turns and asks questions to understand more; enjoys and responds to pictures, rhymes, riddles and jokes; talks about own experiences and feelings; retells a familiar story with a beginning, middle and end; answers yes/no and explanation questions; plays roles in different situations; takes part in class discussions.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 2)',
      grade: '2',
      description:
        'Listens to stories and poems and answers higher-order questions; follows a sequence of complex instructions; listens politely, asks questions and gives comments; talks about own experiences and news; tells a story with a beginning, middle and end; gives an opinion about a story or poem with reasons; answers open questions and explains the answer; makes up own rhymes; plays roles; reports back on group work; uses language terms such as noun, pronoun, verb, question mark and paragraph.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Listening and Speaking',
      topicCode: null,
      topicName: 'Oral language (Grade 3)',
      grade: '3',
      description:
        'Listens for main ideas and detail and answers open questions; listens to a story and finds the cause and the result; gives an opinion about a text with reasons; follows complex instructions accurately; takes part in conversations, accepting and respecting how others speak; gives a prepared oral presentation such as telling own news or an experience; tells a short story with a simple plot and several characters; uses figurative language such as jokes and riddles; interviews people on a set topic; uses language terms such as verb, adjective, antonym, exclamation mark and quotation marks.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade R)',
      grade: 'R',
      description:
        'Recognises words that rhyme in rhymes and familiar songs; begins to notice that words are made of sounds, for example the first letters of own name; splits spoken sentences into single words; splits words with many syllables into syllables; identifies the first sounds and the vowels in a spoken word by listening and by looking.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 1)',
      grade: '1',
      description:
        'Links letters to sounds for all single-letter sounds; builds words from the letters learned; uses the two-letter consonant sounds that stand alone at the start of a word; recognises sounds made of two or three letters; recognises plural forms; sorts common words into sound families; recognises a leading "th" sound at the start of a word; notices words that sound alike but differ in meaning and tone.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 2)',
      grade: '2',
      description:
        'Joins the sounds taught in Grade 1; links combined consonant sounds at the start and end of words; recognises sounds made of two letters; recognises combined vowel sounds inside words; recognises words that sound the same but have different meaning; builds words of three, four, five or more letters; puts letters and words in alphabetical order; spells words correctly using sound knowledge.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Phonics',
      topicCode: null,
      topicName: 'Sounds and word building (Grade 3)',
      grade: '3',
      description:
        'Joins the sounds taught in Grades 1 and 2; recognises combined consonant sounds at the start and end of words; recognises combined vowel sounds inside words; recognises high and low tones in written words and uses spelling patterns that form a rhyme; recognises and uses words that sound the same but have different meaning; builds words of three, four, five or more letters; puts words in alphabetical order; spells correctly using sound knowledge.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade R)',
      grade: 'R',
      description:
        'Recognises and points to common objects in pictures; arranges a set of pictures to make a story; reads pictures and tells own story from them; acts out parts of a story, song or rhyme; holds a book correctly and turns pages properly; pretends to read using a reading voice; recognises own name and the names of classmates; begins to read frequently seen words around the classroom and school; takes part in shared reading of enlarged texts and poems; links own experience to what is read; describes characters and gives an opinion about them; predicts from pictures; answers questions about the story; draws a picture of the main idea.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade 1)',
      grade: '1',
      description:
        'Builds the habit of holding a book correctly and turning pages; reads pictures to make up a story; uses the cover and pictures to predict what a story is about; reads labels and signs around the classroom; builds print concepts such as the idea of a book, word and letter; reads from the start of a page, left to right and top to bottom; takes part in shared reading with the teacher; links the story to own experience; describes characters; predicts events from pictures; finds the cause and the result in a story; says why a story is liked; reads information from posters, pictures and simple tables such as a calendar.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade 2)',
      grade: '2',
      description:
        'Reads enlarged texts and other texts shared with the teacher, both fiction and non-fiction, poems and songs; reads signs and print in the environment; predicts from the cover and pictures; identifies main ideas, characters and the problem in a story; gives and justifies an opinion on a story; answers higher-order questions on a text; reads a variety of poems; uses visual clues; discusses cultures that appear in stories; reads other texts such as photographs, calendars, advertisements, newspapers and posters; uses a table of contents and page numbers to find information; uses a dictionary to find new words.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Reading and Viewing',
      topicCode: null,
      topicName: 'Shared reading and comprehension (Grade 3)',
      grade: '3',
      description:
        'Reads enlarged and other texts, both fiction and non-fiction, including texts on a computer; reads signs and print in the environment; discusses a text and its main idea, characters, problem, plot and values; says why a story is liked; answers higher-order questions on a text; reads a variety of poems; reads graphic texts such as advertisements, pictures, charts and maps; finds and uses information sources such as community members and library books; uses the table of contents, key words and headings to find information; uses a dictionary to find new words and meanings.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade R)',
      grade: 'R',
      description:
        'Looks at picture books with the guided reading group and the teacher, with the whole group reading the same story; uses sounds, picture clues and frequently seen words when reading; checks own reading for sense; reads aloud with attention to punctuation; reads own writing; reads to a friend; reads picture and story books alone in the class reading corner; plays reading and word-completion games.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 1)',
      grade: '1',
      description:
        'Reads aloud from a graded reader and from fiction and non-fiction books at the right level with the guided group and the teacher; uses sounds, picture clues and frequently seen words; self-corrects while reading; reads with growing pace and the right expression; reads own writing and the work of others; reads to a friend; reads simple fiction and non-fiction books and rhyme cards alone; plays word games.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 2)',
      grade: '2',
      description:
        'Reads aloud and silently from graded fiction and non-fiction texts with the guided group and teacher; uses sound knowledge, word analysis and common words; self-corrects while reading; checks own reading for word recognition and comprehension; reads with the right pace and expression; reads aloud to a friend; reads own work and the work of others; reads simple story and information books, poems and comics alone.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Group Guided Reading',
      topicCode: null,
      topicName: 'Guided and independent reading (Grade 3)',
      grade: '3',
      description:
        'Reads aloud and silently from graded texts with the guided group and teacher, as far as possible with the whole group reading the same text; uses sound knowledge, word analysis and common words to read unfamiliar words; uses a strategy of preparing, pausing and practising before reading a word aloud; self-corrects and checks own reading for word recognition and comprehension; uses diagrams and illustrations to improve understanding; reads with growing pace and the right expression; reads alone and with a partner a wide variety of books, magazines and comics.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade R)',
      grade: 'R',
      description:
        'Builds fine motor control with finger play, clay and threading; draws patterns and shapes; builds eye-hand coordination by colouring, drawing, painting and cutting; traces and copies own name, simple shapes, patterns and letters; makes letters with finger paint, brush and wax crayons; holds a pencil and crayon correctly; copies short words with the right starting point and direction.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 1)',
      grade: '1',
      description:
        'Practises holding and using a pencil and crayon correctly; writes on 17 mm lined paper; forms small and capital letters correctly; keeps correct spacing between letters and words; copies own name, short words and sentences; copies letters, words and numbers from the board; writes patterns with the right starting point and direction; moves towards print handwriting.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 2)',
      grade: '2',
      description:
        'Uses writing tools correctly; forms small and capital letters correctly; writes sentences with correct spacing between letters and words; copies a paragraph of three to four lines from a printed text; copies different forms of writing such as short invitations and messages; uses print handwriting across all written records; makes the move to joined handwriting where the school chooses it.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Handwriting',
      topicCode: null,
      topicName: 'Handwriting (Grade 3)',
      grade: '3',
      description:
        'Uses writing tools correctly; writes readable sentences in print or joined handwriting; forms small and capital letters correctly with correct spacing; writes short words and sentences in joined handwriting; copies text from the board, books and charts; writes tidily and at a good pace; practises using a pen; makes the move to joined handwriting where the school has chosen it.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Writing (Grade R)',
      grade: 'R',
      description:
        'Draws pictures to give a message; copies familiar letters from own name to stand for writing; writes from left to right and from top to bottom; brainstorms ideas for a class book in pictures; tries writing letters in print, scribble and other forms; reads own writing by saying what it says; makes own books and adds them to the class book collection.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Writing (Grade 1)',
      grade: '1',
      description:
        'Draws pictures to give a message about what is known; contributes ideas and helps to retell a group or class story in shared writing; copies one sentence from a poster or chart accurately; writes a message on a card, for example on health; writes and illustrates a heading or short sentence; writes at least three sentences of own news or imagination using capital letters and full stops; writes sentences using sounds and common words already learned; with help uses nouns and pronouns correctly; begins to use present and past tense; forms plurals of common words; uses pointing words correctly; organises information in a simple chart or timeline; builds a word bank and personal dictionary.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Writing (Grade 2)',
      grade: '2',
      description:
        'Contributes ideas and words for the class story in shared writing; writes a simple poem; writes a personal message such as a birthday card or letter; writes at least two paragraphs of about ten sentences on known topics or events such as family celebrations; drafts, writes and publishes a two-paragraph story; uses information texts such as a recipe; organises information in a chart; writes and illustrates four to six sentences on a topic; follows the steps of the writing process (draft, write, edit); uses punctuation including full stops, question marks and exclamation marks; spells common words correctly and attempts unfamiliar ones; uses present, past and future tense; uses pointing words, nouns, verbs and pronouns; builds a word bank and personal dictionary; uses a dictionary.',
      basis: ref(OVERVIEW),
    },
    {
      contentArea: 'Writing',
      topicCode: null,
      topicName: 'Writing (Grade 3)',
      grade: '3',
      description:
        'Contributes ideas and words for a class story in shared writing; uses pre-writing strategies to gather information and plan; writes a poem; writes a personal message such as a birthday card or letter; writes at least two paragraphs (at least 12 sentences) on own topics or for different purposes, such as news or a short newspaper article; drafts, edits and publishes a story; writes and illustrates six to eight sentences on a topic; uses information texts such as recipes and experiments; keeps a diary for one week; writes a simple book review; sorts information under headings; summarises and records information in a mind map; uses punctuation correctly including capital letters, full stops, question marks, exclamation marks, quotation marks and apostrophes; uses conjunctions to join sentences; uses sound knowledge to write difficult words; uses a dictionary.',
      basis: ref(OVERVIEW),
    },
  ];

// Recommended weekly home language hours. Source: Section 1.4.1 (hours per week by grade)
// and Section 2.3 (minimum and maximum). Schools may choose within the range.
export const CAPS_SESOTHO_HL_FP_WEEKLY_HOURS = [
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
export const CAPS_SESOTHO_HL_FP_FORMAL_TASKS_PER_TERM = [
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

export const CAPS_SESOTHO_HL_FP_METADATA = {
  documentId: CAPS_SESOTHO_HL_FP_DOC_ID,
  documentVersion: CAPS_SESOTHO_HL_FP_VERSION,
  title: 'Sesotho Home Language Foundation Phase Grades R-3',
  publisher: 'Department of Basic Education, South Africa',
  isbn: CAPS_SESOTHO_HL_FP_ISBN,
  phase: 'Foundation Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
