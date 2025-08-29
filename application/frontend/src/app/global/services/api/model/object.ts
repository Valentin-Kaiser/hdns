export interface BaseModel {
    id: number;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
}

export interface Address extends BaseModel {
    ip: string;
}

export interface Record extends BaseModel {
    token: string;
    zone_id: string;
    domain: string;
    name: string;
    ttl: number;
    address_id?: number;
    address?: Address;
    last_update: string; // ISO date string
}

export interface RecordHistory extends BaseModel {
    record_id: number;
    record?: Record;
    address_id: number;
    address?: Address;
    resolved_ip: string;
    resolved_at: string; // ISO date string
}

export interface Zone {
    id: string;
    name: string;
    records_count: number;
}

export interface Config {
    log_level: number;
    web_port: number;
    refresh_interval: string;
    dns_servers: string[];
}

export interface Resolution {
    server: string;
    addresses: string[];
    response_time: number;
    error: string | null;
}