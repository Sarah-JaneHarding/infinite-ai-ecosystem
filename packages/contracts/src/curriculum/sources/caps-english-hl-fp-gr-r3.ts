// Derived structure from English Home Language Foundation Phase Grades R-3.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_ENG_HL_FP_DOC_ID = 'caps-english-hl-fp-gr-r3-2011' as const;
export const CAPS_ENG_HL_FP_VERSION = '2011-ratified' as const;
export const CAPS_ENG_HL_FP_ISBN = '978-1-4315-0400-8' as const;

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_ENG_HL_FP_DOC_ID,
    documentVersion: CAPS_ENG_HL_FP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_ENG_HL_FP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Emergent Reading',
  'Phonological/Phonemic Awareness',
  'Emergent Writing',
  'Phonics',
  'Reading and Viewing',
  'Handwriting',
  'Writing',
] as const;
export type CapsenghlfpContentArea = (typeof CAPS_ENG_HL_FP_CONTENT_AREAS)[number];

export interface CapsenghlfpTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_ENG_HL_FP_TOPIC_PROGRESSIONS: readonly CapsenghlfpTopicProgression[] = [
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: listening and attention',
    grade: 'R',
    description:
      'Listens attentively to simple questions/instructions and responds; listens and repeats rhythmic patterns; listens to stories and joins in choruses; sings action songs; recites rhymes; identifies similarities and differences; names and points to body parts; asks questions and gives explanations; recognises common objects in pictures; sorts and classifies; arranges 3 pictures in story sequence; uses memory games to recall objects seen.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading skills',
    grade: 'R',
    description:
      "Develops correct left-to-right eye movements; distinguishes letter shapes; develops sequencing/memory skills; holds a book correctly; 'reads' pictures and predicts story; pretends to read; recognises own name and 5+ peer names; 'reads' high-frequency words (brand names, SPAR, etc.); participates in Shared Reading of enlarged texts (Big Books, posters) \u2014 minimum 5 Big Books per term; draws pictures capturing the main idea; discusses and describes story characters; responds to stories through movement.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Phonological/Phonemic Awareness',
    topicCode: null,
    topicName: 'Phonemic awareness',
    grade: 'R',
    description:
      'Distinguishes aurally between different sounds at the beginning of own name; identifies a sound not in a sequence; identifies whether two given sounds are the same or different; recognises oral sentences consist of individual words (clapping on single-syllable words); begins to recognise that words are made up of sounds (initial letter of own name).',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent handwriting',
    grade: 'R',
    description:
      "Develops fine-motor skills: rolls plasticine, models play dough, screws nuts onto bolts; develops fine-motor control with scissors (fringe cutting); develops eye-hand co-ordination; develops directionality (left-to-right, up-down); crosses the midline; forms letters with whole body; traces outlines of pictures and patterns; copies patterns onto pegboards; uses a range of writing tools (brushes, wax crayons); 'writes' in sand trays.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing content',
    grade: 'R',
    description:
      "Draws or paints pictures to convey messages; understands writing and drawing are different (uses squiggles); 'reads' own squiggles; role-plays writing; copies own name; 'writes' left-to-right, top-to-bottom; contributes ideas to class news book; groups words by initial sound.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: listening and comprehension',
    grade: 'R',
    description:
      'Listens to 2-3 part instructions; listens without interrupting; listens to and acts out stories; retells stories in own words; sings and recites rhymes; sequences story pictures; participates in discussions; talks about pictures from 5+ themes; recalls word sequences in order (3-4 words); classifies by colour, shape, size; identifies parts from the whole; asks questions and gives explanations; completes 10-piece jig-saw puzzles; finds images in busy pictures; recognises letter shapes.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading',
    grade: 'R',
    description:
      "Develops correct eye movement (left to right); develops directionality (blocks, left to right); holds book correctly; 'reads' pictures and captions; interprets pictures to make story; pretends to read; understands that print communicates meaning; recognises 5 peer names; 'reads' theme flashcards; understands written words refer to spoken words; uses pictures to 'read' simple phrase books; acts out stories, songs, rhymes; recalls details; participates in Shared Reading of Big Books (min. 5 per term); arranges pictures to form a story and predict; responds to stories through creative art.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Phonological/Phonemic Awareness',
    topicCode: null,
    topicName: 'Phonemic awareness',
    grade: 'R',
    description:
      "Distinguishes different sounds at beginning of words; identifies odd word in a same-initial-sound sequence; divides multisyllabic words into syllables using claps; identifies rhyming words in well-known rhymes and songs; anticipates rhyming words; recognises initial spoken sounds of own name; understands words consist of more than one sound; recognises sounds at the beginning of friends' names.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent handwriting',
    grade: 'R',
    description:
      'Develops fine-motor skills: lacing, beading, threading; plays finger rhymes; uses scissors to cut out pictures; develops eye-hand co-ordination (catch, draw, pattern); develops large muscle control (forms letters with body); begins to form letters using finger paint, wax crayons; traces outlines and copies patterns/words; uses a range of writing tools; holds crayon correctly; uses correct sitting position.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing content',
    grade: 'R',
    description:
      "Draws pictures to convey a message; understands difference between writing and drawing; copies letters and numerals from environment (squiggles plus letters); role-plays writing (makes cards, writes letters); 'writes' left-to-right, top-to-bottom; copies print from environment; groups words that share initial sound; identifies letters or spaces between words; contributes dictated sentences to class story.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: listening and reasoning',
    grade: 'R',
    description:
      'Listens attentively and answers questions; responds to announcements; follows complex instructions; listens without interrupting; retells stories; sings/recites rhymes; listens to longer stories; sequences story pictures; recalls word sequences (3-4+ words); talks about pictures from 5+ themes; classifies by own criteria; identifies parts from a whole; completes 10-20 piece jig-saw puzzles; understands pictures/photographs convey meaning; distinguishes letters and word shapes.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading',
    grade: 'R',
    description:
      "Develops eye movement following a pencil; 'reads' pictures and arrows left-to-right; matches word labels to objects; understands simple phrases with picture support; holds book correctly; distinguishes pictures from print; pretends to 'read'; recognises road signs and shop names; recognises weather words, days of the week in classroom; 'reads' simple predictable sentence books; acts out stories/songs/rhymes; recalls details; discusses book care; participates in Shared Reading (min. 5 Big Books); identifies sequence of events; uses book cover to predict; joins in Shared Reading with confidence.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Phonological/Phonemic Awareness',
    topicCode: null,
    topicName: 'Phonemic awareness',
    grade: 'R',
    description:
      "Segments oral sentences into individual words; divides multisyllabic words into syllables (claps); identifies rhyming words; substitutes rhyming words in songs; recognises and names letters of the alphabet (especially own name); recognises initial consonants and vowels at the beginning of common words; understands words consist of more than one sound; recognises sounds at the beginning of animal names and friends' names.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent handwriting',
    grade: 'R',
    description:
      'Develops fine-motor skills: play dough letters, lacing, beading; plays finger rhymes; uses scissors; develops eye-hand co-ordination; develops large muscle control (forms letters with body); begins to form letters (finger paint, wax crayons, pegboards, elastic boards); traces outlines and copies patterns; holds crayon with correct grip; uses correct sitting position.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent writing content',
    grade: 'R',
    description:
      "Draws pictures to convey a message and adds a word/phrase with help; understands difference between writing and drawing; role-plays writing (writes lists); 'writes' left-to-right, top-to-bottom; copies print from environment; contributes to class news book; groups rhyming word pictures; identifies letters and spaces in print; contributes dictated sentences; uses terms 'beginning', 'middle', 'end', 'sound', 'word', 'letter'.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Oral: listening, memory and reasoning',
    grade: 'R',
    description:
      'Listens attentively and answers questions; responds to announcements; passes on messages; follows complex instructions; listens without interrupting; listens to longer stories; retells stories; sings/recites with confidence; sequences story pictures; participates in discussions; recalls word sequences (3-4+ words); talks about pictures from 5+ themes; classifies by complex criteria; identifies parts from the whole in 2D and constructs in 3D; looks to books/TV/computers for explanations; completes 20-piece jig-saw puzzles; uses pictures to predict story content; plays direction games.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Reading',
    topicCode: null,
    topicName: 'Emergent reading',
    grade: 'R',
    description:
      "Matches words to pictures in print; 'reads' pictures; distinguishes pictures from print; 'reads' personal texts (teacher-scribed); recognises high-frequency classroom words; reads increasingly complex picture books; acts out stories/songs/rhymes; recalls details; draws pictures of stories; discusses book care; participates in Shared Reading (min. 5 Big Books); reads class-generated texts; makes predictions using book cover; joins in Shared Reading with confidence; answers questions; independent reading for pleasure in library/corner.",
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Phonological/Phonemic Awareness',
    topicCode: null,
    topicName: 'Phonemic awareness',
    grade: 'R',
    description:
      'Segments oral sentences; divides multisyllabic words (croc-o-dile); identifies rhyming words; recognises initial consonants and vowels in common words; recognises and names letters in own name; relates sounds to letters (duck = d-u-ck done aurally); recognises sounds at the beginning of some words; begins to recognise words are made up of sounds.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Emergent Writing',
    topicCode: null,
    topicName: 'Emergent handwriting',
    grade: 'R',
    description:
      'Develops fine motor skills; plays finger rhymes; uses scissors; develops eye-hand co-ordination; forms letters with body in pairs; forms letters using finger paint, wax crayons; traces outlines; copies patterns/words; uses a range of writing tools; forms letters with pencils and chalk; holds crayons correctly showing dominant hand preference.',
    basis: ref(
      'Section 3.1, Grade R Home Language English, CAPS document (fetched directly from education.gov.za)',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level skills (Grade R)',
    grade: 'R',
    description:
      'Listens to stories; responds to simple questions; listens and repeats rhythmic patterns; names and points to body parts; sings songs and does action rhymes; talks about pictures; matches and sorts by shape/colour; participates in discussions and asks questions.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level skills (Grade 1)',
    grade: '1',
    description:
      "Listens to stories and expresses feelings; listens to instructions/announcements; listens without interrupting; listens to and enjoys riddles/jokes; talks about personal experiences; tells a familiar story with beginning-middle-end; answers closed and open-ended questions; role plays; participates in class discussions; uses terms such as 'sentence', 'capital letter', 'full stop'.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level skills (Grade 2)',
    grade: '2',
    description:
      'Listens to stories/poems and answers higher-order questions; listens to complex instruction sequences; listens without interrupting showing respect; talks about personal experiences and news; tells a story with beginning-middle-end; expresses feelings about a story/poem; answers open-ended questions and justifies; makes up own rhymes; role plays; reports back on group work; uses terms: noun, adjective, verb, pronoun, preposition, comma, question mark, paragraph.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Phase-level skills (Grade 3)',
    grade: '3',
    description:
      'Listens for main idea and detail; works out cause and effect; expresses feelings about a text; listens to complex instructions; engages in conversation as a social skill; makes an oral presentation; tells a short story with plot and characters; uses language imaginatively (jokes, riddles); interviews people; uses terms: subject, verb, object, question, statement, command, synonym, antonym, exclamation mark.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level phonics (Grade R)',
    grade: 'R',
    description:
      'Identifies rhyming words; recognises that words are made up of sounds; gives the beginning sound of own name; segments oral sentences into individual words.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level phonics (Grade 1)',
    grade: '1',
    description:
      "Identifies letter-sound relationships of all single letters; builds words using VC/CVC families (-at, -et, -it, -ot, -ut, -ag, -ig, -og, -ug, -an, -en, -in, -un, -am); uses consonant blends to build/break down words (r-blends and l-blends); recognises common digraphs (sh, ch, th); recognises plurals ('s','es') and word endings ('ing','ed'); groups common words into sound families.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level phonics (Grade 2)',
    grade: '2',
    description:
      "Consolidates Grade 1 phonics; revises common digraphs (sh, ch, th, wh) at beginning and end of words; uses initial and final consonant blends; recognises 3-letter consonant blends (str-); recognises vowel digraphs (oo/moon, ee/tree, oa, ea; short 'oo'/book; ai/rain); recognises silent 'e'/split digraph (tape); recognises at least 5 new vowel digraphs (ar, er, ir, or, ur); recognises double consonants (ll); recognises suffixes (-ly, -ies); spells words using phonic knowledge; builds words using sounds taught.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Phonics',
    topicCode: null,
    topicName: 'Phase-level phonics (Grade 3)',
    grade: '3',
    description:
      "Consolidates Grades 1 and 2 phonics; recognises digraphs (sh-, -sh, ch-, -ch, th-, -th, wh-) at beginning/end; recognises silent 'e'/split digraphs (same, bite, note); recognises vowels -ere, -air, -are; recognises spelling patterns (-igh, -ough, -eigh, -augh); recognises/uses rhyming words (blow, flow, glow); recognises that sounds can have multiple spelling choices (ow/ou, aw/au, tie/high/sky, few/blue); recognises ph=/f/ (elephant); recognises silent letters (k, l, b, w); recognises hard/soft c and g; uses synonyms, antonyms; uses prefixes (un-, re-) and suffixes (-ful, -ness); uses homophones; builds 3-, 4- and 5-letter words; sorts alphabetically; spells correctly using phonic knowledge.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Emergent reading (Grade R)',
    grade: 'R',
    description:
      "Recognises and points out common objects in pictures; arranges pictures to form a story; interprets pictures; acts out story parts; holds book correctly and turns pages; pretends to read with 'reading voice'; recognises own name and peer names; begins to 'read' high-frequency classroom words.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared and Guided Reading (Grade 1)',
    grade: '1',
    description:
      'Reads Big Books/enlarged texts; uses pictures/cover to predict story; discusses story and identifies main idea and characters; sequences events; recognises cause and effect. Guided Reading: reads aloud from own book in a group; uses phonics, context clues, structural analysis and sight words; reads with increasing fluency; monitors own reading; shows understanding of punctuation. Independent/Paired Reading: reads own writing, picture books, books from reading corner.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared and Guided Reading (Grade 2)',
    grade: '2',
    description:
      "Reads fiction and non-fiction Big Books; uses visual cues to predict; identifies key details; expresses and justifies preferences; answers higher-order questions; discusses different cultures in stories; interprets pictures, photographs, calendars, advertisements, posters. Guided Reading: reads silently and aloud; uses sight words, phonics, contextual/structural analysis and comprehension skills; reads with increasing fluency and speed; uses self-correcting strategies; uses diagrams/illustrations. Independent/Paired Reading: reads own/others' writing; reads to a partner; reads independently fiction/non-fiction, poetry cards, comics; plays reading games.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Shared and Guided Reading (Grade 3)',
    grade: '3',
    description:
      "Reads enlarged fiction/non-fiction texts, newspaper articles, plays, dialogues, computer texts; discusses main idea, characters, plot, problem, values; answers a range of higher-order questions; reads different poems; uses visual cues for graphical texts (advertisements, graphs, charts, maps); finds and uses information sources (community members, library books); uses table of contents, index and page numbers; uses keywords and headings; uses a dictionary. Guided Reading: reads fiction and non-fiction at own level; uses phonics, contextual/structural analysis; uses self-correcting strategies; reads with increasing fluency, speed and expression. Independent/Paired Reading: reads own/others' writing; reads to partner; reads fiction/non-fiction from different cultures, magazines, comics.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Handwriting',
    topicCode: null,
    topicName: 'Emergent handwriting (Grade R)',
    grade: 'R',
    description:
      'Develops small muscle skills (play dough, nuts/bolts); develops fine-motor control (scissors); develops eye-hand co-ordination (catching, drawing, painting); traces simple outlines of pictures, patterns and letters; forms letters using finger painting, wax crayons; copies patterns, words and letters (correct starting point and direction); uses a range of writing tools.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Handwriting',
    topicCode: null,
    topicName: 'Print script (Grade 1)',
    grade: '1',
    description:
      'Forms lower and upper case letters correctly and fluently; forms numerals correctly; copies and writes short sentences with correct spacing; holds pencil correctly. Maintenance: uses handwriting tools effectively; aligns writing on 17mm ruled lines; forms all upper and lower case letters correctly; writes with correct spacing; copies from teacher or sentence strips; writes in print script.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Handwriting',
    topicCode: null,
    topicName: 'Transition to cursive (Grade 2)',
    grade: '2',
    description:
      'Copies and writes writing patterns in joined script/cursive; copies and writes all lower case and commonly used capital letters in joined script/cursive; copies, writes and reads short words in joined script/cursive; copies and writes short sentences in joined script/cursive.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Handwriting',
    topicCode: null,
    topicName: 'Cursive consolidation (Grade 3)',
    grade: '3',
    description:
      'Uses handwriting tools effectively; writes a sentence legibly in both print script and joined/cursive; forms all lower and upper case letters in cursive; writes short words in cursive; transcribes words and sentences correctly in cursive; makes full transition to cursive in all written recording (date, own name, own texts); copies text correctly; writes neatly, legibly and with confidence and speed; experiments with using a pen.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Emergent writing (Grade R)',
    grade: 'R',
    description:
      "Draws/paints pictures to convey a message; 'writes' from left to right and top to bottom; contributes ideas for class news book by means of drawings; makes attempts to write using squiggles/scribbles; 'reads' own squiggles; makes own books; copies own name.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing skills (Grade 1)',
    grade: '1',
    description:
      'Draws pictures to convey messages; contributes ideas and helps to revise class/group story (Shared Writing); copies one sentence of news correctly; writes a message on a card; writes and illustrates a caption or short sentence; writes at least three sentences of own news or creative story using capital letters and full stops; writes sentences using sounds/sight words taught; uses nouns and pronouns (I, you, she, he, it) correctly; uses present and past tense; forms plurals of familiar words; spells common words correctly; uses prepositions correctly; organises information into simple graphic form; builds own word bank and personal dictionary.',
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing skills (Grade 2)',
    grade: '2',
    description:
      "Contributes ideas and words for a class story (Shared Writing); writes a simple poem; writes a birthday card or letter; writes at least two paragraphs (ten sentences) on personal experiences; drafts, writes and 'publishes' a two-paragraph story; uses informational structures (recipes); organises information in a chart or table; writes and illustrates 4-6 sentences on a topic; uses the writing process (draft, write, edit); uses correct punctuation (full stops, commas, question marks, exclamation marks); spells common words correctly; uses present, past and future tense; uses prepositions, nouns, verbs and pronouns; builds word bank and personal dictionary; uses a dictionary.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
  {
    contentArea: 'Writing',
    topicCode: null,
    topicName: 'Writing skills (Grade 3)',
    grade: '3',
    description:
      "Uses pre-writing strategies to gather information and plan; writes a selection of short texts for different purposes (recounts, dialogues); writes about personal experiences in different forms (short newspaper article); drafts, writes, edits and 'publishes' a story of at least two paragraphs (at least 12 sentences); writes and illustrates 6-8 sentences on a topic; uses informational structures (experiments, recipes); keeps a diary for one week; writes a simple book review; sequences information under headings; summarises and records information (mind maps); uses punctuation correctly (capital letters, full stops, commas, question marks, exclamation marks, inverted commas, apostrophes in contractions); uses conjunctions (compound sentences); uses phonics knowledge and spelling rules; uses a dictionary.",
    basis: ref(
      'Section 3, Overview of Language Skills to be Taught (pp.23-30), HL CAPS document',
    ),
  },
];

export const CAPS_ENG_HL_FP_METADATA = {
  documentId: CAPS_ENG_HL_FP_DOC_ID,
  documentVersion: CAPS_ENG_HL_FP_VERSION,
  title: 'English Home Language Foundation Phase Grades R-3',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0400-8',
  phase: 'Foundation Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
