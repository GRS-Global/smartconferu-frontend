import { Globe2 } from "lucide-react";
import * as Flags from "country-flag-icons/react/3x2";

type FlagComponent = (props: { title?: string; className?: string; style?: React.CSSProperties }) => React.ReactElement;
const FLAGS = Flags as unknown as Record<string, FlagComponent | undefined>;

/** Bundled SVG flag for an ISO alpha-2 code; a globe when there is none. */
export function CountryFlag({ code, size = 14 }: { code: string; size?: number }) {
  const Flag = FLAGS[code.toUpperCase()];
  if (!Flag) return <Globe2 size={size} className="inline-block shrink-0 align-middle text-ink-faint" aria-hidden="true" />;
  return <Flag title="" className="inline-block shrink-0 rounded-[2px] align-middle" style={{ width: size * 1.33, height: size }} />;
}
