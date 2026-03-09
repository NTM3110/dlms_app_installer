import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DlmsService {
    private apiUrl = '/api';

    constructor(private http: HttpClient) { }

    // Serial Settings
    getAvailablePorts(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/serial/ports`);
    }

    getSerialSettings(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/serial`);
    }

    addSerialSetting(settings: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/serial`, settings);
    }

    updateSerialSetting(id: number, settings: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/serial/${id}`, settings);
    }

    deleteSerialSetting(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/serial/${id}`);
    }

    // Meter Configs
    getMeters(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/meters`);
    }

    addMeter(meter: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/meters`, meter);
    }

    updateMeter(id: number, meter: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/meters/${id}`, meter);
    }

    deleteMeter(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/meters/${id}`);
    }

    // Auto Read Schedule
    getAutoReadSchedule(): Observable<any> {
        return this.http.get(`${this.apiUrl}/schedule`);
    }

    updateAutoReadSchedule(schedule: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/schedule`, schedule);
    }

    getCsvStoragePath(): Observable<{ path: string }> {
        return this.http.get<{ path: string }>(`${this.apiUrl}/settings/csv-path`);
    }

    updateCsvStoragePath(newPath: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/settings/csv-path`, null, { params: { new_path: newPath } });
    }

    // Data endpoints
    getInstantaneousData(measurementPoint: string): Observable<any> {
        let params = new HttpParams().set('measurement_point', measurementPoint);
        return this.http.get(`${this.apiUrl}/data/instantaneous`, { params });
    }

    getProfileData(
        measurementPoint: string,
        targetDate: string,
        startTime: string = '00:00',
        endTime: string = '23:30',
        csvSavePath: string = ''
    ): Observable<any> {
        let params = new HttpParams()
            .set('measurement_point', measurementPoint)
            .set('target_date', targetDate)
            .set('start_time', startTime)
            .set('end_time', endTime);
        if (csvSavePath && csvSavePath.trim()) {
            params = params.set('csv_save_path', csvSavePath.trim());
        }
        return this.http.get(`${this.apiUrl}/data/profile`, { params });
    }

    exportProfileCsv(
        measurementPoint: string,
        targetDate: string,
        startTime: string = '00:00',
        endTime: string = '23:30',
        csvSavePath: string = ''
    ): Observable<Blob> {
        let params = new HttpParams()
            .set('measurement_point', measurementPoint)
            .set('target_date', targetDate)
            .set('start_time', startTime)
            .set('end_time', endTime)
            .set('export_csv', 'True');
        if (csvSavePath && csvSavePath.trim()) {
            params = params.set('csv_save_path', csvSavePath.trim());
        }
        return this.http.get(`${this.apiUrl}/data/profile`, { params, responseType: 'blob' });
    }

    getMissingDataReport(
        measurementPoints: string[],
        targetDate: string,
        startTime: string = '00:00',
        endTime: string = '23:30',
        csvPath: string = ''
    ): Observable<any> {
        let params = new HttpParams()
            .set('target_date', targetDate)
            .set('start_time', startTime)
            .set('end_time', endTime);
        measurementPoints.forEach(mp => {
            params = params.append('measurement_points', mp);
        });
        if (csvPath && csvPath.trim()) {
            params = params.set('csv_path', csvPath.trim());
        }
        return this.http.get(`${this.apiUrl}/data/missing-report`, { params });
    }
}
