import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { catchError, defer, finalize, Observable, retry, shareReplay, Subject, takeUntil, tap, throwError, timer } from "rxjs";
import { webSocket, WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';
import { environment } from "src/environments/environment";
import { LoggerService } from "../logger/logger.service";
import { Address, Zone as DnsZone, Record, Resolution } from "./model/object";

export interface Stream<TOut, TIn> {
    messages$: Observable<TOut>;
    send: (msg: TIn) => void;
    close: () => void;
}

@Injectable({
    providedIn: 'root',
})
export class ApiService {
    logType = "[Service]";
    logName = "[Api]";

    private baseURL = "http://localhost:8080/api/";

    constructor(
        private logger: LoggerService,
        private http: HttpClient,
    ) {
        this.logger.info(`${this.logType} ${this.logName} constructor`);
        this.buildURL();
    }

    public info(): Observable<boolean> {
        return this.get("info");
    }

    public address() {
        return this.stream<Address, null>('stream/address');
    }

    public records() {
        return this.stream<Record[], null>('stream/record');
    }

    public resolve(record: Record) {
        return this.stream<Resolution[], null>(`stream/resolve/${record.id}`);
    }

    public history(): Observable<Address[]> {
        return this.get("object/history");
    }

    public refresh(id: number): Observable<Record> {
        return this.get(`action/refresh/record/${id}`);
    }

    public zones(token: string): Observable<DnsZone[]> {
        return this.get(`object/zone/${token}`);
    }

    public config(): Observable<any> {
        return this.get("object/config");
    }

    public log(): Observable<any> {
        return this.get("object/log");
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

    public updateConfig(config: any): Observable<any> {
        return this.put("object/config", config);
    }

    public resolveRecord(recordId: number): Observable<Resolution[]> {
        return this.get(`action/resolve/${recordId}`);
    }

    public clearHistory(): Observable<any> {
        return this.delete("object/history");
    }

    /**
     * Generic API call methods
     */

    private get(endpoint: string, params?: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} GET request to ${this.baseURL}${endpoint}`);
        return this.http.get(this.baseURL + endpoint, { params }).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} ${endpoint} GET request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} ${endpoint} GET request error:`, response);
                return throwError(() => response?.error?.message);
            }));
    }

    private post(endpoint: string, body: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} POST request to ${this.baseURL}${endpoint}`);
        return this.http.post(this.baseURL + endpoint, body).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} ${endpoint} POST request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} ${endpoint} POST request error:`, response);
                return throwError(() => response?.error?.message);
            }));
    }

    private put(endpoint: string, body: any): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} PUT request to ${this.baseURL}${endpoint}`);
        return this.http.put(this.baseURL + endpoint, body).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} ${endpoint} PUT request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} ${endpoint} PUT request error:`, response);
                return throwError(() => response?.error?.message);
            }));
    }

    private delete(endpoint: string): Observable<any> {
        this.logger.info(`${this.logType} ${this.logName} DELETE request to ${this.baseURL}${endpoint}`);
        return this.http.delete(this.baseURL + endpoint).pipe(
            tap((response) => {
                this.logger.info(`${this.logType} ${this.logName} ${endpoint} DELETE request successful:`, response);
            }),
            catchError((response) => {
                this.logger.error(`${this.logType} ${this.logName} ${endpoint} DELETE request error:`, response);
                return throwError(() => response?.error?.message);
            }));
    }

    public stream<TOut, TIn = unknown>(
        endpoint: string,
        params?: any,
        opts: {
            reconnect?: boolean;      // default true
            maxRetries?: number;      // default Infinity
            backoffMs?: number;       // default 1000
            maxBackoffMs?: number;    // default 10000
        } = {}
    ): Stream<TOut, TIn> {
        const {
            reconnect = true,
            maxRetries = Number.POSITIVE_INFINITY,
            backoffMs = 1000,
            maxBackoffMs = 10000,
        } = opts;

        const url = this.toWsUrl(endpoint, params);

        // Outgoing message queue; each active WS subscribes to this
        const outgoing$ = new Subject<TIn>();

        // Kill switch to stop retry loop explicitly
        const kill$ = new Subject<void>();

        let currentWs: WebSocketSubject<any> | null = null;

        const config: WebSocketSubjectConfig<any> = {
            url,
            deserializer: (e: MessageEvent) => JSON.parse(e.data),    // -> TOut
            serializer: (value: any) => JSON.stringify(value),        // <- TIn
            openObserver: {
                next: () => this.logger.info(`${this.logType} ${this.logName} WS open ${url}`),
            },
            closeObserver: {
                next: (ev: CloseEvent) => {
                    this.logger.info(`${this.logType} ${this.logName} WS closed ${url} code=${ev.code} reason=${ev.reason}`);
                },
            },
        };

        this.logger.info(`${this.logType} ${this.logName} WS connect ${url}`);

        // One WS per subscription; we reconnect by re-subscribing via retryWhen
        const source$ = defer(() => {
            const ws = webSocket<any>(config);
            currentWs = ws;

            // Pipe queued outgoing messages into the active socket
            const outSub = outgoing$.subscribe({
                next: (value) => {
                    try { ws.next(value); }
                    catch (err) {
                        this.logger.warn(`${this.logType} ${this.logName} WS send failed (will retry on reconnect)`, err);
                        // If send fails due to closed socket, the retryWhen will recreate ws.
                    }
                }
            });

            // When this WS completes/errors, stop feeding it
            return ws.pipe(finalize(() => {
                outSub.unsubscribe();
                currentWs = null;
            }));
        });

        const messages$ = source$.pipe(
            reconnect
                ? retry({
                    count: maxRetries,
                    resetOnSuccess: true,
                    delay: (error, retryCount) => {
                        const backoff = Math.min(
                            maxBackoffMs,
                            Math.floor(backoffMs * Math.pow(2, Math.max(0, retryCount - 1)))
                        );
                        const jitter = Math.floor(Math.random() * 300);
                        this.logger.warn(
                            `${this.logType} ${this.logName} WS retry #${retryCount} in ${backoff + jitter}ms`,
                            error
                        );
                        return timer(backoff + jitter);
                    },
                })
                : tap({}),
            takeUntil(kill$),
            shareReplay({ bufferSize: 1, refCount: true })
        ).pipe(tap({
            next: (msg) => this.logger.info(`${this.logType} ${this.logName} WS message received`, msg),
            error: (err) => this.logger.error(`${this.logType} ${this.logName} WS message error`, err)
        })) as Observable<TOut>;

        const send = (msg: TIn) => {
            this.logger.info(`${this.logType} ${this.logName} WS message sent`, msg);
            outgoing$.next(msg);
        };

        const close = () => {
            // Stop retries and close current socket
            kill$.next();
            kill$.complete();
            try { currentWs?.complete(); } catch { /* ignore */ }
            outgoing$.complete();
        };

        return { messages$, send, close };
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

    private toWsUrl(endpoint: string, params?: any): string {
        const base = new URL(this.baseURL);
        const url = new URL(endpoint, base);
        if (params) {
            Object.entries(params)
                .filter(([, v]) => v !== undefined && v !== null)
                .forEach(([k, v]) => url.searchParams.append(k, String(v)));
        }
        url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
        return url.toString();
    }
}