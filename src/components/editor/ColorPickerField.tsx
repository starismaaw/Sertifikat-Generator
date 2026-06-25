import { useState } from 'react';

const QUICK_SWATCHES = ['#000000', '#0075de', '#213183', '#d97706', '#15803d', '#78350f'];

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

export function ColorPickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);

  function handleHexChange(raw: string) {
    setHexInput(raw);
    const normalized = raw.startsWith('#') ? raw : '#' + raw;
    if (isValidHex(normalized)) onChange(normalized);
  }

  function handleSwatch(color: string) {
    setHexInput(color);
    onChange(color);
  }

  // Keep hex input synced when parent changes value
  if (value !== hexInput && isValidHex(value)) {
    setHexInput(value);
  }

  return (
    <div className="sg-color-picker">
      <div className="sg-color-preview-row">
        <input
          type="color"
          className="sg-color-swatch-current"
          value={isValidHex(value) ? value : '#000000'}
          onChange={e => { setHexInput(e.target.value); onChange(e.target.value); }}
          title="Pilih warna"
          style={{ cursor: 'pointer', padding: 2 }}
        />
        <input
          type="text"
          className="sg-color-hex-input"
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          maxLength={7}
          placeholder="#000000"
        />
      </div>
      <div className="sg-color-swatches">
        {QUICK_SWATCHES.map(color => (
          <button
            key={color}
            className={`sg-color-swatch ${value === color ? 'active' : ''}`}
            style={{ background: color }}
            onClick={() => handleSwatch(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
