import { cx } from "../engine/css";

export type TagKind = "live" | "screenshot" | "example";

const TEXT: Record<TagKind, string> = {
  live: "Live",
  screenshot: "Skjermbilde med testdata",
  example: "Eksempel",
};

interface TagProps {
  kind: TagKind;
  className?: string;
}

/** Says what the audience is looking at: the real thing, a screenshot or an example. */
export function Tag({ kind, className }: TagProps) {
  return (
    <span className={cx("tag", `tag--${kind}`, className)}>{TEXT[kind]}</span>
  );
}
