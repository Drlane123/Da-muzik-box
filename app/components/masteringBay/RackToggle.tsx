'use client';

type RackToggleProps = {
  label: string;
  active?: boolean;
  led?: boolean;
  onClick?: () => void;
};

export function RackToggle({ label, active = false, led = true, onClick }: RackToggleProps) {
  return (
    <button
      type="button"
      className={`mb-toggle${active ? ' mb-toggle--on' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="mb-toggle__stem" />
      {led && <span className={`mb-toggle__led${active ? ' mb-toggle__led--on' : ''}`} />}
      <span className="mb-toggle__label">{label}</span>
    </button>
  );
}
