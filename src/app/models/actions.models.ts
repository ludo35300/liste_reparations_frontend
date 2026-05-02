import { PieceChangee } from "./reparation.model";
import { StatutMachine } from "./status.model";

export type { StatutMachine };

export interface ReparationAction {
  id?: number;
  reparation_id?: number;
  type: 'diagnostic' | 'demontage' | 'remplacement_piece' | 'nettoyage' | 'test' | 'commentaire' | 'statut';
  titre: string;
  description?: string;
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