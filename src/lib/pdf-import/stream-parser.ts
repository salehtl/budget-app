/**
 * Incrementally extract complete JSON objects from a streaming JSON array.
 * Tracks brace depth to find object boundaries without parsing partial JSON.
 * Returns the new parse offset.
 */
export function extractStreamedObjects(
  text: string,
  offset: number,
  onObject: (obj: unknown) => void,
): number {
  let i = offset;

  // Skip to first '[' if we haven't started
  if (i === 0) {
    const start = text.indexOf("[");
    if (start === -1) return 0;
    i = start + 1;
  }

  while (i < text.length) {
    // Skip whitespace and commas between objects
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === ",") {
      i++;
      continue;
    }

    // End of array
    if (ch === "]") break;

    // Start of an object
    if (ch === "{") {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let j = i;

      for (; j < text.length; j++) {
        const c = text[j]!;
        if (escaped) { escaped = false; continue; }
        if (c === "\\") { escaped = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === "{") depth++;
        if (c === "}") {
          depth--;
          if (depth === 0) {
            // Found a complete object
            try {
              const obj = JSON.parse(text.slice(i, j + 1));
              onObject(obj);
            } catch {
              // Malformed object, skip it
            }
            i = j + 1;
            break;
          }
        }
      }

      // If we didn't close the object, stop — need more data
      if (depth > 0) break;
    } else {
      i++;
    }
  }

  return i;
}
