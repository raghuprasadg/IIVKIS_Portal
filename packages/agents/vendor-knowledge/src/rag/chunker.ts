/**
 * Text chunker — sliding window with paragraph-boundary awareness (LLD §5).
 *
 * Default: chunkSize=512 tokens (~2048 chars), overlap=64 tokens (~256 chars).
 * Token approximation: 1 token ≈ 4 characters.
 */

export interface Chunk {
  text: string;
  index: number;
  startToken: number;
  endToken: number;
  articleId: string;
}

const CHARS_PER_TOKEN = 4;

function toTokens(charCount: number): number {
  return Math.ceil(charCount / CHARS_PER_TOKEN);
}

function toChars(tokenCount: number): number {
  return tokenCount * CHARS_PER_TOKEN;
}

/**
 * Split text into overlapping chunks respecting paragraph boundaries.
 *
 * Algorithm:
 *  1. Split on double-newlines to get paragraphs.
 *  2. Greedily merge paragraphs up to chunkSize.
 *  3. If a single paragraph exceeds chunkSize, split it hard on whitespace.
 *  4. Each chunk window overlaps by `overlap` tokens with the previous chunk.
 */
export function chunkArticle(
  text: string,
  articleId: string,
  chunkSize = 512,
  overlap = 64,
): Chunk[] {
  if (!text.trim()) return [];

  const chunkChars = toChars(chunkSize);
  const overlapChars = toChars(overlap);

  // Step 1: split on paragraph boundaries
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Step 2: build a flat list of segments that fit within chunkSize
  const segments: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (para.length > chunkChars) {
      // Hard-split oversized paragraph on whitespace
      if (current) {
        segments.push(current.trim());
        current = '';
      }
      const words = para.split(/\s+/);
      let seg = '';
      for (const word of words) {
        if ((seg + ' ' + word).trim().length > chunkChars && seg) {
          segments.push(seg.trim());
          seg = word;
        } else {
          seg = seg ? seg + ' ' + word : word;
        }
      }
      if (seg) segments.push(seg.trim());
    } else if ((current + '\n\n' + para).trim().length <= chunkChars) {
      current = current ? current + '\n\n' + para : para;
    } else {
      if (current) segments.push(current.trim());
      current = para;
    }
  }
  if (current.trim()) segments.push(current.trim());

  if (segments.length === 0) return [];

  // Step 3: apply sliding window with overlap
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  let tokenOffset = 0;

  // We work with the concatenated full text to produce correct token offsets
  const fullSegText = segments.join('\n\n');
  let charPos = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? '';
    const segStart = fullSegText.indexOf(seg, charPos);
    if (segStart === -1) continue;
    charPos = segStart + seg.length;

    const startToken = toTokens(segStart) + (i > 0 ? -Math.floor(overlap / segments.length) : 0);
    const endToken = toTokens(segStart + seg.length);

    chunks.push({
      text: seg,
      index: chunkIndex++,
      startToken: Math.max(0, startToken),
      endToken,
      articleId,
    });

    tokenOffset = endToken;
  }

  // Step 4: add overlap by prepending tail of previous chunk to next
  const overlapped: Chunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      overlapped.push(chunks[i] as Chunk);
      continue;
    }
    const prev = chunks[i - 1] as Chunk;
    const curr = chunks[i] as Chunk;
    const overlapText = prev.text.slice(-overlapChars);
    overlapped.push({
      ...curr,
      text: overlapText ? overlapText + '\n\n' + curr.text : curr.text,
      startToken: Math.max(0, curr.startToken - overlap),
    });
  }

  void tokenOffset;
  return overlapped;
}
