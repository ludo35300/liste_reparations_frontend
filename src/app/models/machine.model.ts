import { Modele } from './modele.model';
import { StatutMachine } from './statut.model';

export interface Machine {
  id: number;
  numero_serie: string;
  modele_id?: number | null;
  modele?: Modele | null;
  statut: StatutMachine;
  created_at?: string;
}

export type MachineStatus = 'idle' | 'loading' | 'found' | 'not_found';
