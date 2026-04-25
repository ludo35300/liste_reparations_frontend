import { Machine, PieceChangee } from "./reparation.model";

export type StatutMachine =
  | 'en_attente'
  | 'diagnostic'
  | 'devis'
  | 'en_reparation'
  | 'test'
  | 'pret'
  | 'livree'
  | 'terminee';

export interface ReparationAction {
  id?: number;
  reparation_id?: number;
  type: 'diagnostic' | 'demontage' | 'remplacement_piece' | 'nettoyage' | 'test' | 'commentaire' | 'statut';
  titre: string;
  विवरण?: string;
  technicien?: string;
  technicien_id?: number;
  date_action: string;
  duree_minutes?: number;
  statut_avant?: StatutMachine;
  statut_apres?: StatutMachine;
  pieces?: PieceChangee[];
}

export interface ReparationCloture {
  date_fin: string;
  resultat: 'reparee' | 'non_reparable' | 'attente_piece' | 'restitution';
  test_ok: boolean;
  commentaire_fin?: string;
}

export interface Reparation {
  id?: number;
  machine_id?: number;
  machine?: Machine;
  machine_snapshot?: string;
  technicien_snapshot?: string;
  numero_serie?: string;
  machine_type?: string;
  notes?: string;
  technicien?: string;
  technicien_id?: number;
  date_reparation: string;
  description?: string;
  created_at?: string;
  statut?: StatutMachine;
  date_fin?: string | null;
  actions?: ReparationAction[];
  pieces: PieceChangee[];
}