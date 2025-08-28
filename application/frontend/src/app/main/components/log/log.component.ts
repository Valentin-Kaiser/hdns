import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnChanges, OnInit, Output } from '@angular/core';
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
  @Output() onClose = new EventEmitter<void>();

  logs: string = '';
  loading: boolean = false;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    this.loadLogs();
  }

  ngOnChanges() {
    if (!this.logs) {
      this.loadLogs();
    }
  }

  private loadLogs() {
    this.loading = true;
    this.apiService.log().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
      },
      error: (error) => {
        console.error('Failed to load logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to load logs');
        this.logs = 'Failed to load logs';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  refreshLogs() {
    this.loading = true;
    this.apiService.log().subscribe({
      next: (logs: string) => {
        this.logs = logs || 'No logs available';
        this.notifyService.presentToast('Logs refreshed', 'Success');
      },
      error: (error) => {
        console.error('Failed to refresh logs:', error);
        this.notifyService.presentErrorToast('Logs Error', 'Failed to refresh logs');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  close() {
    this.onClose.emit();
  }
}
