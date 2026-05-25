import { ReparationAction } from "./actions.model";
import { Machine } from "./machine.model";
import { PieceChangee } from "./piece.model";

export type StatutReparation = 'en_reparation' | 'termine';

export interface Reparation {
  id?: number;
  machine_id?: number | null;
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
  statut?: StatutReparation;
  date_fin?: string | null;
  actions?: ReparationAction[];
  pieces: PieceChangee[];
}

export interface RepairManualSubmit {
  numero_serie: string;
  date_reparation: string;
  technicien?: string;
  technicien_id?: number;
  modele_id: number | null;
  machine_type: string;
  notes?: string;
  machine_id?: number | null;
  pieces: PieceChangee[];
}


