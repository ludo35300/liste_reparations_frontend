import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { MachineTypeRef, PieceRef } from '../models/reparation.model';

@Injectable({ providedIn: 'root' })
export class ReferenceService {
    private http = inject(HttpClient);
    private api = '/api'; 

    getAllMachines(): Observable<MachineTypeRef[]> {
        return this.http.get<MachineTypeRef[]>(`${this.api}/machines`);
    }

    createMachine(marque: string, modele: string, type_machine: string): Observable<MachineTypeRef> {
        return this.http.post<MachineTypeRef>(`${this.api}/machines`, {
        marque,
        modele,
        type_machine,
        });
    }

    deleteMachine(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/machines/${id}`);
    }

    
    // ── Pièces ─────────────────────────────────────────────────

    getAllPieces(): Observable<PieceRef[]> {
        return this.http.get<PieceRef[]>(`${this.api}/pieces`);
    }

    createPiece(ref_piece: string, designation: string): Observable<PieceRef> {
        return this.http.post<PieceRef>(`${this.api}/pieces`, {
        ref_piece,
        designation,
        });
    }

    deletePiece(id: number): Observable<void> {
        return this.http.delete<void>(`${this.api}/pieces/${id}`);
    }

    // ── Association Machine ↔ Pièce ────────────────────────────

    addPieceToMachine(machineId: number, pieceId: number): Observable<MachineTypeRef> {
        return this.http.post<MachineTypeRef>(
        `${this.api}/machines/${machineId}/pieces/${pieceId}`, {}
        );
    }

    removePieceFromMachine(machineId: number, pieceId: number): Observable<MachineTypeRef> {
        return this.http.delete<MachineTypeRef>(
        `${this.api}/machines/${machineId}/pieces/${pieceId}`
        );
    }

    uploadLogo(machineId: number, file: File): Observable<MachineTypeRef> {
        const formData = new FormData();
        formData.append('logo', file);
        return this.http.patch<MachineTypeRef>(
            `${this.api}/machines/${machineId}/logo`,
            formData
        );
    }
    getPiecesByMachine(machineId: number): Observable<PieceRef[]> {
        return this.http.get<PieceRef[]>(`${this.api}/machines/${machineId}/pieces`);
    }

    getMachineByLabel(label: string): Observable<MachineTypeRef | undefined> {
        return this.getAllMachines().pipe(
            map(machines => machines.find(
            m => m.label.toUpperCase() === label.trim().toUpperCase()
            ))
        );
    }
}