'use client';
import type {Pet} from '@/lib/model';
import {acquisitionEffort} from '@/lib/hunt-history';
import {num} from '@/lib/ui';

/** How time to the pet is worked out: hours already spent, or count ÷ pace. */
export function EffortBasis({pet}:{pet:Pet}){
 if(!pet.obtained&&pet.recordedHours==null)return null;
 const estimate=acquisitionEffort(pet);
 return <p className="fine calculation-basis">{estimate.range&&<><b>Estimated range: {num(estimate.range[0])}–{num(estimate.range[1])} h.</b> </>}{estimate.basis}</p>;
}
