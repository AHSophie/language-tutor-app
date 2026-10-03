export interface VocabularyItem {
  id: string;
  spanish: string;
  english: string;
  category: 'Greetings' | 'Food' | 'Numbers' | 'Colors' | 'Places' | 'Animals';
  phoneticHint?: string;
}

export const VOCABULARY: VocabularyItem[] = [
  // Greetings
  {
    id: 'hola',
    spanish: 'hola',
    english: 'hello',
    category: 'Greetings',
    phoneticHint: 'OH-lah',
  },
  {
    id: 'gracias',
    spanish: 'gracias',
    english: 'thank you',
    category: 'Greetings',
    phoneticHint: 'GRAH-syahs',
  },
  {
    id: 'por-favor',
    spanish: 'por favor',
    english: 'please',
    category: 'Greetings',
    phoneticHint: 'por fah-VOR',
  },
  {
    id: 'buenos-dias',
    spanish: 'buenos días',
    english: 'good morning',
    category: 'Greetings',
    phoneticHint: 'BWEH-nohs DEE-ahs',
  },
  {
    id: 'como-estas',
    spanish: '¿Cómo estás?',
    english: 'How are you?',
    category: 'Greetings',
    phoneticHint: 'KOH-moh ehs-TAHS',
  },
  {
    id: 'buenas-noches',
    spanish: 'buenas noches',
    english: 'good night',
    category: 'Greetings',
    phoneticHint: 'BWEH-nahs NOH-chehs',
  },

  // Food
  {
    id: 'agua',
    spanish: 'agua',
    english: 'water',
    category: 'Food',
    phoneticHint: 'AH-gwah',
  },
  {
    id: 'pan',
    spanish: 'pan',
    english: 'bread',
    category: 'Food',
    phoneticHint: 'pahn',
  },
  {
    id: 'manzana',
    spanish: 'manzana',
    english: 'apple',
    category: 'Food',
    phoneticHint: 'mahn-SAH-nah',
  },

  // Animals
  {
    id: 'perro',
    spanish: 'perro',
    english: 'dog',
    category: 'Animals',
    phoneticHint: 'PEH-rroh',
  },
  {
    id: 'gato',
    spanish: 'gato',
    english: 'cat',
    category: 'Animals',
    phoneticHint: 'GAH-toh',
  },

  // Colors
  {
    id: 'rojo',
    spanish: 'rojo',
    english: 'red',
    category: 'Colors',
    phoneticHint: 'ROH-hoh',
  },
  {
    id: 'azul',
    spanish: 'azul',
    english: 'blue',
    category: 'Colors',
    phoneticHint: 'ah-ZOOL',
  },
  {
    id: 'verde',
    spanish: 'verde',
    english: 'green',
    category: 'Colors',
    phoneticHint: 'VEHR-deh',
  },

  // Numbers
  {
    id: 'uno',
    spanish: 'uno',
    english: 'one',
    category: 'Numbers',
    phoneticHint: 'OO-noh',
  },
  {
    id: 'tres',
    spanish: 'tres',
    english: 'three',
    category: 'Numbers',
    phoneticHint: 'trehs',
  },
  {
    id: 'diez',
    spanish: 'diez',
    english: 'ten',
    category: 'Numbers',
    phoneticHint: 'dyehs',
  },

  // Places
  {
    id: 'biblioteca',
    spanish: 'biblioteca',
    english: 'library',
    category: 'Places',
    phoneticHint: 'beeb-lyoh-TEH-kah',
  },
  {
    id: 'casa',
    spanish: 'casa',
    english: 'house',
    category: 'Places',
    phoneticHint: 'KAH-sah',
  },
  {
    id: 'playa',
    spanish: 'playa',
    english: 'beach',
    category: 'Places',
    phoneticHint: 'PLY-ah',
  },
];

export const CATEGORIES = [
  'All Categories',
  'Greetings',
  'Food',
  'Animals',
  'Colors',
  'Numbers',
  'Places',
] as const;
