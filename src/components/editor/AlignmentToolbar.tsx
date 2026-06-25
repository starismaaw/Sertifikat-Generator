import type { Perataan } from '../../types';

function AlignLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M4 8h8M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M6 8h8M4 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const OPTIONS: { value: Perataan; label: string; Icon: () => JSX.Element }[] = [
  { value: 'left', label: 'Rata kiri', Icon: AlignLeftIcon },
  { value: 'center', label: 'Rata tengah', Icon: AlignCenterIcon },
  { value: 'right', label: 'Rata kanan', Icon: AlignRightIcon },
];

export function AlignmentToolbar({
  value,
  onChange,
}: {
  value: Perataan;
  onChange: (v: Perataan) => void;
}) {
  return (
    <div className="sg-align-toolbar">
      {OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          className={`sg-align-btn ${value === v ? 'active' : ''}`}
          onClick={() => onChange(v)}
          title={label}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
