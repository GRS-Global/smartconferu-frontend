/* Odometer-style number: every digit is a column of 0–9 that rolls up from 0 on first appearance and
   settles on its value, digits landing left to right. Pure CSS (.odo-* in globals.css); screen
   readers get the plain value. */

import type { ReactNode } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const isDigit = (c: string) => c >= "0" && c <= "9";

// Only plain counts roll (digits with optional , . % + − $ ₹ k M around them). Anything else (a date, a name, a node) is shown exactly as given, as in the prototype.
const NUMERIC = /^[\s+\-−$€₹]*\d[\d,.\s]*[%kKmM+]?$/;

export function AnimatedNumber({ value, delay = 0 }: { value: ReactNode; delay?: number }) {
  if (typeof value !== "number" && !(typeof value === "string" && NUMERIC.test(value))) return <>{value}</>;
  const text = String(value);
  const chars = text.split("");
  const digitCount = chars.filter(isDigit).length;
  // Each digit's position among the digits (left = 0), for the landing order.
  const orderOf = chars.map((_, i) => chars.slice(0, i).filter(isDigit).length);
  return (
    <span className="odo">
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => {
        if (!isDigit(c)) return <span key={i} aria-hidden="true" className="odo-char">{c}</span>;
        const wait = delay + orderOf[i] * Math.min(150, 600 / Math.max(1, digitCount));
        return (
          <span key={`${i}-${digitCount}`} aria-hidden="true" className="odo-col">
            <span className="odo-strip" style={{ transform: `translateY(${-Number(c) * 10}%)`, animationDelay: `${wait}ms` }}>
              {DIGITS.map((n) => <span key={n} className="odo-digit">{n}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
