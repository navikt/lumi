import { useEffect, useRef, useState } from "react";
import { useSlide } from "../engine";
import "./SlideVideo.css";

export interface SlideVideoProps {
  /** An H.264 MP4, silent. */
  src: string;
  /** The still shown before it plays, in print, thumbnails and without motion. */
  poster: string;
  /** Size of the video in its own pixels, for the aspect ratio. */
  width: number;
  height: number;
  /** What the video shows, for screen readers. */
  label: string;
  /** Plays from this build step of the slide. Defaults to 0. */
  playFrom?: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A short silent recording on a slide. It plays once from the start when
 * the slide is presented at `playFrom`, holds its last frame, and is reset
 * when the slide is left. Print, thumbnails, the presenter preview and a
 * stage without motion show the poster.
 */
export function SlideVideo({
  src,
  poster,
  width,
  height,
  label,
  playFrom = 0,
  className,
}: SlideVideoProps) {
  const { active, step, mode } = useSlide();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still] = useState(prefersReducedMotion);
  const playing = mode === "stage" && active && step >= playFrom && !still;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.currentTime = 0;
      video.play().catch(() => {
        // A blocked play leaves the poster up, which is still correct.
      });
      return;
    }
    video.pause();
    video.currentTime = 0;
  }, [playing]);

  const classes = ["slide-video", className].filter(Boolean).join(" ");
  if (mode !== "stage" || still) {
    return (
      <img
        className={classes}
        src={poster}
        alt={label}
        width={width}
        height={height}
      />
    );
  }
  return (
    <video
      ref={videoRef}
      className={classes}
      src={src}
      poster={poster}
      width={width}
      height={height}
      aria-label={label}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
    />
  );
}
