import React, { useRef, useCallback } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}

export const StepperInput: React.FC<Props> = ({ value, onChange, min, max }) => {
  const timerRef = useRef<number>(0);
  const stepRef = useRef(1);

  const startRepeat = useCallback((delta: number) => {
    stepRef.current = delta;
    onChange(Math.max(min, Math.min(value + delta, max)));
    const start = Date.now();
    const loop = () => {
      if (Date.now() - start > 400) stepRef.current = delta * 5;
      onChange(Math.max(min, Math.min(parseInt(String(value)) + stepRef.current, max)));
      timerRef.current = window.setTimeout(loop, 500);
    };
    timerRef.current = window.setTimeout(loop, 500);
  }, [value, min, max, onChange]);

  const stopRepeat = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = 0;
  }, []);

  return (
    <div className="stepper-input flex items-center rounded-lg border border-gray-600/50 bg-gray-800/60 overflow-hidden h-8">
      <button
        onMouseDown={() => startRepeat(-1)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        onTouchStart={() => startRepeat(-1)}
        onTouchEnd={stopRepeat}
        className="w-7 h-7 shrink-0 flex items-center justify-center text-gray-400 text-sm select-none"
      >-</button>
      <span className="stepper-divider h-4 shrink-0 bg-gray-600/50" />
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(v, max)));
        }}
        onBlur={() => {
          if (value < min) onChange(min);
          if (value > max) onChange(max);
        }}
        className="flex-1 min-w-0 h-7 text-center bg-transparent text-sm text-white outline-none"
      />
      <span className="stepper-divider h-4 shrink-0 bg-gray-600/50" />
      <button
        onMouseDown={() => startRepeat(1)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        onTouchStart={() => startRepeat(1)}
        onTouchEnd={stopRepeat}
        className="w-7 h-7 shrink-0 flex items-center justify-center text-gray-400 text-sm select-none"
      >+</button>
    </div>
  );
};
