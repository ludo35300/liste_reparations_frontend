export interface PieceRef {
  id: number;
  ref_piece: string;
  designation: string;
  marque_id?: number;
}

export interface PieceChangee {
  id?: number;
  piece_ref_id?: number;
  ref_piece: string;
  designation: string;
  quantite: number;
  is_new?: boolean;
}