import { ReparationAction } from "./actions.model";
import { Machine } from "./machine.model";
import { PieceChangee } from "./piece.model";
import { StatutMachine } from "./statut.model";


export interface Reparation {
  id?: number;
  machine_id?: number;
  machine?: Machine;
  // Snapshots retournés par l'API historique
  machine_snapshot?: string;
  modele?: string;
  technicien_snapshot?: string;
  // Champs formulaire/OCR
  numero_serie?: string;
  machine_type?: string;
  notes?: string;
  // Communs
  technicien?: string;
  technicien_id?: number;
  date_reparation: string;
  description?: string;
  created_at?: string;
  // Feature actions
  statut?: StatutMachine;
  date_fin?: string | null;
  actions?: ReparationAction[];
  pieces: PieceChangee[];
}