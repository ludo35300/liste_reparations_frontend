import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReparationAction } from '../models/actions.model';

@Injectable({ providedIn: 'root' })
export class ActionsService {
  private readonly http = inject(HttpClient);
  private readonly api  = '/api';

  getActions(reparationId: number): Observable<ReparationAction[]> {
    return this.http.get<ReparationAction[]>(
      `${this.api}/reparations/${reparationId}/actions`
    );
  }

  addAction(reparationId: number, data: Partial<ReparationAction>): Observable<ReparationAction> {
    return this.http.post<ReparationAction>(
      `${this.api}/reparations/${reparationId}/actions`, data
    );
  }

  updateAction(reparationId: number, actionId: number, data: Partial<ReparationAction>): Observable<ReparationAction> {
    return this.http.patch<ReparationAction>(
      `${this.api}/reparations/${reparationId}/actions/${actionId}`, data
    );
  }

  deleteAction(reparationId: number, actionId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/reparations/${reparationId}/actions/${actionId}`
    );
  }
}
