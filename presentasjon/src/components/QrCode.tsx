import { useMemo } from "react";
import { encodeQr } from "./qr";

const QUIET_ZONE = 4;

interface QrCodeProps {
  text: string;
  /** Width and height in stage pixels. */
  size: number;
  /** What the code leads to, for screen readers. */
  label: string;
  className?: string;
}

/** Black on white with the standard quiet zone, as phone cameras expect. */
export function QrCode({ text, size, label, className }: QrCodeProps) {
  const { path, total } = useMemo(() => {
    const matrix = encodeQr(text);
    let d = "";
    matrix.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      });
    });
    return { path: d, total: matrix.length + QUIET_ZONE * 2 };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
