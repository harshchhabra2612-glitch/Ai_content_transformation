import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "../utils/cn";

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    // Auto-focus the first empty slot on mount
    const firstEmpty = digits.findIndex((d) => !d);
    const targetIdx = firstEmpty === -1 ? 5 : firstEmpty;
    inputsRef.current[targetIdx]?.focus();
  }, []);

  const handleChange = (index: number, val: string) => {
    if (disabled) return;
    const digit = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    const nextValue = newDigits.join("").slice(0, 6);
    onChange(nextValue);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (nextValue.length === 6 && onComplete) {
      onComplete(nextValue);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputsRef.current[focusIndex]?.focus();
      if (pasted.length === 6 && onComplete) {
        onComplete(pasted);
      }
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digits[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "h-12 w-11 sm:h-13 sm:w-12 text-center text-xl font-bold font-mono rounded-xl border bg-s2/80 text-ink transition-all duration-150 focus:outline-none select-none",
            error
              ? "border-danger/70 bg-errsoft/30 text-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
              : digits[i]
              ? "border-brand/60 bg-brandsoft/20 text-ink shadow-[0_0_12px_rgba(99,102,241,0.25)]"
              : "border-line hover:border-line2 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}
