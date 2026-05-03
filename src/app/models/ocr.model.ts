import { PieceChangee } from "./piece.model";

export interface OcrResult {
  technicien:      string;
  date:            string;
  numero_serie:    string;
  machine_type:    string;
  is_new_machine:  boolean;
  modele_id:       number | null;
  marque_id:       number | null;
  pieces:          PieceChangee[];
  nb_pieces_total: number;
  erreur?:         string;
}
