const root = String.raw`(?:file://(?:localhost)?/(?:[a-z]:/)?|[a-z]:[\\/]|\\\\(?=[^\\/\s]+[\\/])|~/|/(?:Users|home|root|private|var|tmp|Volumes|mnt|media|opt|etc|srv|workspace|workspaces|run|Library)/)`;
const boundary = String.raw`(?<![\p{L}\p{N}_./\\~:@%+-])`;
const segment = String.raw`[^\s/\\:'"\x60<>()\[\]{},;!?|]`;
const word = String.raw`[^\s/\\.:'"\x60<>()\[\]{},;!?|]`;
const directory = String.raw`(?:${segment}+|${word}+(?:[ \t]+${word}+)+)[\\/]`;
const localPath = new RegExp(
  String.raw`(https?://[^\s<>"'\x60]+)|${boundary}(?:(?<quote>["'\x60])(${root}[^\r\n]*?)\k<quote>|(${root}(?:${directory})*${segment}*))`,
  'giu',
);

function shortPath(path: string): string {
  const name = path.split(/[\\/]/).filter(Boolean).at(-1);
  return name ? '…/' + name + (/[\\/]$/.test(path) ? '/' : '') : '…/';
}

/** Keep a path's final name in the transcript. Chat requests and tool arguments retain their original values. */
export function compactLocalPaths(text: string): string {
  return text.replace(localPath, (_, url: string | undefined, quote: string, quoted: string | undefined, bare = '') => {
    if (url) return url;
    if (quoted) return quote + shortPath(quoted) + quote;
    const path = bare.replace(/\.+$/, '');
    return shortPath(path) + bare.slice(path.length);
  });
}
