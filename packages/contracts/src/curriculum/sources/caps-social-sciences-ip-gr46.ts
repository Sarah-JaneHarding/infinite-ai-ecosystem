// Derived structure from Social Sciences Intermediate Phase Grades 4-6.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_SS_IP_DOC_ID = 'caps-social-sciences-ip-gr46-2011' as const;
export const CAPS_SS_IP_VERSION = '2011-ratified' as const;
export const CAPS_SS_IP_ISBN = '978-1-4315-0489-3' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_SS_IP_DOC_ID,
    documentVersion: CAPS_SS_IP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_SS_IP_CONTENT_AREAS = ['History', 'Geography'] as const;
export type CapsssipContentArea = (typeof CAPS_SS_IP_CONTENT_AREAS)[number];

export interface CapsssipTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_SS_IP_TOPIC_PROGRESSIONS: readonly CapsssipTopicProgression[] = [
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Local History (Grade 4 History Project)',
    grade: '4',
    description:
      'Finding out about the past and applying this knowledge to local history. How we find out about the present in a local area: information from pictures, writing, stories/interviews, objects. How we find out about the history of a local area: same four types of information sources. History project for Grade 4 (Term 1): Make a museum display \u2014 an interactive museum of everyday objects with labels, featuring different kinds of information from past and present of the local area; identify and interview one person who has made a difference in the area. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Learning from leaders: Nelson Mandela and Mahatma Gandhi',
    grade: '4',
    description:
      'The qualities of good leaders: listens to people; servant of the people; works with a team; has courage and bravery; dedicated and committed to beliefs and others; prepared to sacrifice for the sake of others. Life stories of leaders who show these qualities: Nelson Mandela (5 hrs): Why is he an example of a good leader? Is it always easy to be a good leader? Are leaders always popular? Are leaders always perfect? How can ordinary people follow good leaders? Mahatma Gandhi (5 hrs): same guiding questions. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Transport through time',
    grade: '4',
    description:
      "How transport has changed people's lives over time on land, water and in the air. Transport on land (6 hrs): animals; carts, wagons and coaches; the bicycle; steam engine and train; the motor car; common forms of transport today. Case study: environmental damage from exhaust fumes in a big city (1 hr). Transport on water (4 hrs): rafts, canoes and reed boats; first sailing ships (Chinese junks, Arab dhows, caravels, British tall ships, clippers); first steamships; modern water transport. Transport in the air (2 hrs): balloons and airships; Wright brothers and first aeroplane; modern air transport. Approx. 15 hours.",
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Communication through time',
    grade: '4',
    description:
      'How communication has changed over time, and how many forms have stayed the same. The oldest forms of human communication (3 hrs): language, symbols, songs, art and dance \u2014 San hunter-gatherers as an example. Change in modern forms of communication (9 hrs): postal system; radio; early typewriters; telegraph; telephone; camera; television; computer; internet; cell phone. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Hunter-gatherers and herders in southern Africa',
    grade: '5',
    description:
      'The way of life of hunter-gatherers and herders, the earliest inhabitants of southern Africa. How we find out about them (2 hrs): stories, objects, rock paintings, books, living societies (ethnography). San hunter-gatherer society in the Later Stone Age (8 hrs): lived off the environment (deep knowledge of seasonal availability of wild resources); invention of the bow and arrow; social organisation (all things shared equally); plant medicines; San beliefs and religion; rock art (where, when, how, why it was created; interpretations; SA Coat of Arms and the Linton Rock Art Panel). Khoikhoi herder society in the Later Stone Age (2 hrs): pastoral way of life; how San and Khoikhoi shared the same landscape. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'The first farmers in southern Africa',
    grade: '5',
    description:
      'The way of life of the first farmers of southern Africa (Bantu-speakers; entered SA between 2 000 and 1 700 years ago). When, why and where the first African farmers settled (2 hrs): attitudes to land; interaction with Khoisan \u2014 principles of generous acceptance. How early African farmers lived in settled chiefdoms (10 hrs): homesteads and villages; agriculture (crops and livestock); social, political and economic structures; roles of men, women, boys and girls; culture of co-operation; role of the chief; role of cattle; tools and weapons from iron and copper; metal working (iron smelting, smithery); pottery; trade; medicine and healing; hunting. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'An ancient African society: Egypt',
    grade: '5',
    description:
      "The way of life in ancient Egyptian society. The Nile River and how it influenced settlement (2 hrs). Way of life in ancient Egypt (8 hrs): social structure; beliefs and religion; Pharaohs; Sphinx, pyramids and temples; hieroglyphics; mathematics and astronomy; medicine and physicians (diseases, anatomy, physiology, clinical examinations). Case study: The tomb of Tutankhamen (2 hrs): discovery (who, when, why); what the discovery revealed about ancient Egyptian society. The spread of Egypt's advanced knowledge to other places, e.g. Europe and the Middle East (1 hr). Approx. 15 hours.",
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'A heritage trail through the provinces of South Africa',
    grade: '5',
    description:
      'A rich and diverse heritage that belongs to all South Africans. Tangible and intangible heritage. Names of provinces and capital cities on a map (1 hr). What heritage is (2 hrs). Different examples of heritage from each province (9 hrs): Cradle of Humankind (Gauteng); Golden objects at Mapungubwe (Limpopo); Frances Baard (Northern Cape); names of rivers, dams and towns (Free State); the Castle (Western Cape); healing properties of the aloe (Eastern Cape); stone-walled town of Kaditshwene (North West); Makhonjwa Mountains (Mpumalanga); San Rock art in the Drakensberg (KZN). Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'An African kingdom long ago in southern Africa: Mapungubwe',
    grade: '6',
    description:
      "Changes in societies in the Limpopo Valley 900\u20131300 AD: bigger, more organised, more complex. Settlements before Mapungubwe: K2 and Schroda. Mapungubwe: first state in southern Africa 1220\u20131300 AD (6 hrs): king and sacred leadership; first stone-walled palace; significance of Mapungubwe Hill; first town; distinct social classes; golden rhinoceroses and other golden objects (symbols of royal power); trade across Africa and Indian Ocean (globalisation); goods traded; people's journeys on foot; today: World Heritage Site and Order of Mapungubwe. Change and continuity in East Coast trade; Great Zimbabwe. European explorer in Asia at the same time \u2014 Marco Polo (3 hrs): travels; influence on European traders and explorers. Approx. 15 hours.",
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Explorers from Europe find southern Africa',
    grade: '6',
    description:
      'Changes in Europe which enabled European exploration; early exploration of the southern African coast. Reasons for European exploration (8 hrs): the European Renaissance (15th\u201316th centuries) \u2014 a turning point; case studies of Leonardo da Vinci and Galileo; new ideas and knowledge; inventions (gunpowder, magnetic compass, caravel); spreading the Christian religion; trade and making a profit. European trade route to the East via southern Africa (4 hrs): Dias and his crew encounter the Khoikhoi in Mossel Bay 1488; the journey of Dias; the journey of Da Gama; VOC (Dutch East India Company) journeys; life of a sailor on a VOC ship. Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Democracy and citizenship in South Africa (Grade 6 History Project)',
    grade: '6',
    description:
      "The meaning of democracy and good citizenship. How people govern themselves in a democracy: our national government (7 hrs): first democratic government in SA 1994; political parties and voting in national elections; purpose of the Constitution; role of Parliament; importance of rules and laws; justice system and equality under the law. Rights and responsibilities of citizens: case study \u2014 Fatima Meer; the Constitutional Court; case study \u2014 Pius Langa. Children's rights and responsibilities (2 hrs): Children's Charter of South Africa. National symbols since 1994 (2 hrs): Coat of Arms, national flag, national anthem. History research project for Grade 6 (2 hrs class time): biography of a South African who has contributed to building democracy. Approx. 15 hours.",
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Medicine through time',
    grade: '6',
    description:
      'The changing ways of treating illness. Indigenous healing in South Africa (3 hrs): illness has more than physical causes \u2014 holistic approach; vast knowledge of medicinal plants used by some healers; how people are identified and trained to be healers. Some modern Western scientific medical discoveries (7 hrs): fight against infectious disease \u2014 vaccination against smallpox (Edward Jenner); connection between germs and disease (Louis Pasteur); germs that cause TB (Robert Koch); first antibiotic \u2014 penicillin (Alexander Fleming); first heart transplant \u2014 case study (Christiaan Barnard). Brief overview of discoveries enabling surgery: anaesthetics, avoiding infection, blood transfusions, X-rays, heart surgery. Link between holistic and Western forms of healing today (2 hrs). Approx. 15 hours.',
    basis: ref(
      'Section 3.2, Intermediate Phase History: Outline of what is to be taught (pp. 33-45)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Places where people live (settlements)',
    grade: '4',
    description:
      'People and places (5 hrs): farm, village, town, city; jobs people do; buildings and their uses; roads and footpaths. Landmarks and explaining the way (3 hrs): identifying natural and human-made landmarks; describing and drawing a short journey (e.g. way to school); explaining how to get from one place to another (left, right, straight, landmarks, road names). People and their needs (4 hrs): what all people need (water, food, shelter, health care, energy); ways people meet their needs in different places. Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Map skills',
    grade: '4',
    description:
      "Side views and plan views (2 hrs): side views and views from above of simple objects; plan views of tables, classrooms, buildings, trees, sports fields. Symbols and keys (3 hrs): symbols as simple pictures or letters; keys on South African maps; reading a farm/village map; drawing own map. Grid references (2 hrs): concept of alpha-numeric grid references; reading and giving grid references. Compass directions (1 hr): N, S, E, W on local area and map. A map of South Africa (2 hrs): sea and land; oceans along coastline; provinces (names, locations); main cities/towns of own province; approximate location of own settlement. A globe and map of the world (2 hrs): the world is round; continents (names and locations); oceans (Pacific, Atlantic, Indian); South Africa's location. Approx. 15 hours.",
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Food and farming in South Africa',
    grade: '4',
    description:
      'People and food (2 hrs): food people eat (from plants and animals); ways people get food. Ways of farming (3 hrs): subsistence farming; commercial farming; growing food in towns and cities. Crop and stock farming (5 hrs): important crops of SA; case study of fruit farming in SA; large stock, small stock and poultry; case study of stock farming; location of main farming areas on a map. Unprocessed and processed foods (3 hrs): concepts of unprocessed and processed foods; how and why foods are processed (cooking, drying, squeezing, cutting, mixing); from farm to factory to shop to home (wheat to bread to sandwich \u2014 flow diagram). Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Water in South Africa',
    grade: '4',
    description:
      'Uses of water (2 hrs): daily personal uses; other uses (farming, factories, mines, electricity, gardens, recreation). Water as a resource (5 hrs): salt water and fresh water on earth; the natural water cycle; fresh water in nature (rain, rivers, streams, wetlands, lakes, underground); storing water (dams, water tanks, buckets, pots). How people get their water (3 hrs): rivers/streams/springs; boreholes and wells; water trucks; taps (pipes from dams to purification plants to taps). Pollution and wastewater (2 hrs): personal daily practices that pollute water; factory and farming waste; wastewater and sewage recycling; water use cycle. Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Map skills (focus: Africa)',
    grade: '5',
    description:
      "World map and compass directions (2 hrs): equator, north/south poles; eight points of compass (N/S/E/W/NE/NW/SE/SW); eight directions from a fixed point on a world map. Africa our continent (4 hrs): position on world map/globe; oceans around Africa; countries of Africa (location, landlocked/coastal, N/S/on Equator); Madagascar; Zanzibar; big cities (Cairo, Lagos, Johannesburg, Nairobi); South Africa's neighbours; capital cities. A physical map of Africa (3 hrs): features (mountains, rivers, lakes, height above sea level); Africa's highest mountains (Kilimanjaro, Mount Kenya); three largest lakes (Victoria, Tanganyika, Malawi); great rivers (Nile, Niger, Congo, Zambezi, Limpopo, Gariep-Orange); famous waterfalls; Sahara and Namib deserts; physical features as borders. Images of Africa (3 hrs): photographs of scenes and landscapes; grid references for approximate location. Approx. 15 hours.",
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Physical features of South Africa',
    grade: '5',
    description:
      'South Africa from above \u2014 physical map (2 hrs): high and low places; sea level; coastal plain, escarpment, plateau; location of Highveld, Lowveld, Great Karoo, Little Karoo, Kalahari, Namaqualand. Physical features (3 hrs): mountains, valleys, hills, rivers, waterfalls, coastlines (capes and bays); main physical features of own province; selected features in SA (Table Mountain, uKhahlamba-Drakensberg, Waterberg, Lake St. Lucia, Augrabies Falls, Cape Point, Algoa Bay); place names (how 3 places got their names). Rivers (3 hrs): where rivers begin and end; direction of flow; concept of river systems; main rivers of SA (sources, tributaries, direction). Physical features and human activities (4 hrs): links between physical features and where people live and what they do; case studies \u2014 impact of dams on physical environment; road building. Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Weather, climate and vegetation of South Africa (Geography Project)',
    grade: '5',
    description:
      "Weather (3 hrs): elements (temperature, wind, cloud cover, rainfall); precipitation; measuring instruments; wind direction; weather maps in media; how weather affects daily lives. Observing and recording the weather \u2014 Independent Geography Project (2 hrs): observe and record daily weather over two weeks; report on temperatures, cloud cover, precipitation and wind; observe how weather affects daily lives. Rainfall (2 hrs): rainfall distribution map of SA; rainfall patterns (summer/winter/all year; bar graphs). Climate (3 hrs): difference between weather and climate; different kinds of climate in SA (hot/warm/cold/cool/dry/wet/humid); climate of own area. Natural vegetation (3 hrs): concept of 'natural vegetation'; links between natural vegetation and climate; case study \u2014 Savannah grasslands (location, links between climate/vegetation/wildlife). Approx. 15 hours.",
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Minerals and mining in South Africa',
    grade: '5',
    description:
      'Mineral and coal resources of South Africa (4 hrs): minerals as non-renewable resources; main minerals mined (gold, platinum, diamonds, iron ore, chrome, copper, silver, manganese); coal as a non-renewable resource (how coal is formed, uses); location of mineral and coal mines on map; links to settlement patterns. Mining and the environment (5 hrs): concept of mining; open pit/surface mining; shaft and deep level mining; impact on environment (pollution \u2014 water and air; destruction of vegetation and wildlife; waste and waste disposal). Mining and people (3 hrs): challenges of working in a deep gold mine (ventilation, heat, rock falls, dust); health and safety risks (silicosis); rules to protect health and safety. Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Map skills (focus: World)',
    grade: '6',
    description:
      'Latitude and longitude in degrees (4 hrs): latitude and longitude on a globe; concept of hemisphere (northern/southern divided by equator; eastern/western divided by Greenwich Meridian and 180\u00b0 longitude); location of SA in southern and eastern hemispheres; latitude and longitude on a flat map; locate selected countries and cities in degrees. Scale (4 hrs): concept of scale; small- and large-scale maps; line scales; word scales; measuring straight-line distances on SA and world maps. Atlases, global statistics and current events (4 hrs): kinds of information in an atlas; content page of an atlas; own province in an atlas; world records (longest rivers, highest mountains, biggest deserts, largest cities, largest countries); locate major current events on a map (on-going throughout year). Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Trade (focus: South Africa and the world)',
    grade: '6',
    description:
      "Why people trade (2 hrs): trade as exchange of goods; buying and selling for money; exports and imports between SA and the world. What people trade (2 hrs): goods \u2014 raw materials (primary) and manufactured goods (secondary); skills and services. Resources and their values (4 hrs): values of selected raw materials and manufactured goods; case studies \u2014 from cocoa to chocolate; from gold to jewellery. Fair trading (4 hrs): concepts of 'unfair trade' and 'fair trade'; the human cost of unfair trade (work and exploitation); fair trade \u2014 case study of a positive project. Approx. 15 hours.",
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Climate and vegetation around the world',
    grade: '6',
    description:
      'Climate around the world (4 hrs): difference between weather and climate; hot, mild and cold climates (January and July temperature maps); wet and dry areas (annual rainfall map). Tropical rainforests (3 hrs): location; climate (temperature and rainfall patterns); natural vegetation and wildlife; deforestation \u2014 reasons and consequences with a case study. Hot deserts (3 hrs): location; climate; natural vegetation and wildlife; how people live in a desert. Coniferous forests (3 hrs): location; climate; natural vegetation and wildlife; human activities (links between natural environment and livelihoods). Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Population \u2014 why people live where they do (focus: SA and world)',
    grade: '6',
    description:
      'People and provinces in South Africa (3 hrs): population distribution and population density; population distribution map; total population figures per province (graphs); average population density per province (graphs). Why people live where they do in SA (5 hrs): reasons for location of settlements (climate, vegetation, natural features, laws past and present, resources, human activities such as mining, fishing and trade); concepts of rural and urban; why people move from rural to urban areas. People around the world (4 hrs): population distribution map of the world; influence of climate, water and mineral resources on global settlement; major cities and their population sizes; case study of a major city (reasons for location). Approx. 15 hours.',
    basis: ref(
      'Section 3.1, Intermediate Phase Geography: Outline of what is to be taught (pp. 21-32)',
    ),
  },
];

export const CAPS_SS_IP_METADATA = {
  documentId: CAPS_SS_IP_DOC_ID,
  documentVersion: CAPS_SS_IP_VERSION,
  title: 'Social Sciences Intermediate Phase Grades 4-6',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0489-3',
  phase: 'Intermediate Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
