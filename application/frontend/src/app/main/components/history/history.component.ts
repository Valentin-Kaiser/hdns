import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { Address } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ]
})
export class HistoryComponent implements OnInit, OnChanges {
  @Input() current: Address | null = null;
  @Output() onClose = new EventEmitter<void>();

  history: Address[] = [];
  loading: boolean = false;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    this.loadHistory();
  }

  ngOnChanges() {
    this.loadHistory();
  }

  private loadHistory() {
    this.loading = true;
    this.apiService.history().subscribe({
      next: (history: Address[]) => {
        this.history = history || [];
      },
      error: (error) => {
        console.error('Failed to load IP history:', error);
        this.notifyService.presentErrorToast('History Error', 'Failed to load IP address history');
        this.history = [];
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  getFormattedDate(dateString: string): string {
    return this.formatDuration(new Date(dateString).getTime() / 1000, Date.now() / 1000);
  }

  formatDuration(start, end) {
    const duration = end - start;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(" ") || "0s";
  }

  close() {
    this.onClose.emit();
  }
}
