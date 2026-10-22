import { cx } from "../engine/css";

export type TagKind = "screenshot" | "example";

const TEXT: Record<TagKind, string> = {
  screenshot: "Skjermbilde med testdata",
  example: "Eksempel",
};

interface TagProps {
  kind: TagKind;
  className?: string;
}

/** Says what the audience is looking at: a screenshot or an example. */
export function Tag({ kind, className }: TagProps) {
  return (
    <span className={cx("tag", `tag--${kind}`, className)}>{TEXT[kind]}</span>
  );
}
