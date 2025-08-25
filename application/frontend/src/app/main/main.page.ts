import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription, timer } from 'rxjs';
import { ApiService } from '../global/services/api/api.service';
import { Address, Zone as DnsZone, Record, RecordType } from '../global/services/api/model/object';
import { NotifyService } from '../global/services/notify/notify.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class MainPage implements OnInit, OnDestroy {

  current: Address | null = null;
  records: Record[] = [];
  newRecord: Partial<Record> | null = null;
  editRecord: Record | null = null;
  zones: DnsZone[] = [];
  isLoading = true;
  isRefreshing = false;
  isCreatingRecord = false;
  isUpdatingRecord = false;
  showAddForm = false;
  showEditForm = false;
  tokenError = false;
  
  // Auto-refresh subscription
  private autoRefreshSubscription?: Subscription;
  
  // Form step validation
  formSteps = {
    token: false,
    zoneId: false,
    type: false,
    name: false,
    ttl: false
  };

  // Edit form steps
  editFormSteps = {
    token: false,
    zoneId: false,
    type: false,
    name: false,
    ttl: false
  };

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    this.loadInitialData();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  private loadInitialData() {
    this.isLoading = true;
    
    // Load current address and records in parallel
    Promise.all([
      this.apiService.address().toPromise(),
      this.apiService.records().toPromise()
    ]).then(([address, records]) => {
      this.current = address || null;
      this.records = records || [];
    }).catch(error => {
      console.error('Error loading initial data:', error);
      this.notifyService.presentErrorToast('Failed to load data', 'Error');
    }).finally(() => {
      this.isLoading = false;
    });
  }

  private startAutoRefresh() {
    // Auto-refresh every 5 minutes
    this.autoRefreshSubscription = timer(0, 5 * 60 * 1000).subscribe(() => {
      if (!this.isRefreshing && !this.isLoading) {
        this.silentRefresh();
      }
    });
  }

  private silentRefresh() {
    this.apiService.address().subscribe({
      next: (address) => {
        this.current = address;
      },
      error: (error) => {
        console.error('Silent refresh failed:', error);
      }
    });
  }

  refresh() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    Promise.all([
      this.apiService.refreshAddress().toPromise(),
      this.apiService.records().toPromise()
    ]).then(([address, records]) => {
      this.current = address || null;
      this.records = records || [];
      this.notifyService.presentToast("Data refreshed successfully", "Success");
    }).catch(error => {
      console.error('Refresh error:', error);
      this.notifyService.presentErrorToast('Failed to refresh data', 'Error');
    }).finally(() => {
      this.isRefreshing = false;
    });
  }

  loadRecords() {
    this.apiService.records().subscribe({
      next: (response) => {
        this.records = response || [];
      },
      error: (error) => {
        console.error('Error loading records:', error);
        this.notifyService.presentErrorToast('Failed to load records', 'Error');
      }
    });
  }

  loadZones() {
    if (!this.newRecord?.token) return;
    
    this.tokenError = false;
    this.apiService.zones(this.newRecord.token).subscribe({
      next: (response) => {
        this.zones = response || [];
        this.tokenError = false;
        if (this.zones.length === 0) {
          this.notifyService.presentErrorToast('No zones found for this API token', 'Token Validation');
          this.tokenError = true;
        }
      },
      error: (error) => {
        console.error('Error loading zones:', error);
        this.tokenError = true;
        this.zones = [];
        this.notifyService.presentErrorToast('Invalid API token or failed to load zones', 'Token Validation Error');
      }
    });
  }

  addRecord() {
    this.showAddForm = true;
    this.newRecord = {
      id: 0,
      created_at: "",
      updated_at: "",
      token: "",
      zone_id: "",
      type: null as any, // Will be set by user selection
      domain: "",
      name: "",
      ttl: 300,
    };
    this.zones = [];
    this.resetFormSteps();
  }

  cancelAddRecord() {
    this.showAddForm = false;
    this.newRecord = null;
    this.tokenError = false;
    this.zones = [];
    this.resetFormSteps();
  }

  editRecordAction(record: Record) {
    this.showEditForm = true;
    this.editRecord = { ...record }; // Create a copy to avoid modifying the original
    this.zones = []; // Reset zones, will be loaded when token is validated
    this.tokenError = false;
    this.resetEditFormSteps();
    this.validateEditFormSteps();
  }

  cancelEditRecord() {
    this.showEditForm = false;
    this.editRecord = null;
    this.tokenError = false;
    this.zones = [];
    this.resetEditFormSteps();
  }

  private resetFormSteps() {
    this.formSteps = {
      token: false,
      zoneId: false,
      type: false,
      name: false,
      ttl: false
    };
  }

  private resetEditFormSteps() {
    this.editFormSteps = {
      token: false,
      zoneId: false,
      type: false,
      name: false,
      ttl: false
    };
  }

  private validateFormSteps() {
    if (!this.newRecord) return;
    
    this.formSteps.token = !!(this.newRecord.token && this.newRecord.token.trim().length > 0);
    this.formSteps.zoneId = !!(this.newRecord.zone_id && this.newRecord.zone_id.trim().length > 0);
    this.formSteps.type = !!(this.newRecord.type);
    this.formSteps.name = !!(this.newRecord.name && this.newRecord.name.trim().length > 0);
    this.formSteps.ttl = !!(this.newRecord.ttl && this.newRecord.ttl > 0);
  }

  private validateEditFormSteps() {
    if (!this.editRecord) return;
    
    this.editFormSteps.token = !!(this.editRecord.token && this.editRecord.token.trim().length > 0);
    this.editFormSteps.zoneId = !!(this.editRecord.zone_id && this.editRecord.zone_id.trim().length > 0);
    this.editFormSteps.type = !!(this.editRecord.type);
    this.editFormSteps.name = !!(this.editRecord.name && this.editRecord.name.trim().length > 0);
    this.editFormSteps.ttl = !!(this.editRecord.ttl && this.editRecord.ttl > 0);
  }

  onFormFieldChange() {
    console.log('Form field changed:', this.newRecord);
    this.validateFormSteps();
    if (this.formSteps.token && !this.formSteps.zoneId) {
      this.loadZones();
    }
  }

  onEditFormFieldChange() {
    console.log('Edit form field changed:', this.editRecord);
    this.validateEditFormSteps();
    if (this.editFormSteps.token && !this.editFormSteps.zoneId) {
      this.loadZonesForEdit();
    }
  }

  loadZonesForEdit() {
    if (!this.editRecord?.token) return;
    
    this.tokenError = false;
    this.apiService.zones(this.editRecord.token).subscribe({
      next: (response) => {
        this.zones = response || [];
        this.tokenError = false;
        if (this.zones.length === 0) {
          this.notifyService.presentErrorToast('No zones found for this API token', 'Token Validation');
          this.tokenError = true;
        }
      },
      error: (error) => {
        console.error('Error loading zones:', error);
        this.tokenError = true;
        this.zones = [];
        this.notifyService.presentErrorToast('Invalid API token or failed to load zones', 'Token Validation Error');
      }
    });
  }

  isFormValid(): boolean {
    return Object.values(this.formSteps).every(step => step);
  }

  isEditFormValid(): boolean {
    return Object.values(this.editFormSteps).every(step => step);
  }

  setZone(zone: DnsZone) {
    if (this.newRecord) {
      this.newRecord.zone_id = zone.id;
      this.newRecord.domain = zone.name;
      this.validateFormSteps();
    }
  }

  setEditZone(zone: DnsZone) {
    if (this.editRecord) {
      this.editRecord.zone_id = zone.id;
      this.editRecord.domain = zone.name;
      this.validateEditFormSteps();
    }
  }

  createRecord() {
    if (!this.newRecord || !this.isFormValid()) {
      this.notifyService.presentErrorToast('Please fill in all required fields', 'Validation Error');
      return;
    }

    this.isCreatingRecord = true;

    this.apiService.createRecord(this.newRecord as Record).subscribe({
      next: (response) => {
        if (response) {
          this.records.push(response);
          this.notifyService.presentToast('DNS record created successfully', 'Success');
          this.cancelAddRecord();
        }
      },
      error: (error) => {
        console.error('Create record error:', error);
        this.notifyService.presentErrorToast(
          error.error?.message || 'Failed to create DNS record', 
          'Creation Error'
        );
      },
      complete: () => {
        this.isCreatingRecord = false;
      }
    });
  }

  updateRecord() {
    if (!this.editRecord || !this.isEditFormValid()) {
      this.notifyService.presentErrorToast('Please fill in all required fields', 'Validation Error');
      return;
    }

    this.isUpdatingRecord = true;

    this.apiService.updateRecord(this.editRecord).subscribe({
      next: (response) => {
        if (response) {
          const index = this.records.findIndex(r => r.id === this.editRecord!.id);
          if (index !== -1) {
            this.records[index] = response;
          }
          this.notifyService.presentToast('DNS record updated successfully', 'Success');
          this.cancelEditRecord();
        }
      },
      error: (error) => {
        console.error('Update record error:', error);
        this.notifyService.presentErrorToast(
          error.error?.message || 'Failed to update DNS record', 
          'Update Error'
        );
      },
      complete: () => {
        this.isUpdatingRecord = false;
      }
    });
  }

  refreshRecord(record: Record) {
    this.apiService.refreshRecord(record.id).subscribe({
      next: (updatedRecord) => {
        const index = this.records.findIndex(r => r.id === record.id);
        if (index !== -1 && updatedRecord) {
          this.records[index] = updatedRecord;
          this.notifyService.presentToast(`Record ${record.name}.${record.domain} refreshed`, 'Success');
        }
      },
      error: (error) => {
        console.error('Refresh record error:', error);
        this.notifyService.presentErrorToast(
          `Failed to refresh record ${record.name}.${record.domain}`, 
          'Refresh Error'
        );
      }
    });
  }

  deleteRecord(record: Record) {
    if (!confirm(`Are you sure you want to delete the record ${record.name}.${record.domain}?`)) {
      return;
    }

    this.apiService.deleteRecord(record).subscribe({
      next: () => {
        this.records = this.records.filter(r => r.id !== record.id);
        this.notifyService.presentToast(`Record ${record.name}.${record.domain} deleted`, 'Success');
      },
      error: (error) => {
        console.error('Delete record error:', error);
        this.notifyService.presentErrorToast(
          `Failed to delete record ${record.name}.${record.domain}`, 
          'Delete Error'
        );
      }
    });
  }

  isRecordActive(record: Record): boolean {
    return record.address_id === this.current?.id;
  }

  getRecordTypeColor(type: RecordType): string {
    switch (type) {
      case RecordType.A:
      case RecordType.AAAA:
        return 'primary'; // Hetzner red
      case RecordType.CNAME:
        return 'secondary'; // Hetzner orange
      case RecordType.MX:
        return 'success'; // Green for mail
      case RecordType.TXT:
        return 'warning'; // Yellow/amber
      case RecordType.NS:
        return 'medium'; // Neutral gray
      default:
        return 'medium';
    }
  }

  getLastUpdatedText(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  }

  trackByRecordId(index: number, record: Record): number {
    return record.id;
  }
}
