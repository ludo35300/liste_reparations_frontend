import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Reparation } from '../models/reparation.model';
import { Machine } from '../models/machine.model';

export interface CreateMachinePayload {
  numero_serie: string;
  modele_id: number;
  statut: Machine['statut'];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  public getMachines(): Observable<Machine[]> {
    return this.http.get<Machine[]>(`${this.apiUrl}/machines`);
  }

  public getById(id: number): Observable<Machine> {
    return this.http.get<Machine>(`${this.apiUrl}/machines/${id}`);
  }

  public deleteMachine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/machines/${id}`);
  }

  public getByNumeroSerie(numeroSerie: string): Observable<Machine> {
    return this.http.get<Machine>(
      `${this.apiUrl}/machines/serie/${encodeURIComponent(numeroSerie)}`
    );
  }

  public search(query: string): Observable<Machine[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<Machine[]>(`${this.apiUrl}/machines/search`, { params });
  }

  public create(payload: CreateMachinePayload): Observable<Machine> {
    return this.http.post<Machine>(`${this.apiUrl}/machines`, payload);
  }

  public getHistory(machineId: number): Observable<Reparation[]> {
    return this.http.get<Reparation[]>(`${this.apiUrl}/machines/${machineId}/reparations`);
  }
}
