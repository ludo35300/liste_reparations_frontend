import { PieceWithModeles } from "./piece.model";

export interface Marque {
  id: number;
  nom: string;
  url_logo?: string | null;
}

export interface MarqueGroup {
  marque: Marque;
  pieces: PieceWithModeles[];
  expanded: boolean;
}
