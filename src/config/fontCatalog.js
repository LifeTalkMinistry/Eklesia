export const FONT_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'popular', label: 'Popular' }),
  Object.freeze({ id: 'modern', label: 'Modern' }),
  Object.freeze({ id: 'readable', label: 'Easy Read' }),
  Object.freeze({ id: 'serif', label: 'Serif' }),
  Object.freeze({ id: 'handwritten', label: 'Handwritten' }),
  Object.freeze({ id: 'display', label: 'Display' }),
]);

function font(id, label, category, description, family = label) {
  return Object.freeze({
    id,
    label,
    category,
    description,
    googleFamily: family,
    family: `"${family}", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  });
}

function systemFont(id, label, category, description, family) {
  return Object.freeze({ id, label, category, description, family });
}

function serifFont(id, label, description, family = label) {
  return Object.freeze({
    id,
    label,
    category: 'serif',
    description,
    googleFamily: family,
    family: `"${family}", Georgia, "Times New Roman", serif`,
  });
}

function scriptFont(id, label, description, family = label) {
  return Object.freeze({
    id,
    label,
    category: 'handwritten',
    description,
    googleFamily: family,
    family: `"${family}", "Segoe Print", "Bradley Hand", cursive`,
  });
}

function displayFont(id, label, description, family = label) {
  return Object.freeze({
    id,
    label,
    category: 'display',
    description,
    googleFamily: family,
    family: `"${family}", Impact, "Arial Narrow", sans-serif`,
  });
}

export const FONT_OPTIONS = Object.freeze([
  font('pulse-default', 'Pulse Default', 'popular', 'The original clean Ekklesia Pulse style.', 'Inter'),
  systemFont('arial', 'Arial', 'popular', 'Simple, familiar, and compact.', 'Arial, Helvetica, sans-serif'),
  systemFont('verdana', 'Verdana', 'popular', 'Wide letterforms that are comfortable on small screens.', 'Verdana, Geneva, sans-serif'),
  systemFont('trebuchet', 'Trebuchet', 'popular', 'Friendly and easy to scan.', '"Trebuchet MS", "Segoe UI", sans-serif'),
  font('roboto', 'Roboto', 'popular', 'Familiar, balanced, and dependable.'),
  font('open-sans', 'Open Sans', 'popular', 'Open letterforms for comfortable reading.'),
  font('lato', 'Lato', 'popular', 'Warm, professional, and highly versatile.'),
  font('montserrat', 'Montserrat', 'popular', 'Bold geometric shapes with a polished feel.'),
  font('poppins', 'Poppins', 'popular', 'Friendly, rounded, and modern.'),
  font('nunito', 'Nunito', 'popular', 'Soft rounded letters with a welcoming tone.'),
  font('raleway', 'Raleway', 'popular', 'Elegant and clean with distinctive details.'),
  font('ubuntu', 'Ubuntu', 'popular', 'Human, contemporary, and easy to recognize.'),
  font('work-sans', 'Work Sans', 'popular', 'Practical and clear across many screen sizes.'),
  font('dm-sans', 'DM Sans', 'popular', 'Smooth, minimal, and product-friendly.'),
  font('source-sans-3', 'Source Sans 3', 'popular', 'Clear interface typography with excellent spacing.'),

  font('manrope', 'Manrope', 'modern', 'Crisp geometry with a premium digital feel.'),
  font('rubik', 'Rubik', 'modern', 'Rounded corners with a confident personality.'),
  font('quicksand', 'Quicksand', 'modern', 'Light, friendly, and gently rounded.'),
  font('mulish', 'Mulish', 'modern', 'Minimal and airy for modern interfaces.'),
  font('cabin', 'Cabin', 'modern', 'Humanist shapes with a calm, natural rhythm.'),
  font('karla', 'Karla', 'modern', 'Clean, direct, and slightly expressive.'),
  font('outfit', 'Outfit', 'modern', 'Geometric and stylish without feeling heavy.'),
  font('figtree', 'Figtree', 'modern', 'Friendly proportions designed for digital products.'),
  font('plus-jakarta-sans', 'Plus Jakarta Sans', 'modern', 'Contemporary, polished, and highly readable.'),
  font('space-grotesk', 'Space Grotesk', 'modern', 'Technical character with strong visual personality.'),
  font('urbanist', 'Urbanist', 'modern', 'Modern geometry with a smooth reading flow.'),
  font('barlow', 'Barlow', 'modern', 'Slightly condensed with an approachable tone.'),

  font('atkinson-hyperlegible', 'Atkinson Hyperlegible', 'readable', 'Distinct letter shapes designed for easier recognition.'),
  font('lexend', 'Lexend', 'readable', 'Generous spacing created for reading comfort.'),
  font('noto-sans', 'Noto Sans', 'readable', 'Neutral, dependable, and language-friendly.'),
  font('readex-pro', 'Readex Pro', 'readable', 'Open shapes and spacing for smooth reading.'),
  font('public-sans', 'Public Sans', 'readable', 'Straightforward and clear for information-heavy screens.'),
  font('inclusive-sans', 'Inclusive Sans', 'readable', 'Open, friendly letterforms designed for clarity.'),
  font('ibm-plex-sans', 'IBM Plex Sans', 'readable', 'Structured and precise while remaining approachable.'),
  font('albert-sans', 'Albert Sans', 'readable', 'Simple geometry with clear forms at small sizes.'),
  font('assistant', 'Assistant', 'readable', 'Compact, clean, and easy to scan.'),
  font('hind', 'Hind', 'readable', 'Tall, open characters suited to longer reading.'),

  systemFont('georgia', 'Georgia', 'serif', 'A reflective, book-like reading style.', 'Georgia, "Times New Roman", serif'),
  systemFont('times', 'Times New Roman', 'serif', 'A traditional printed-page style.', '"Times New Roman", Times, serif'),
  serifFont('merriweather', 'Merriweather', 'A sturdy book-like font for Scripture and devotionals.'),
  serifFont('lora', 'Lora', 'Reflective and contemporary with gentle curves.'),
  serifFont('playfair-display', 'Playfair Display', 'Elegant contrast for a refined editorial feel.'),
  serifFont('libre-baskerville', 'Libre Baskerville', 'Classic printed-book character with screen readability.'),
  serifFont('crimson-text', 'Crimson Text', 'Traditional literary style for thoughtful reading.'),
  serifFont('cormorant-garamond', 'Cormorant Garamond', 'Graceful, artistic, and highly distinctive.'),
  serifFont('eb-garamond', 'EB Garamond', 'Historic book typography with a timeless voice.'),
  serifFont('bitter', 'Bitter', 'Strong slab details that remain clear on screens.'),
  serifFont('vollkorn', 'Vollkorn', 'Warm, substantial, and comfortable for long passages.'),
  serifFont('spectral', 'Spectral', 'Modern editorial typography with expressive details.'),
  serifFont('source-serif-4', 'Source Serif 4', 'Balanced reading typography for long-form content.'),
  serifFont('alegreya', 'Alegreya', 'Lively literary shapes with natural reading rhythm.'),

  scriptFont('caveat', 'Caveat', 'Casual handwriting that feels personal and spontaneous.'),
  scriptFont('dancing-script', 'Dancing Script', 'Lively connected handwriting with friendly movement.'),
  scriptFont('pacifico', 'Pacifico', 'Bold retro script with a cheerful personality.'),
  scriptFont('kalam', 'Kalam', 'Natural handwritten strokes that remain easy to read.'),
  scriptFont('patrick-hand', 'Patrick Hand', 'Simple hand lettering with a warm, human tone.'),
  scriptFont('indie-flower', 'Indie Flower', 'Playful notebook-style handwriting.'),
  scriptFont('sacramento', 'Sacramento', 'Elegant signature-style script for a unique look.'),

  displayFont('bebas-neue', 'Bebas Neue', 'Tall, bold lettering with strong visual impact.'),
  displayFont('oswald', 'Oswald', 'Condensed and confident for a striking interface.'),
  displayFont('anton', 'Anton', 'Heavy display lettering for maximum presence.'),
  displayFont('abril-fatface', 'Abril Fatface', 'Dramatic editorial shapes with strong contrast.'),
  displayFont('cinzel', 'Cinzel', 'Classical Roman-inspired lettering with ceremonial character.'),
  displayFont('lobster', 'Lobster', 'Recognizable retro script with bold personality.'),
  displayFont('fredoka', 'Fredoka', 'Rounded, playful, and highly expressive.'),
]);
