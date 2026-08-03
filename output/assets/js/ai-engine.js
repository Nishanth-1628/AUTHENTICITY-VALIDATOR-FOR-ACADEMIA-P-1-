/* ==========================================================================
   AI Engine (JS port) — same heuristic logic as the original Python
   services/ai_engine.py, reimplemented to run entirely in the browser.
   Classical / explainable methods, not a hosted ML model.
   ========================================================================== */

const REFERENCE_CORPUS = [
  {
    id: "ref-001",
    title: "Introduction to Machine Learning",
    text: "Machine learning is a subfield of artificial intelligence that focuses on building systems capable of learning from data. Rather than being explicitly programmed with rules, these systems identify patterns in training data and use them to make predictions or decisions on new, unseen data. Common approaches include supervised learning, unsupervised learning, and reinforcement learning, each suited to different types of problems and data availability.",
  },
  {
    id: "ref-002",
    title: "Fundamentals of Cybersecurity",
    text: "Cybersecurity refers to the practice of protecting systems, networks, and data from digital attacks. These attacks are usually aimed at accessing, changing, or destroying sensitive information, extorting money from users, or interrupting normal business processes. Effective cybersecurity requires coordinated efforts across information systems, including network security, application security, and endpoint protection.",
  },
  {
    id: "ref-003",
    title: "Principles of Academic Integrity",
    text: "Academic integrity is the commitment to honesty and moral principle in scholarship. It requires that students and researchers properly attribute the ideas and words of others, avoid fabrication or falsification of data, and complete their own original work. Violations of academic integrity, such as plagiarism or ghostwriting, undermine trust in the credibility of academic institutions and the value of earned credentials.",
  },
  {
    id: "ref-004",
    title: "Overview of Cloud Computing",
    text: "Cloud computing is the on-demand delivery of computing resources, including servers, storage, databases, networking, and software, over the internet. Instead of owning physical infrastructure, organizations can rent access to these services from a cloud provider, paying only for what they use. This model offers scalability, flexibility, and reduced operational overhead compared to traditional on-premises infrastructure.",
  },
  {
    id: "ref-005",
    title: "Basics of Natural Language Processing",
    text: "Natural language processing, or NLP, is a branch of artificial intelligence concerned with enabling computers to understand, interpret, and generate human language. NLP combines computational linguistics with statistical and deep-learning models to accomplish tasks such as machine translation, sentiment analysis, text summarization, and question answering.",
  },
];

const ENGLISH_STOP_WORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at",
  "be","because","been","before","being","below","between","both","but","by","can't","cannot","could",
  "couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few","for",
  "from","further","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll","he's",
  "her","here","here's","hers","herself","him","himself","his","how","how's","i","i'd","i'll","i'm",
  "i've","if","in","into","is","isn't","it","it's","its","itself","let's","me","more","most","mustn't",
  "my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours",
  "ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't",
  "so","some","such","than","that","that's","the","their","theirs","them","themselves","then","there",
  "there's","these","they","they'd","they'll","they're","they've","this","those","through","to","too",
  "under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've","were","weren't",
  "what","what's","when","when's","where","where's","which","while","who","who's","whom","why","why's",
  "with","won't","would","wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself",
  "yourselves",
]);

/* ---------------------------------------------------------------------- */
/* Tokenization + TF-IDF (1-2 grams, mirrors sklearn TfidfVectorizer)      */
/* ---------------------------------------------------------------------- */

function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z']+/g) || []).filter(
    (w) => w.length > 1 && !ENGLISH_STOP_WORDS.has(w)
  );
  const grams = [...words];
  for (let i = 0; i < words.length - 1; i++) grams.push(words[i] + " " + words[i + 1]);
  return grams;
}

function tfidfVectors(documents) {
  const docsTokens = documents.map(tokenize);
  const vocab = new Map();
  docsTokens.forEach((tokens) => {
    new Set(tokens).forEach((t) => {
      if (!vocab.has(t)) vocab.set(t, vocab.size);
    });
  });

  const df = new Array(vocab.size).fill(0);
  docsTokens.forEach((tokens) => {
    new Set(tokens).forEach((t) => df[vocab.get(t)]++);
  });

  const n = documents.length;
  return docsTokens.map((tokens) => {
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    const vec = new Float64Array(vocab.size);
    tf.forEach((count, term) => {
      const idx = vocab.get(term);
      const idf = Math.log((1 + n) / (1 + df[idx])) + 1;
      vec[idx] = count * idf;
    });
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  });
}

function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/* ---------------------------------------------------------------------- */
/* Plagiarism / similarity detection                                       */
/* ---------------------------------------------------------------------- */

