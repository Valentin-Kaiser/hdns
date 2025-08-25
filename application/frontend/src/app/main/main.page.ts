import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription, timer } from 'rxjs';
import { ApiService } from '../global/services/api/api.service';
import { Address, Config, Zone as DnsZone, Record, RecordType } from '../global/services/api/model/object';
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
  record: Record | null = null;
  zones: DnsZone[] = [];
  isLoading = true;
  isRefreshing = false;
  tokenError = false;

  // Configuration and logs states
  showConfig = false;
  showLogs = false;
  config: Config = null;
  originalConfig: Config | null = null;
  isLoadingConfig = false;
  isSavingConfig = false;

  logs = '';
  isLoadingLogs = false;
  isRefreshingLogs = false;

  private autoRefreshSubscription?: Subscription;

  formSteps = {
    token: false,
    zoneId: false,
    type: false,
    name: false,
    ttl: false
  };

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) {
  }

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
      this.notifyService.presentErrorToast("Failed to load records", error);
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
      this.notifyService.presentToast("Data refreshed successfully");
    }).catch(error => {
      console.error('Refresh error:', error);
      this.notifyService.presentErrorToast("Failed to refresh data", error);
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
        this.notifyService.presentErrorToast("Failed to load records", error);
      }
    });
  }

  loadZones() {
    if (!this.record.token) return;

    this.zones = [];
    this.tokenError = false;
    this.apiService.zones(this.record.token).subscribe({
      next: (response) => {
        this.zones = response || [];
        this.tokenError = false;
        if (this.zones.length === 0) {
          this.tokenError = true;
        }
      },
      error: (error) => {
        this.tokenError = true;
        this.zones = [];
      }
    });
  }

  addRecord() {
    this.record = {} as Record;
    this.zones = [];
    this.resetFormSteps();
  }

  editRecordAction(record: Record) {
    this.record = { ...record }; // Create a copy to avoid modifying the original
    this.zones = []; // Reset zones, will be loaded when token is validated
    this.tokenError = false;
    this.loadZones();
    this.resetFormSteps();
    this.formSteps = { ...this.formSteps, token: true, zoneId: true, type: true, name: true, ttl: true };
    this.validateFormSteps();
  }

  cancel() {
    this.record = null;
    this.tokenError = false;
    this.zones = [];
    this.resetFormSteps();
  }

  closeActiveForm() {
    if (this.record) {
      this.cancel();
    } else if (this.showConfig) {
      this.toggleConfig();
    } else if (this.showLogs) {
      this.toggleLogs();
    }
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

  private validateFormSteps() {
    if (!this.record) return;
    console.log(this.record)
    this.formSteps.token = !!(this.record.token && this.record.token.trim().length > 0);
    this.formSteps.zoneId = !!(this.record.zone_id && this.record.zone_id.trim().length > 0);
    this.formSteps.type = !!(this.record.type);
    this.formSteps.name = !!(this.record.name && this.record.name.trim().length > 0);
    this.formSteps.ttl = !!(this.record.ttl && this.record.ttl > 0);
    console.log(this.formSteps);
  }

  onFormFieldChange() {
    this.validateFormSteps();
    if (this.formSteps.token && !this.formSteps.zoneId) {
      this.loadZones();
    }
  }

  isFormValid(): boolean {
    return Object.values(this.formSteps).every(step => step);
  }

  isEditFormValid(): boolean {
    return Object.values(this.formSteps).every(step => step);
  }

  setZone(zoneId: string) {
    if (this.record) {
      this.record.zone_id = zoneId;
      this.record.domain = this.zones.find(zone => zone.id === zoneId)?.name || '';
      this.validateFormSteps();
    }
  }

  createRecord() {
    if (!this.record || !this.isFormValid()) {
      this.notifyService.presentErrorToast('Form Validation Error', 'Please fill in all required fields');
      return;
    }

    this.isLoading = true;

    this.apiService.createRecord(this.record as Record).subscribe({
      next: (response) => {
        if (response) {
          this.records.push(response);
          this.notifyService.presentToast('DNS record created successfully');
          this.cancel();
        }
      },
      error: (error) => {
        this.notifyService.presentErrorToast('Failed to create DNS record', error);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  updateRecord() {
    if (!this.record || !this.isEditFormValid()) {
      this.notifyService.presentErrorToast('Form Validation Error', 'Please fill in all required fields');
      return;
    }

    this.isLoading = true;

    this.apiService.updateRecord(this.record).subscribe({
      next: (response) => {
        if (response) {
          const index = this.records.findIndex(r => r.id === this.record.id);
          if (index !== -1) {
            this.records[index] = response;
          }
          this.notifyService.presentToast('DNS record updated successfully');
          this.cancel();
        }
      },
      error: (error) => {
        console.error('Update record error:', error);
        this.notifyService.presentErrorToast(
          'Update Error',
          error || 'Failed to update DNS record'
        );
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  refreshRecord(record: Record) {
    this.apiService.refreshRecord(record.id).subscribe({
      next: (updatedRecord) => {
        const index = this.records.findIndex(r => r.id === record.id);
        if (index !== -1 && updatedRecord) {
          this.records[index] = updatedRecord;
          this.notifyService.presentToast(`Record ${record.name}.${record.domain} refreshed`);
        }
      },
      error: (error) => {
        console.error('Refresh record error:', error);
        this.notifyService.presentErrorToast(
          'Refresh Error',
          `Failed to refresh record ${record.name}.${record.domain}`
        );
      }
    });
  }

  deleteRecord(record: Record) {
    this.notifyService.showWarning(
      this,
      `Are you sure you want to delete the record ${record.name}.${record.domain}?`,
      () => { },
      () => {
        this.apiService.deleteRecord(record).subscribe({
          next: () => {
            this.records = this.records.filter(r => r.id !== record.id);
            this.notifyService.presentToast(`Record ${record.name}.${record.domain} deleted`, 'Success');
          },
          error: (error) => {
            console.error('Delete record error:', error);
            this.notifyService.presentErrorToast(
              'Delete Error',
              `Failed to delete record ${record.name}.${record.domain}`
            );
          }
        });
      },
      "Cancel",
      "Delete",
      "medium",
      "danger",
      "This will not delete the record from the Hetzner DNS"
    )
  }

  isRecordUpdated(record: Record): boolean {
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

  isUpdated(record: Record): boolean {
    return record.last_update !== '0001-01-01T00:00:00Z';
  }

  trackByRecordId(index: number, record: Record): number {
    return record.id;
  }

  // Configuration methods
  toggleConfig() {
    this.showConfig = !this.showConfig;
    if (this.showConfig && !this.originalConfig) {
      this.loadConfig();
    }
    if (this.showConfig) {
      this.showLogs = false; // Close logs when opening config
    }
  }

  private loadConfig() {
    this.isLoadingConfig = true;
    this.apiService.getConfig().subscribe({
      next: (config: Config) => {
        this.config = { ...config };
        this.originalConfig = { ...config };
        this.isLoadingConfig = false;
      },
      error: (error) => {
        console.error('Failed to load config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to load configuration');
        this.isLoadingConfig = false;
      }
    });
  }

  hasConfigChanges(): boolean {
    if (!this.originalConfig) return false;
    return JSON.stringify(this.config) !== JSON.stringify(this.originalConfig);
  }

  saveConfig() {
    if (this.isSavingConfig) return;

    this.isSavingConfig = true;
    this.apiService.updateConfig(this.config).subscribe({
      next: (updatedConfig: Config) => {
        this.config = { ...updatedConfig };
        this.originalConfig = { ...updatedConfig };
        this.isSavingConfig = false;
        this.notifyService.presentToast('Configuration updated successfully', 'Success');
      },
      error: (error) => {
        console.error('Failed to update config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to update configuration');
        this.isSavingConfig = false;
      }
    });
  }

  // Logs methods
  toggleLogs() {
    this.showLogs = !this.showLogs;
    if (this.showLogs && !this.logs) {
      this.loadLogs();
    }
    if (this.showLogs) {
      this.showConfig = false; // Close config when opening logs
    }
  }

  private loadLogs() {
    this.isLoadingLogs = true;
    this.apiService.getLog().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
        this.isLoadingLogs = false;
      },
      error: (error) => {
        console.error('Failed to load logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to load logs');
        this.logs = 'Failed to load logs';
        this.isLoadingLogs = false;
      }
    });
  }

  refreshLogs() {
    if (this.isRefreshingLogs) return;

    this.isRefreshingLogs = true;
    this.apiService.getLog().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
        this.isRefreshingLogs = false;
        this.notifyService.presentToast('Logs refreshed', 'Success');
      },
      error: (error) => {
        console.error('Failed to refresh logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to refresh logs');
        this.isRefreshingLogs = false;
      }
    });
  }
}
