import {
  type FormEvent,
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { isTextEntry } from "./keyboard";
import "./commentMode.css";

const ENDPOINT = "/__kommentarer";
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
/** Room a card needs below or to the right of where it opens. */
const CARD_ROOM = 360;

interface Comment {
  id: string;
  slideId: string;
  step: number;
  x: number;
  y: number;
  target: string;
  text: string;
  status: "open" | "fixed";
  reply?: string;
}

interface Draft {
  x: number;
  y: number;
  target: string;
}

interface CommentModeProps {
  stageRef: RefObject<HTMLDivElement | null>;
  slideId: string;
  step: number;
}

/** A short description of what was clicked, for whoever fixes it. */
function describe(element: Element | null): string {
  if (!element) return "";
  const slide = element.closest("[data-slide-id]");
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== slide && parts.length < 3) {
    const name = current.tagName.toLowerCase();
    const classes = [...current.classList].slice(0, 2).join(".");
    parts.unshift(classes ? `${name}.${classes}` : name);
    current = current.parentElement;
  }
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  return `${parts.join(" > ")}${text ? ` «${text.slice(0, 80)}»` : ""}`;
}

/**
 * Comment mode for development: K turns it on, a click on the stage leaves
 * a comment on that spot, and the pins show what is open and what is fixed.
 * Only the dev server stores comments, so this is never in the built deck.
 */
export function CommentMode({ stageRef, slideId, step }: CommentModeProps) {
  const [on, setOn] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT);
      if (response.ok) setComments(await response.json());
    } catch {
      // No dev server behind the deck: comment mode stays empty.
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTextEntry(target)) return;
      if (event.key.toLowerCase() === "k") {
        setOn((value) => !value);
        setDraft(null);
        setOpenPin(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!on) return;
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [on, load]);

  useLayoutEffect(() => {
    if (!on) return;
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setRect(stage.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [on, stageRef]);

  if (!on || !rect) return null;
  const scale = rect.width / STAGE_WIDTH;
  const toScreen = (x: number, y: number) => ({
    left: rect.left + x * scale,
    top: rect.top + y * scale,
  });
  /** A card opens away from the window edges, so its buttons stay in view. */
  const cardSide = (x: number, y: number) => {
    const { left, top } = toScreen(x, y);
    return {
      "data-up": top > window.innerHeight - CARD_ROOM ? "" : undefined,
      "data-left": left > window.innerWidth - CARD_ROOM ? "" : undefined,
    };
  };

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    if (x < 0 || y < 0 || x > STAGE_WIDTH || y > STAGE_HEIGHT) return;
    const layer = event.currentTarget;
    layer.style.pointerEvents = "none";
    const under = document.elementFromPoint(event.clientX, event.clientY);
    layer.style.pointerEvents = "";
    setDraft({ x, y, target: describe(under) });
    setText("");
    setOpenPin(null);
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft || !text.trim()) return;
    const room = new URLSearchParams(window.location.search).get("rom");
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        slideId,
        step,
        room,
        style: document.documentElement.dataset.stil ?? null,
        text,
      }),
    });
    setDraft(null);
    setText("");
    load();
  };

  const remove = async (id: string) => {
    await fetch(`${ENDPOINT}/${id}`, { method: "DELETE" });
    setOpenPin(null);
    load();
  };

  const here = comments.filter((comment) => comment.slideId === slideId);
  const openCount = comments.filter((c) => c.status === "open").length;

  return createPortal(
    <div className="comment-mode">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer layer for placing comments, keyboard users use chat */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
      <div className="comment-mode__layer" onClick={onStageClick} />
      <p className="comment-mode__bar">
        Kommentarmodus: klikk der det gjelder. {openCount} åpne. K for å gå ut.
      </p>
      {here.map((comment, index) => {
        const position = toScreen(comment.x, comment.y);
        const otherStep = comment.step !== step;
        return (
          <div
            key={comment.id}
            style={position}
            className="comment-mode__pin-wrap"
          >
            <button
              type="button"
              className="comment-mode__pin"
              data-status={comment.status}
              data-other-step={otherStep ? "" : undefined}
              onClick={() =>
                setOpenPin((current) =>
                  current === comment.id ? null : comment.id,
                )
              }
              aria-label={`Kommentar ${index + 1}`}
            >
              {index + 1}
            </button>
            {openPin === comment.id && (
              <div
                className="comment-mode__card"
                {...cardSide(comment.x, comment.y)}
              >
                <p className="comment-mode__meta">
                  Steg {comment.step}
                  {comment.status === "fixed" ? ", fikset" : ", åpen"}
                </p>
                <p className="comment-mode__text">{comment.text}</p>
                {comment.reply && (
                  <p className="comment-mode__reply">{comment.reply}</p>
                )}
                <button
                  type="button"
                  className="comment-mode__button"
                  onClick={() => remove(comment.id)}
                >
                  Slett
                </button>
              </div>
            )}
          </div>
        );
      })}
      {draft && (
        <form
          className="comment-mode__card comment-mode__draft"
          style={toScreen(draft.x, draft.y)}
          {...cardSide(draft.x, draft.y)}
          onSubmit={save}
        >
          <textarea
            className="comment-mode__input"
            // biome-ignore lint/a11y/noAutofocus: the field opens where the author clicked
            autoFocus
            rows={4}
            value={text}
            placeholder="Hva bør endres her?"
            aria-label="Kommentar"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setDraft(null);
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                save();
              }
            }}
          />
          <div className="comment-mode__actions">
            <button type="submit" className="comment-mode__button">
              Lagre
            </button>
            <button
              type="button"
              className="comment-mode__button"
              onClick={() => setDraft(null)}
            >
              Avbryt
            </button>
          </div>
        </form>
      )}
    </div>,
    document.body,
  );
}
