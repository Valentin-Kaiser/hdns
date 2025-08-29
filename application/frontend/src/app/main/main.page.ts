import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ApiService, Stream } from '../global/services/api/api.service';
import { Address, Record } from '../global/services/api/model/object';
import { NotifyService } from '../global/services/notify/notify.service';
import { ConfigurationComponent } from './components/configuration/configuration.component';
import { HistoryComponent } from './components/history/history.component';
import { LogComponent } from './components/log/log.component';
import { RecordFormComponent } from './components/record-form/record-form.component';
import { RecordResolutionComponent } from './components/record-resolution/record-resolution.component';
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
    HistoryComponent,
    RecordResolutionComponent
  ]
})
export class MainPage implements OnInit, OnDestroy {

  current: Address | null = null;
  records: Record[] = [];
  record: Record | null = null;
  isLoading = true;

  showConfig = false;
  showLogs = false;
  showHistory = false;
  showRecordResolution = false;
  selectedRecord: Record | null = null;

  streams: Stream<any, any>[] = [];
  subscriptions: Subscription[] = [];
  interval = null;

  get hasActiveModal(): boolean {
    return !!(this.record || this.showConfig || this.showLogs || this.showHistory || this.showRecordResolution);
  }

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) {
  }

  ngOnInit() {
    const addressStream = this.apiService.address();
    this.subscriptions.push(addressStream.messages$.subscribe({
      next: (message) => {
        if (!this.current || this.current.id !== message.id) {
          this.current = message;
        }
      },
      error: (error) => {
        console.error('Address stream error:', error);
      }
    }));

    const recordStream = this.apiService.records();
    this.subscriptions.push(recordStream.messages$.subscribe({
      next: (message) => {
        this.records = message;
      },
      error: (error) => {
        console.error('Record stream error:', error);
      }
    }));

    this.streams.push(recordStream);
    this.streams.push(addressStream);

    this.streams.forEach(s => s.send(null));
    this.interval = setInterval(() => {
      this.streams.forEach(s => s.send(null));
    }, 10000);
  }

  ngOnDestroy() {
    this.interval && clearInterval(this.interval);
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.streams.forEach(s => s.close());
  }

  addRecord() {
    this.record = {} as Record;
  }

  editRecordAction(record: Record) {
    this.record = { ...record }; // Create a copy to avoid modifying the original
  }

  onRecordChange(record: Record) {
    const index = this.records.findIndex(r => r.id === record.id);
    if (index === -1) {
      this.records.push(record);
    } else {
      this.records[index] = record;
    }
    this.record = null;
  }

  closeActiveForm() {
    if (this.record) {
      this.record = null;
    } else if (this.showConfig) {
      this.toggleConfig();
    } else if (this.showLogs) {
      this.toggleLogs();
    } else if (this.showHistory) {
      this.toggleHistory();
    } else if (this.showRecordResolution) {
      this.closeRecordIps();
    }
  }

  refreshRecord(record: Record) {
    this.apiService.refresh(record.id).subscribe({
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
    let deleteFromHetzner = false;
    this.notifyService.showWarning(
      this,
      `Are you sure you want to delete the record ${record.name}.${record.domain}?`,
      () => { },
      () => {
        this.apiService.deleteRecord(record, deleteFromHetzner).subscribe({
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
      true,
      "Delete record from Hetzner DNS",
      false,
      (value: boolean) => {
        deleteFromHetzner = value;
      }
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
  toggleHistory() {
    this.showHistory = !this.showHistory;
    if (this.showHistory) {
      this.showConfig = false;
      this.showLogs = false;
      this.showRecordResolution = false;
    }
  }

  // Record IPs methods
  toggle(record: Record) {
    this.selectedRecord = record;
    this.showRecordResolution = true;
    this.showConfig = false;
    this.showLogs = false;
    this.showHistory = false;
  }

  closeRecordIps() {
    this.showRecordResolution = false;
    this.selectedRecord = null;
  }
}
