import { Modele } from './modele.model';
import { StatutMachine } from './status.model';

export interface Machine {
  id: number;
  numero_serie: string;
  modele_id?: number | null;
  modele?: Modele | null;
  statut: StatutMachine;
  date_entree?: string | null;
  notes?: string;
  created_at?: string;
}