import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription, timer } from 'rxjs';
import { ApiService } from '../global/services/api/api.service';
import { Address, Config, Record } from '../global/services/api/model/object';
import { NotifyService } from '../global/services/notify/notify.service';
import { ConfigurationComponent } from './components/configuration/configuration.component';
import { IpHistoryComponent } from './components/ip-history/ip-history.component';
import { LogComponent } from './components/log/log.component';
import { RecordFormComponent } from './components/record-form/record-form.component';
import { RecordIpsComponent } from './components/record-ips/record-ips.component';
import { RecordComponent } from './components/record/record.component';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RecordFormComponent,
    ConfigurationComponent,
    LogComponent,
    RecordComponent,
    IpHistoryComponent,
    RecordIpsComponent
  ]
})
export class MainPage implements OnInit, OnDestroy {

  current: Address | null = null;
  records: Record[] = [];
  record: Record | null = null;
  isLoading = true;
  isRefreshing = false;

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

  // IP History and Record IPs states
  showIpHistory = false;
  isLoadingHistory = false;
  showRecordIps = false;
  selectedRecord: Record | null = null;
  isLoadingRecordIps = false;

  private autoRefreshSubscription?: Subscription;

  get hasActiveModal(): boolean {
    return !!(this.record || this.showConfig || this.showLogs || this.showIpHistory || this.showRecordIps);
  }

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

  addRecord() {
    this.record = {} as Record;
  }

  editRecordAction(record: Record) {
    this.record = { ...record }; // Create a copy to avoid modifying the original
  }

  cancel() {
    this.record = null;
  }

  // Event handlers for child components
  onRecordCreated(newRecord: Record) {
    this.records.push(newRecord);
    this.cancel();
  }

  onRecordUpdated(updatedRecord: Record) {
    const index = this.records.findIndex(r => r.id === updatedRecord.id);
    if (index !== -1) {
      this.records[index] = updatedRecord;
    }
    this.cancel();
  }

  onConfigSaved(updatedConfig: Config) {
    this.config = { ...updatedConfig };
    this.originalConfig = { ...updatedConfig };
  }

  onLogsRefreshed(refreshedLogs: string) {
    this.logs = refreshedLogs;
  }

  closeActiveForm() {
    if (this.record) {
      this.cancel();
    } else if (this.showConfig) {
      this.toggleConfig();
    } else if (this.showLogs) {
      this.toggleLogs();
    } else if (this.showIpHistory) {
      this.toggleIpHistory();
    } else if (this.showRecordIps) {
      this.closeRecordIps();
    }
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

  // Configuration methods
  toggleConfig() {
    this.showConfig = !this.showConfig;
    if (this.showConfig) {
      this.showLogs = false; // Close logs when opening config
    }
  }

  // Logs methods
  toggleLogs() {
    this.showLogs = !this.showLogs;
    if (this.showLogs) {
      this.showConfig = false; // Close config when opening logs
    }
  }

  // IP History methods
  toggleIpHistory() {
    this.showIpHistory = !this.showIpHistory;
    if (this.showIpHistory) {
      this.showConfig = false;
      this.showLogs = false;
      this.showRecordIps = false;
    }
  }

  // Record IPs methods
  showRecordIpsFor(record: Record) {
    this.selectedRecord = record;
    this.showRecordIps = true;
    this.showConfig = false;
    this.showLogs = false;
    this.showIpHistory = false;
  }

  closeRecordIps() {
    this.showRecordIps = false;
    this.selectedRecord = null;
  }
}