function checkPlagiarism(text) {
  if (!text || text.trim().length < 30) {
    return { plagiarism_percentage: 0.0, matches: [] };
  }

  const corpusTexts = REFERENCE_CORPUS.map((d) => d.text);
  const corpusLabels = REFERENCE_CORPUS.map((d) => d.title);

  const documents = [text, ...corpusTexts];
  const vectors = tfidfVectors(documents);
  const target = vectors[0];
  const similarities = vectors.slice(1).map((v) => cosineSim(target, v));

  const matches = [];
  corpusLabels.forEach((label, i) => {
    if (similarities[i] > 0.15) {
      matches.push({ source: label, similarity: Math.round(similarities[i] * 100 * 100) / 100 });
    }
  });
  matches.sort((a, b) => b.similarity - a.similarity);

  const overall = similarities.length ? Math.round(Math.max(...similarities) * 100 * 100) / 100 : 0.0;
  return { plagiarism_percentage: overall, matches: matches.slice(0, 5) };
}

/* ---------------------------------------------------------------------- */
/* AI-generated content heuristic                                          */
/* ---------------------------------------------------------------------- */

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function pstdev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function detectAiContent(text) {
  let sentences = text.trim().split(/(?<=[.!?])\s+/);
  sentences = sentences.filter((s) => s.split(/\s+/).filter(Boolean).length > 2);

  if (sentences.length < 3) {
    return { ai_content_percentage: 0.0, confidence: "low", signals: {} };
  }

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const meanLen = mean(lengths);
  const stdevLen = lengths.length > 1 ? pstdev(lengths) : 0;
  const burstiness = meanLen ? stdevLen / meanLen : 0;

  const words = (text.toLowerCase().match(/[a-z']+/g) || []);
  const ttr = words.length ? new Set(words).size / words.length : 0;

  const transitionPhrases = [
    "furthermore", "moreover", "in conclusion", "it is important to note",
    "overall", "in summary", "additionally", "on the other hand",
    "in today's world", "plays a crucial role", "delve into",
  ];
  const lower = text.toLowerCase();
  const phraseHits = transitionPhrases.reduce(
    (sum, p) => sum + (lower.split(p).length - 1), 0
  );
  const phraseDensity = phraseHits / Math.max(sentences.length, 1);

  const burstinessScore = clamp01(1 - burstiness / 0.6);
  const diversityScore = clamp01(1 - ttr / 0.55);
  const phraseScore = clamp01(phraseDensity / 0.3);

  const aiScore = 0.45 * burstinessScore + 0.35 * diversityScore + 0.2 * phraseScore;
  const aiPercentage = Math.round(aiScore * 100 * 100) / 100;

  const confidence = sentences.length >= 15 ? "high" : sentences.length >= 6 ? "medium" : "low";

  return {
    ai_content_percentage: aiPercentage,
    confidence,
    signals: {
      sentence_length_burstiness: Math.round(burstiness * 1000) / 1000,
      lexical_diversity_ttr: Math.round(ttr * 1000) / 1000,
      transition_phrase_density: Math.round(phraseDensity * 1000) / 1000,
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Citation verification                                                   */
/* ---------------------------------------------------------------------- */

const CITATION_PATTERNS = [
  /\[\d+\]/g,
  /\([A-Z][a-zA-Z-]+,?\s+\d{4}\)/g,
  /[A-Z][a-zA-Z-]+\s+et al\.,?\s+\d{4}/g,
  /[A-Z][a-zA-Z-]+\s+\(\d{4}\)/g,
];

function verifyCitations(text) {
  let totalCitations = 0;
  const foundExamples = [];
  CITATION_PATTERNS.forEach((pattern) => {
    const found = text.match(pattern) || [];
    totalCitations += found.length;
    foundExamples.push(...found.slice(0, 3));
  });

  const hasReferenceSection = /\b(references|bibliography|works cited)\b/i.test(text);
  const wordCount = Math.max((text.match(/\S+/g) || []).length, 1);
  const citationDensity = totalCitations / (wordCount / 250);

  let accuracy = 0.0;
  if (totalCitations > 0) {
    const densityScore = Math.min(1.0, citationDensity / 2.0);
    const sectionScore = hasReferenceSection ? 1.0 : 0.4;
    accuracy = Math.round((densityScore * 0.6 + sectionScore * 0.4) * 100 * 100) / 100;
  }

  return {
    citation_accuracy: accuracy,
    total_citations_found: totalCitations,
    has_reference_section: hasReferenceSection,
    examples: foundExamples.slice(0, 5),
  };
}

/* ---------------------------------------------------------------------- */
/* Grammar analysis (rule-based heuristic)                                 */
/* ---------------------------------------------------------------------- */

const COMMON_ERROR_PATTERNS = [
  { pattern: /\bi\s/g, label: "Lowercase standalone 'i' should be capitalized" },
  { pattern: /\s{2,}/g, label: "Multiple consecutive spaces" },
  { pattern: /\b(a)\s+[aeiouAEIOU]/g, label: "Possible article error ('a' before vowel sound)" },
  { pattern: /[a-z]\.[A-Z]/g, label: "Missing space after period" },
];

function analyzeGrammar(text) {
  if (!text.trim()) {
    return { grammar_score: 0.0, issues_found: 0, details: [] };
  }

  const issues = [];
  COMMON_ERROR_PATTERNS.forEach(({ pattern, label }) => {
    const matches = text.match(pattern) || [];
    if (matches.length) issues.push({ issue: label, occurrences: matches.length });
  });

  const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text.match(/[a-zA-Z']+/g) || [];

  const avgSentenceLen = words.length / Math.max(sentences.length, 1);
  const avgWordLen = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;

  let readabilityPenalty = 0;
  if (avgSentenceLen > 35) readabilityPenalty += 15;
  if (avgSentenceLen < 4) readabilityPenalty += 10;

  const issuePenalty = issues.reduce((s, i) => s + i.occurrences, 0) * 2;
  const score = Math.max(0.0, 100 - readabilityPenalty - issuePenalty);

  return {
    grammar_score: Math.round(score * 100) / 100,
    issues_found: issues.reduce((s, i) => s + i.occurrences, 0),
    avg_sentence_length: Math.round(avgSentenceLen * 100) / 100,
    avg_word_length: Math.round(avgWordLen * 100) / 100,
    details: issues,
  };
}

/* ---------------------------------------------------------------------- */
/* Authenticity score aggregation                                          */
/* ---------------------------------------------------------------------- */

function computeAuthenticityScore(plagiarismPct, aiContentPct, citationAccuracy, grammarScore) {
  const originality = 100 - plagiarismPct;
  const humanLikeness = 100 - aiContentPct;

  let score =
    originality * 0.35 + humanLikeness * 0.3 + citationAccuracy * 0.2 + grammarScore * 0.15;
  score = Math.max(0.0, Math.min(100.0, score));

  let verdict;
  if (score >= 80) verdict = "authentic";
  else if (score >= 55) verdict = "suspicious";
  else verdict = "plagiarized";

  return { score: Math.round(score * 100) / 100, verdict };
}

function runFullAnalysis(text) {
  const plagiarism = checkPlagiarism(text);
  const aiDetection = detectAiContent(text);
  const citations = verifyCitations(text);
  const grammar = analyzeGrammar(text);

  const { score, verdict } = computeAuthenticityScore(
    plagiarism.plagiarism_percentage,
    aiDetection.ai_content_percentage,
    citations.citation_accuracy,
    grammar.grammar_score
  );

  return {
    authenticity_score: score,
    verdict,
    plagiarism,
    ai_detection: aiDetection,
    citations,
    grammar,
  };
}

/* ---------------------------------------------------------------------- */
/* Certificate hash verification (client-side equivalent)                  */
/* No real QR decoding without a heavy CV library — this checks a          */
/* text-embedded verification payload instead, e.g. a line in the doc      */
/* reading "AUTHVALIDATOR|cert_id=...|hash=...".                           */
/* ---------------------------------------------------------------------- */

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function computeCertificateHashSync(text) {
  // Simple synchronous fallback hash (djb2) used only if SubtleCrypto is
  // unavailable; sha256Hex above is preferred and used by verifyCertificate.
  let hash = 5381;
  const normalized = text.split(/\s+/).join(" ").toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(16, "0").slice(0, 16);
}

async function verifyCertificate(extractedText) {
  const payloadMatch = extractedText.match(/AUTHVALIDATOR\|[^\s]+/);
  const result = { qr_found: !!payloadMatch, hash_match: false, verdict: "unverified" };

  if (!payloadMatch) {
    result.verdict = "no_qr_found";
    return result;
  }

  try {
    const parts = {};
    payloadMatch[0].split("|").forEach((p) => {
      const [k, v] = p.split("=");
      if (k && v) parts[k] = v;
    });
    const embeddedHash = parts["hash"];
    const remainder = extractedText.replace(payloadMatch[0], "");
    const normalized = remainder.split(/\s+/).join(" ").toLowerCase();
    const currentHash = await sha256Hex(normalized);
    result.hash_match = currentHash === embeddedHash;
    result.verdict = result.hash_match ? "authentic" : "tampered_or_mismatched";
  } catch (e) {
    result.verdict = "malformed_qr";
  }
  return result;
}
