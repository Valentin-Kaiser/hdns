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
    type: RecordType;
    domain: string;
    name: string;
    ttl: number;
    address_id?: number;
    address?: Address;
    last_update: string; // ISO date string
}

export interface Zone {
    id: string;
    name: string;
    records_count: number;
}

export enum RecordType {
    Unknown = "",
    A = "A",
    AAAA = "AAAA",
    CNAME = "CNAME",
    MX = "MX",
    TXT = "TXT",
    NS = "NS"
}

