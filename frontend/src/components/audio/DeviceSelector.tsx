import React from 'react';

interface DeviceSelectorProps {
  inputs: { deviceId: string; label: string }[];
  outputs?: { deviceId: string; label: string }[];
  selectedInput: string;
  selectedOutput?: string;
  onInputChange: (deviceId: string) => void;
  onOutputChange?: (deviceId: string) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  inputs, outputs, selectedInput, selectedOutput,
  onInputChange, onOutputChange,
}) => {
  return (
    <div className="flex gap-2">
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <select
          value={selectedInput}
          onChange={(e) => onInputChange(e.target.value)}
          className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all max-w-[130px] truncate"
        >
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
          {inputs.length === 0 && <option value="">无麦克风</option>}
        </select>
      </div>

      {outputs && onOutputChange && (
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <select
            value={selectedOutput}
            onChange={(e) => onOutputChange(e.target.value)}
            className="bg-gray-800/60 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all max-w-[130px] truncate"
          >
            {outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
