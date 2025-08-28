import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LogComponent implements OnInit, OnChanges {
  @Input() showLogs = false;
  @Input() logs = '';
  @Input() isLoadingLogs = false;
  @Input() isRefreshingLogs = false;

  @Output() closed = new EventEmitter<void>();
  @Output() logsRefreshed = new EventEmitter<string>();

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    if (this.showLogs && !this.logs) {
      this.loadLogs();
    }
  }

  ngOnChanges() {
    if (this.showLogs && !this.logs) {
      this.loadLogs();
    }
  }

  private loadLogs() {
    this.apiService.log().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
        this.logsRefreshed.emit(this.logs);
      },
      error: (error) => {
        console.error('Failed to load logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to load logs');
        this.logs = 'Failed to load logs';
        this.logsRefreshed.emit(this.logs);
      }
    });
  }

  refreshLogs() {
    this.apiService.log().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
        this.logsRefreshed.emit(this.logs);
        this.notifyService.presentToast('Logs refreshed', 'Success');
      },
      error: (error) => {
        console.error('Failed to refresh logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to refresh logs');
      }
    });
  }

  close() {
    this.closed.emit();
  }
}
