import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NavController } from "@ionic/angular";
import { catchError, Observable, tap } from "rxjs";
import { environment } from "src/environments/environment";
import { LoggerService } from "../logger/logger.service";
import { NotifyService } from "../notify/notify.service";
import { Address, Zone as DnsZone, Record } from "./model/object";

@Injectable({
    providedIn: 'root',
})
export class ApiService {
    logType = "[Service]";
    logName = "[Api]";

    private baseURL = "http://localhost:8080/api/";

    constructor(
        private logger: LoggerService,
        private navController: NavController,
        private http: HttpClient,
        private notifyService: NotifyService
    ) {
        this.logger.info(`${this.logType} ${this.logName} constructor`);
        this.buildURL();
    }

    public info(): Observable<boolean> {
        return this.get("info");
    }

    public refreshAddress(): Observable<Address> {
        return this.get("action/refresh/address");
    }

    public address(): Observable<Address> {
        return this.get("object/address");
    }

    public history(): Observable<Address[]> {
        return this.get("object/history");
    }

    public clearHistory(): Observable<any> {
        return this.delete("object/history");
    }

    public refreshRecord(id: number): Observable<Record> {
        return this.get(`action/refresh/record/${id}`);
    }

    public records(): Observable<Record[]> {
        return this.get("object/record");
    }

    public zones(token: string): Observable<DnsZone[]> {
        return this.get(`object/zone/${token}`);
    }

    public createRecord(record: Record): Observable<Record> {
        record.created_at = null
        record.updated_at = null
        return this.post("object/record", record);
    }

    public updateRecord(record: Record): Observable<Record> {
        record.created_at = null
        record.updated_at = null
        return this.put(`object/record`, record);
    }

    public deleteRecord(record: Record): Observable<any> {
        return this.delete(`object/record/${record.id}`);
    }

    public getConfig(): Observable<any> {
        return this.get("object/config");
    }

    public updateConfig(config: any): Observable<any> {
        return this.put("object/config", config);
    }

    public getLog(): Observable<any> {
        return this.get("object/log");
    }

    /**
     * Generic API call methods
     */

    private get(endpoint: string, params?: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} GET request to ${this.baseURL}${endpoint}`);
        return this.http.get(this.baseURL + endpoint, { params }).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} GET request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} GET request error:`, response);
                throw new Error(response.error.message ? response.error.message : response.error);
            }));
    }

    private post(endpoint: string, body: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} POST request to ${this.baseURL}${endpoint}`);
        return this.http.post(this.baseURL + endpoint, body).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} POST request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} POST request error:`, response);
                throw new Error(response.error.message ? response.error.message : response.error);
            }));
    }

    private put(endpoint: string, body: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} PUT request to ${this.baseURL}${endpoint}`);
        return this.http.put(this.baseURL + endpoint, body).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} PUT request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} PUT request error:`, response);
                throw new Error(response.error.message ? response.error.message : response.error);
            }));
    }

    private delete(endpoint: string): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} DELETE request to ${this.baseURL}${endpoint}`);
        return this.http.delete(this.baseURL + endpoint).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} DELETE request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} DELETE request error:`, response);
                throw new Error(response.error.message ? response.error.message : response.error);
            }));
    }

    private buildURL(): void {
        if (!environment.production) {
            this.logger.info(`${this.logType} ${this.logName} in development mode`);
            return;
        }
        let url = new URL(window.location.href);
        this.baseURL = url.protocol + "//" + url.hostname + ":" + url.port + "/api/";
        this.logger.info(`${this.logType} ${this.logName} URL: ${this.baseURL}`);
    }
}