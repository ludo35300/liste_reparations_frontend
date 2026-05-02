import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Marque } from '../models/marque.model';
import { Modele } from '../models/modele.model';
import { PieceRef } from '../models/piece.model';

@Injectable({ providedIn: 'root' })
export class ReferenceService {
  private http = inject(HttpClient);
  private api  = '/api';

  getAllMarques(): Observable<Marque[]> {
    return this.http.get<Marque[]>(`${this.api}/marques`);
  }
  createMarque(nom: string): Observable<Marque> {
    return this.http.post<Marque>(`${this.api}/marques`, { nom });
  }
  deleteMarque(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/marques/${id}`);
  }
  uploadLogoMarque(marqueId: number, file: File): Observable<Marque> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.patch<Marque>(`${this.api}/marques/${marqueId}/logo`, fd);
  }

  getAllModeles(): Observable<Modele[]> {
    return this.http.get<Modele[]>(`${this.api}/modeles`);
  }
  getModelesByMarque(marqueId: number): Observable<Modele[]> {
    return this.http.get<Modele[]>(`${this.api}/marques/${marqueId}/modeles`);
  }
  createModele(marqueId: number, nom: string, type_machine: string): Observable<Modele> {
    return this.http.post<Modele>(`${this.api}/modeles`, {
      marque_id: marqueId, nom, type_machine,
    });
  }
  deleteModele(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/modeles/${id}`);
  }

  getAllPieces(): Observable<PieceRef[]> {
    return this.http.get<PieceRef[]>(`${this.api}/pieces`);
  }
  createPiece(ref_piece: string, designation: string): Observable<PieceRef> {
    return this.http.post<PieceRef>(`${this.api}/pieces`, { ref_piece, designation });
  }
  deletePiece(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/pieces/${id}`);
  }
  getPiecesByModele(modeleId: number): Observable<PieceRef[]> {
    return this.http.get<PieceRef[]>(`${this.api}/modeles/${modeleId}/pieces`);
  }
  addPieceToModele(modeleId: number, pieceId: number): Observable<void> {
    return this.http.post<void>(`${this.api}/modeles/${modeleId}/pieces/${pieceId}`, {});
  }
  removePieceFromModele(modeleId: number, pieceId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/modeles/${modeleId}/pieces/${pieceId}`);
  }

  getModeleByLabel(label: string): Observable<Modele | undefined> {
    return this.getAllModeles().pipe(
      map(list => list.find(
        m => m.label.toUpperCase() === label.trim().toUpperCase()
      ))
    );
  }
  /** @deprecated alias -> getModeleByLabel */
  getMachineByLabel(label: string): Observable<Modele | undefined> {
    return this.getModeleByLabel(label);
  }
  /** @deprecated alias -> addPieceToModele */
  addPieceToMachine(modeleId: number, pieceId: number): Observable<void> {
    return this.addPieceToModele(modeleId, pieceId);
  }

  getAllMachines(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/machines`);
  }
  deleteMachine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/machines/${id}`);
  }
  uploadLogo(machineId: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.patch<any>(`${this.api}/machines/${machineId}/logo`, fd);
  }

  /** @deprecated → getPiecesByModele */
getPiecesByMachine(modeleId: number): Observable<PieceRef[]> {
  return this.getPiecesByModele(modeleId);
}

/** @deprecated → removePieceFromModele */
removePieceFromMachine(modeleId: number, pieceId: number): Observable<void> {
  return this.removePieceFromModele(modeleId, pieceId);
}
}