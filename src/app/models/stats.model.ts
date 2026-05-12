import { Reparation } from './reparation.model';

export interface StatsTechnicien {
  technicien: string;
  total:      number;
  en_cours:   number;
  terminees:  number;
}

export interface Stats {
  total_reparations:         number;
  total_pieces:              number;
  machines_uniques:          number;
  pieces_les_plus_changees:  { ref: string; designation: string; total: number }[];
  reparations:               Reparation[];
  par_technicien:            StatsTechnicien[];  // ← nouveau
}
