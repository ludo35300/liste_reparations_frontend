import { Reparation } from './reparation.model';

export interface Stats {
  total_reparations: number;
  total_pieces:      number;
  machines_uniques:  number;
  pieces_les_plus_changees: { ref: string; designation: string; total: number }[];
  reparations: Reparation[];
}