'use client';

type Props = {
  active: boolean;
};

export function RackChainLink({ active }: Props) {
  return (
    <div className={`mb-chain-link${active ? ' mb-chain-link--live' : ''}`} aria-hidden>
      <span className="mb-chain-link__line" />
      <span className="mb-chain-link__dot" />
      <span className="mb-chain-link__line" />
    </div>
  );
}
