export type StepStatus = 'done' | 'active' | 'future';

export interface StepDef {
  label: string;
  status: StepStatus;
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L5 9.5L10 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StepperBar({ steps }: { steps: StepDef[] }) {
  return (
    <div className="sg-stepper">
      {steps.map((step, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : undefined }}>
          <div className="sg-step">
            <div className={`sg-step-circle ${step.status}`}>
              {step.status === 'done' ? <CheckMark /> : idx + 1}
            </div>
            <span className={`sg-step-label ${step.status}`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`sg-step-connector ${step.status === 'done' ? 'done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}
