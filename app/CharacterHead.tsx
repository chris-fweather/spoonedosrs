import type {HeadPortrait} from '@/lib/head-portrait';

/** A character's head: the plain portrait, or the pre-drawn layers of the head with its worn helmet or hat
 * (lib/head-portrait.ts), framed with the chin at the bottom like the plain portrait. Static images only. */
export function CharacterHead({portrait, head, className}: {portrait: string; head?: HeadPortrait | null; className?: string}) {
  if (!head) return <img className={className} src={portrait} alt=""/>;
  return <svg className={className} viewBox={head.frame.join(' ')} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
    {head.layers.map(layer => <image key={layer.src} href={layer.src} x={layer.box[0]} y={layer.box[1]} width={layer.box[2]} height={layer.box[3]} preserveAspectRatio="none"/>)}
  </svg>;
}
