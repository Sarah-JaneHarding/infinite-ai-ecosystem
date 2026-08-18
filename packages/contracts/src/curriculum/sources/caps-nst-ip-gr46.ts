// Derived structure from Natural Sciences and Technology Intermediate Phase Grades 4-6.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 2 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_NST_IP_DOC_ID = 'caps-nst-ip-gr46-2011' as const;
export const CAPS_NST_IP_VERSION = '2011-final-draft' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_NST_IP_DOC_ID,
    documentVersion: CAPS_NST_IP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_NST_IP_CONTENT_AREAS = [
  'Life and Living',
  'Structures',
  'Matter and Materials',
  'Energy and Change',
  'Earth and Beyond',
] as const;
export type CapsnstipContentArea = (typeof CAPS_NST_IP_CONTENT_AREAS)[number];

export interface CapsnstipTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_NST_IP_TOPIC_PROGRESSIONS: readonly CapsnstipTopicProgression[] = [
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Living and non-living things',
    grade: '4',
    description:
      'Identify living and non-living things. Living things carry out seven life processes: feeding, growth, reproduction, breathing, excretion, sensitivity, movement. Some things appear dead but will come alive given right conditions (dried yeast, dried beans, fertilised egg). Skills: observing differences, sorting, classifying, sketching, oral and written descriptions. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Features of plants and animals',
    grade: '4',
    description:
      'Basic structure of plants: roots, stems, leaves, flowers, fruits, seeds (cannot move about). Animals have: head, tail, body, limbs, sense organs. Identify, label and describe parts of plants and at least one animal; tabulate differences between plants and animals. Skills: classifying/comparing, sketching, oral and written descriptions. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'What do plants need in order to live?',
    grade: '4',
    description:
      'Plants need light, water and air. Seeds need water and warmth to germinate. Plants can be grown from cuttings. Practical (P/D): Learners grow plants from seed and cuttings and observe and record observations over time. Skills: observe, record, measure, oral and written descriptions. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Habitats of plants',
    grade: '4',
    description:
      'Soil, light, water, shelter as habitat requirements. Explain the concept of habitat; give examples of habitats of at least 3 different indigenous plants. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Natural and man-made structures',
    grade: '4',
    description:
      'Identify natural and man-made structures; identify shell and frame structures. Skills: observing differences, sorting, classifying, sketching. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Make an animal shelter (Design and Make)',
    grade: '4',
    description:
      'Animals need a suitable place to feed and shelter. Use given specifications to build a shell structure/feeding apparatus (bird feeder/bird bath) from found material. Skills: designing, sketching, measuring, making. (6 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'What do animals need in order to live?',
    grade: '4',
    description:
      'Animals need a habitat for feeding and shelter (wetlands, grasslands, etc.). Animals have different social patterns to find a mate and look after young (alone, pairs, family groups, troops, prides, colonies). Skills: book research, observing, sorting/classifying, sketching. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Observation/taking care of an animal',
    grade: '4',
    description:
      'Understanding the needs of different animals \u2014 linked to habitat and social pattern. Investigate (observe and write about) how animals live and survive; observe and write about a living animal over time. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Plant and animal rights',
    grade: '4',
    description:
      'Plants, animals and humans have a right to live and to a safe, healthy environment. Case study: discuss human, plant and animal rights; identify organisations that protect plants and animals. (1 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Properties of materials',
    grade: '4',
    description:
      'Properties of natural and man-made materials (ceramics, polymers). Experience and compare materials (wood, plastic, salt, mealie-meal, steel, glass, syrup, paint, water, air). Explore properties: hard, soft, springy, sticky, brittle, wet, dry, runny, stiff, shiny, dull, strong. Skills: observing, sorting, classifying, describing, recording. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Combining and changing materials',
    grade: '4',
    description:
      'Combine materials to make new products; compare properties before and after; use materials for a purpose. At least 2 practical activities (P/L): mix clay and water; mix sand, cement and water (concrete); mix flour and water (play dough); mix Plaster of Paris and water; mix jelly powder and water; mix vinegar and bleach. Skills: following instructions, predicting, measuring, observing differences. (6 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Solids, liquids and gases',
    grade: '4',
    description:
      'Properties of solids, liquids and gases. Teacher demonstrations (P/D): heat a substance to let it melt and solidify; observe differences between solid and liquid forms. Skills: observing, sorting, classifying, describing. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Air and wind',
    grade: '4',
    description:
      'Air is a real substance (gas). Wind is moving air. Energy transfer. Practical activities (P/D or P/L): air in a plastic bag or balloon; close syringe opening and push plunger. Identify machines that use wind energy. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Using wind energy \u2014 design a frame structure',
    grade: '4',
    description:
      'Wind energy can be used to let objects move/fly. Learners use a given problem statement to design a frame structure that uses wind to fly/move; write own words for problem solution; give sketch. Clear criteria given regarding size, found material, type, construction method. (2 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Strengthening of structures',
    grade: '4',
    description:
      'Practical activities (P/L): investigate strengthening techniques \u2014 folding, tubing, triangular webs (strong joints). Identify factors that influence the strength of each solution. (6 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Make a structure (Design, Make and Evaluate)',
    grade: '4',
    description:
      'Model: Learners in class make the structure they designed; evaluate against given criteria using the design brief and constraints. (6 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Sound and musical instruments',
    grade: '4',
    description:
      'Sound is a type of energy. Sound travels through materials. Vibrations can be heard and felt; transfer energy to other things. Quick/slow vibrations give high/low notes. P/L: make objects vibrate (string, ruler, hacksaw blade); listen to clock sound through air/water/solid; change length and tension of vibrating object. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Boxes and tubes; reflection of sound',
    grade: '4',
    description:
      'Boxes and tubes make sound louder; reflection of sound. Book research: how the shape and form of different musical instruments make sound louder. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Sound pollution',
    grade: '4',
    description:
      'Sound pollution by vehicles/machines/factories. Case study: research consequences of ongoing sound pollution on human hearing; research legislation on sound pollution. Link to human rights. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Animals used by man',
    grade: '4',
    description:
      'Animals used by man to carry and move objects. Research/case study: use of animals for transport of goods and draught animals vs modern technologies; impact on environment. Focus on animal rights. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Mechanisms \u2014 wheels, axles and hinges',
    grade: '4',
    description:
      'Mechanisms used by man to move objects: wheels, axles and hinges. Energy transfer. Book research: identify and describe how wheels/axles/hinges are used by people to move objects. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Design a machine to move objects',
    grade: '4',
    description:
      'Learners use a given problem statement to design a machine that can be used to move objects; write own solution; given clear criteria; sketch the machine. (3 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Make a machine (Design, Make and Evaluate)',
    grade: '4',
    description:
      'Model: Learners in class make the machine they designed; evaluate against given criteria. (6 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Our place in space',
    grade: '4',
    description:
      'The universe, galaxies, stars, the solar system, planets, moons \u2014 know and explain concepts and relationships. Different objects shine for different reasons (planets, stars, moons). Skills: interpret information, describe, oral and written descriptions. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Movement of objects in the sky',
    grade: '4',
    description:
      "Sun and stars appear to be moving; movement is the result of the earth's movement. Learners observe apparent movement of the sun and stars and realise this results from earth's rotation. (2 hrs)",
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'The earth and earth materials',
    grade: '4',
    description:
      'The earth is a rocky ball in space. Most of the surface is covered with water (sea). The earth has a layered structure. Different types of rocks. Earth materials: solid rocks, soils, water and gases of the atmosphere. The atmosphere consists mainly of hydrogen, nitrogen, oxygen and carbon dioxide. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Soil',
    grade: '4',
    description:
      'Top soil on surface \u2014 all life depends on it. Soil formed from weathering of rocks. Soil is a mixture of particles (clay, silt, sand). Loamy soil is a mixture of all 3 + humus. P/L: rub stones together to make soil; investigate appearance, smell and texture of different soils. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Properties of different soils',
    grade: '4',
    description:
      'Sandy soil: mainly sand particles, retains very little water. Clay soil: mainly clay, retains water well. Loamy soil: mixture of sand, clay, silt + humus \u2014 fertile, best for plant growth. P/L investigation: do different kinds of soil hold differing amounts of water? Measure and compare. (5 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Earthworms and other animals in the soil',
    grade: '4',
    description:
      'Earthworms live in soil; break down organic matter; droppings enrich soil; burrows aerate soil; mix soil. Learners collect earthworms; observe movement and sense organs; draw and describe; research earthworms and other soil creatures. (5 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Stories from the stars',
    grade: '4',
    description:
      'African farmers used constellations to indicate when to plant. The sun is a star (our nearest star). Teacher reads stories about the sun and stars; invite elderly person/traditional healer to tell stories about planting and stars. (4 hrs)',
    basis: ref('Section 2, Grade 4 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Comparison of materials and fair testing',
    grade: '5',
    description:
      'Properties of solid, liquid, gas: colour, smell, hardness, toughness, flexibility, strength in tension. Designing fair tests \u2014 identify factors that will influence results. At least 2 P/L activities: compare different kinds of plastic bottles for toughness; compare 3 kinds of glue; compare 3 kinds of rulers for flexibility; compare 3 kinds of wood for hardness. Skills: designing fair tests, identifying factors, recording results. (10 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Forces',
    grade: '5',
    description:
      'Forces: push, pull, twist, bend. Effect of different forces on different materials. P/L: design a fair test to determine the effect of push/pull/twist/bend forces on at least 2 materials. Skills: designing fair tests, identifying factors, predicting, recording results. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Materials made for a purpose',
    grade: '5',
    description:
      'Materials used to support a load. Research: learners research different materials designed to support different loads. Skills: observing differences, sorting, classifying, sketching. (2 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Structures and supporting loads \u2014 design',
    grade: '5',
    description:
      'Structures and supporting loads. Learners use a given problem statement to design a structure that will support a load; write own words solution; guided to write a simple design brief and constraints; sketch the structure. Skills: describing, sketching, oral and written descriptions. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Make a structure (Design, Make and Evaluate)',
    grade: '5',
    description:
      'Model: In class make a structure that can support a load using the criteria and design brief; evaluate the structure using the design brief and constraints. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Biodiversity of living things past and present',
    grade: '5',
    description:
      'Different kinds of plants and animals living today; extinct species from the past (millions of years ago); plant and animal fossils. Study at least one plant and one animal; investigate fossils. Skills: sort/classify, compare, oral and written descriptions. (3 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Biodiversity of plants',
    grade: '5',
    description:
      'Different species of plants \u2014 each species has specific size/shape. Differences between species: compare leaves, fruit, stems. Biodiversity of an area measured by counting number of different species. Study variety of plants and the biodiversity of an area. (3 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Medicinal plants',
    grade: '5',
    description:
      'Uses of indigenous plants: medicines, food, dyes. Need to conserve plants and habitats. Research and identify indigenous plants used as medicines/food/dyes. Skills: observing, sorting, classifying, describing, sketching. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Photosynthesis and feeding relationships',
    grade: '5',
    description:
      'Plants make their own food (glucose and starch) in green leaves using air, sunlight, soil/water. Animals do not make their own food; feed on plants and other animals. Explain photosynthesis; explain difference between carnivores, herbivores and omnivores; identify examples. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Food chains',
    grade: '5',
    description:
      'All animals depend on green plants for energy. Food chains always start with green plants (producer). Energy flows from plants through other animals to top carnivores. Explain food chains up to 4 organisms; sequence and construct food chains with familiar organisms. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Life cycles of plants and animals',
    grade: '5',
    description:
      'Animals: sperm and egg, embryo, baby, young animal, adult animal \u2014 fertilisation, pregnancy, birth, growth, maturation. Plants: pollen and egg, seed, seedling, young plant, mature plant, flowers, fruits \u2014 fertilisation, germination, growth, maturation, flowering, pollination, fruiting, seed dispersal. Sequence and name stages/processes of one plant and one animal. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Human and animal senses',
    grade: '5',
    description:
      "The senses help humans and animals to survive. Sense organs stimulated by environment: seeing, hearing, tasting, touching, smelling. Animals need sense organs to find food, mates, protect young, protect themselves. P/L: stimulate different senses practically; describe how an animal's sense organs help it survive. (4 hrs)",
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy concept and types',
    grade: '5',
    description:
      'Concept of energy. Different types: potential, kinetic, light, sound, electric, magnetic. Identify energy resources in given examples; transfer of energy from one type to another. Skills: observing, sorting, classifying, sketching, oral and written descriptions. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy sources',
    grade: '5',
    description:
      "Sun, wind, water, earth's gravitational force, springs, elastic bands, magnets. Renewable and non-renewable sources of energy. Identify energy sources used in examples; energy used to heat/move things and cause phase changes. (4 hrs)",
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Safety \u2014 fire',
    grade: '5',
    description:
      'Fire needs fuel, heat and air (safety triangle). Safety precautions when making fires. Impact of veld fires/building fires on people/environment/economy. Research/case study. (1 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy for heating \u2014 temperature change and phase changes',
    grade: '5',
    description:
      "Energy for heating things: gas, wood, paraffin, coal, sun's energy. Rise in temperature. Phase changes: solid\u2192liquid\u2192gas and gas\u2192liquid\u2192solid. When liquids evaporate they take energy from the environment, leaving surroundings cooler (sweat). Use thermometer to measure temperature. (6 hrs)",
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Water cycle',
    grade: '5',
    description:
      'Evaporation/condensation/precipitation. Energy involved in water cycle. Apply knowledge of evaporation/condensation to explain the water cycle. (2 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy for moving objects',
    grade: '5',
    description:
      "Energy for moving things: fossil fuels, water, earth's gravitational force, springs, elastic bands. Research/case study: machines that use different energy sources. Design a machine that uses gravitational force and/or springs/elastic bands to move; write own solution; design brief and constraints; sketch. (5 hrs)",
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Make a machine using springs/gravity (Design, Make and Evaluate)',
    grade: '5',
    description:
      'Model: In class make the machine using springs/gravity to move; evaluate against design brief and constraints. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Rocks of the earth',
    grade: '5',
    description:
      'Below the surface of the earth there is a great depth of rock; the earth is hot deep down. Explain the build of the earth in simple terms. Skills: oral and written descriptions, sketching. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Igneous rocks',
    grade: '5',
    description:
      'Igneous rock is formed when hot molten rock (magma/lava) is cooled and hardened. Explain how igneous rocks are formed; main properties; name at least one example. Skills: oral and written descriptions, describing, classifying. (4 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Weathering, erosion, deposition',
    grade: '5',
    description:
      'Weathering of rocks \u2014 broken up to become soil. Erosion, deposition, sediment. Practical: hit stones together to make soil (experience how long it takes for soil to form). Explain concepts erosion, deposition, sediment. (3 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Sedimentary rocks',
    grade: '5',
    description:
      'Sedimentary rock formation; some contain fossils. Explain how sedimentary rocks are formed; main properties; name at least one example. P/L: layer different types of material to represent sedimentary rock formation. Skills: describing, classifying, following instructions, measuring. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Fossils',
    grade: '5',
    description:
      'Fossils tell us about plants and animals that lived in SA long ago. Explain what fossils are; how they form; their importance for knowledge of prehistoric life; know about important fossils found in SA. P/L: make a fossil using clay, Plaster of Paris, leaves, shells. Skills: oral and written descriptions, sketching, following instructions. (6 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Metamorphic rocks',
    grade: '5',
    description:
      'Metamorphic rocks formed from igneous and sedimentary rocks under heat and pressure. Explain how metamorphic rocks are formed; main properties; name at least one example. Skills: oral and written descriptions, classifying. (3 hrs)',
    basis: ref('Section 3, Grade 5 NS&T topic tables, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Photosynthesis',
    grade: '6',
    description:
      'Core concepts: Plants and food; plants and air; glucose and starch production in green leaves. | Skills/activities: Explain and illustrate how plants make food (photosynthesis). Compare glucose sugar and starch by taste and colour. Test various foods for presence of starch with iodine solution (rice, flour, potato, bread, oil, boiled egg, cheese). Pre-knowledge: Grade 4 life processes and energy transfer; Grade 5 food chains and life cycles.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Nutrients in food',
    grade: '6',
    description:
      'Core concepts: Food groups: carbohydrates, proteins, fats and oils, vitamins and minerals. | Skills/activities: Classify foods into the different food groups. State reasons why each food group is important. Read labels on food packaging to identify nutrients and additives. Evaluate whether additives make products more or less healthy.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Nutrition and balanced diets',
    grade: '6',
    description:
      'Core concepts: Balanced diets; food-related illnesses (tooth decay, obesity, diabetes, deficiency diseases). | Skills/activities: Evaluate various diets to determine whether they contain all food groups. Explain why different portions of the different food groups are necessary. Discuss diseases caused by an unhealthy diet.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Ecosystems and food webs',
    grade: '6',
    description:
      'Core concepts: Different ecosystems; living and non-living things in ecosystems; food webs. | Skills/activities: Describe different types of ecosystems (rivers, mountains, sea, rocky shores, ponds, wetlands, grasslands, forests, deserts). Identify an ecosystem, describe it and draw the feeding relationships (food webs). Investigate an ecosystem in or near the school grounds using the quadrant method. Study living and non-living things within the ecosystem. Identify possible threats to the ecosystem and possible ways to overcome them. Formal assessment: Practical task/investigation + Test.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Solids, liquids and gases',
    grade: '6',
    description:
      'Core concepts: Arrangement of particles in solids, liquids and gases; three states of matter. | Skills/activities: Draw and explain how particles are arranged in a solid, liquid and gas. Identify the three states of matter in everyday life. Describe solids, liquids and gases in terms of particle arrangement. Pre-knowledge: Grade 4 materials around us, solid materials; Grade 5 processed materials.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Mixtures',
    grade: '6',
    description:
      'Core concepts: Mixtures of materials; ways to combine solids, liquids and gases; ways to separate mixtures. | Skills/activities: Explain and demonstrate different ways to combine solids, liquids and gases to form mixtures. Explain and demonstrate ways to separate mixtures: sieving, filtering, hand-sorting, settling and decanting.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Solutions as special mixtures',
    grade: '6',
    description:
      'Core concepts: Solutions; soluble substances; insoluble substances; saturated solutions. | Skills/activities: Investigate different solids to see whether they dissolve in water (salt, sugar = soluble; sand, mealie meal, flour, samp, curry powder, custard powder = insoluble). Investigate solutions to see whether solute can be recovered by filtering, settling, decanting or evaporation (crystallisation). Investigate and make sugar crystals. Explain different kinds of mixtures (including solutions). Distinguish between soluble and insoluble substances.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Dissolving and rates of dissolving',
    grade: '6',
    description:
      'Core concepts: Rates of dissolving; factors affecting dissolving (temperature, stirring, particle size). | Skills/activities: Investigate the difference between melting and dissolving. Investigate, measure and draw graphs of time taken to dissolve a solute in hot or cold water; when stirring/shaking or not; using coarse or fine salt. State what factors affect the rate of dissolving.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Mixtures and water resources',
    grade: '6',
    description:
      'Core concepts: Water pollution; three categories of pollutants; importance of wetlands; clean water. | Skills/activities: Discuss pollution and where it comes from. Identify three main categories of pollutants found in water and explain how they entered the water. Explain why wetlands are so important. Research different wetlands in South Africa.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Processes to purify water (Design, Make and Evaluate)',
    grade: '6',
    description:
      'Core concepts: Clean water; water purification; design process for processing dirty water. | Skills/activities: Design, make and evaluate a system to process and purify dirty water. Investigate how to best purify dirty water in class and/or at home. Formal assessment: Practical task/investigation + Test.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Electric circuits',
    grade: '6',
    description:
      'Core concepts: A simple circuit; circuit diagrams; symbols for components (cells, light bulbs, buzzers, switches). | Skills/activities: Investigate different ways of making a simple circuit. Investigate, design and make a switch to control the circuit. Investigate and understand how different components function and what symbols represent them. Draw simple closed electrical circuit diagrams using standard symbols. Pre-knowledge: Grade 5 energy and electricity; stored energy in fuels.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Electrical conductors and insulators',
    grade: '6',
    description:
      'Core concepts: Conductors; insulators; use of insulators (rubber gloves, ceramic insulators on power lines). | Skills/activities: Investigate conductors and insulators by testing different materials in an electric circuit (metal paper clips, nails, wire, steel wool, coins, plastic, glass, ceramic, cardboard, paper, wood, rubber, chalk). Record results in a table. Identify where electrical insulators are used in everyday life.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Systems to solve problems (Design, Make and Evaluate)',
    grade: '6',
    description:
      'Core concepts: Using electric circuits in systems; components (cells, light bulbs, buzzers, switches). | Skills/activities: Design, make, evaluate and present a system that uses a circuit to produce movement, light, sound or heat in a structure such as: a steady-hand game, house, lighthouse or toy. The circuit should include components such as cells, light bulbs, buzzers and switches.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Mains electricity \u2014 fossil fuels and renewable energy',
    grade: '6',
    description:
      'Core concepts: Fossil fuels and electricity generation; cost of electricity; renewable energy sources (wind, solar, hydro-electric, biomass, geothermal). | Skills/activities: Explain the steps to make electricity from coal. Use diagrams to trace the flow of electrical energy from an appliance to a coal-fired power station and back to the original source (the Sun). Examine electrical appliance labels to find power requirements and make comparisons. Explain different ways to save electricity. Research and write about renewable ways to generate electricity: wind, solar panels, hydro-electric, biomass and geothermal energy. Formal assessment: Practical task/investigation + Test.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'The Solar System',
    grade: '6',
    description:
      'Core concepts: The Sun, planets and asteroids; moons; size, distance from Sun, temperature, features of planets. | Skills/activities: Research information about the planets focusing on: size, distance from Sun, average temperature, number of moons, atmosphere and other features. Make models of the Solar System (not to scale) showing position relative to the Sun and features of the planets. Describe and draw the objects in our Solar System. Pre-knowledge: Grade 4 planet Earth \u2014 features of Earth, Earth and space, the Sun, the Moon; Grade 5 planet Earth \u2014 the Earth moves.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Movements of the Earth and planets (rotation and revolution)',
    grade: '6',
    description:
      'Core concepts: Rotation (Earth); revolution (Earth); daytime and night-time; seasons. | Skills/activities: Demonstrate the movements (rotation and revolution) of the Earth using models and body movements. Demonstrate how daytime and night-time occur using a model of the Earth and a light source. Draw and write about the rotation of the Earth in relation to the Sun: how daytime and night-time occur.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Movement of the Moon (rotation and revolution)',
    grade: '6',
    description:
      'Core concepts: Rotation (Moon); revolution (Moon); Moon in relation to the Earth and the solar system. | Skills/activities: Demonstrate the rotation and revolution of the Moon around the Earth using models and body movements. Draw and write about the rotation of the Moon in relation to the Earth and the solar system. Draw a comparison table between the Sun, the Earth and the Moon including shape, composition, size, movement in relation to other space objects and the ability to produce light.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Systems for looking into space (Telescopes)',
    grade: '6',
    description:
      'Core concepts: Telescopes; simple telescopes; SALT (Southern African Large Telescope); SKA (Square Kilometre Array). | Skills/activities: Identify the different types of telescopes and how they work. Do a case study about telescopes such as simple telescopes, SALT and SKA.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
  {
    contentArea: 'Earth and Beyond',
    topicCode: null,
    topicName: 'Systems to explore the Moon and Mars (Design, Make and Evaluate)',
    grade: '6',
    description:
      'Core concepts: Vehicles used on the Moon; vehicles used on Mars; Moon and Mars rovers; components, build and systems used for energy and communications. | Skills/activities: Describe the vehicles used to explore the Moon and Mars. Research key features and purposes of Moon and Mars rovers including components, build and systems for energy and communications. Design, make and evaluate a model of one of the vehicles moving with wheels and axles. Measure the distance vehicles can move down a ramp and plot information on a bar graph. Formal assessment: Test.',
    basis: ref('DBE 2023/24 ATP NS&T Grade 6 \u2014 term-by-term topic table, Terms 1-4'),
  },
];

export const CAPS_NST_IP_METADATA = {
  documentId: CAPS_NST_IP_DOC_ID,
  documentVersion: CAPS_NST_IP_VERSION,
  title: 'Natural Sciences and Technology Intermediate Phase Grades 4-6',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Intermediate Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
