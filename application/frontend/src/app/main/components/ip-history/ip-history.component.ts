import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { Address } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-ip-history',
  templateUrl: './ip-history.component.html',
  styleUrls: ['./ip-history.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class IpHistoryComponent implements OnInit, OnChanges {
  @Input() showHistory = false;
  @Input() currentAddressId: number | null = null;
  @Input() isLoadingHistory = false;

  @Output() closed = new EventEmitter<void>();

  ipHistory: Address[] = [];

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    if (this.showHistory) {
      this.loadHistory();
    }
  }

  ngOnChanges() {
    if (this.showHistory && this.ipHistory.length === 0) {
      this.loadHistory();
    }
  }

  private loadHistory() {
    // Load IP address history using the existing API service method
    this.apiService.history().subscribe({
      next: (history: Address[]) => {
        this.ipHistory = history || [];
      },
      error: (error) => {
        console.error('Failed to load IP history:', error);
        this.notifyService.presentErrorToast('History Error', 'Failed to load IP address history');
        this.ipHistory = [];
      }
    });
  }

  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 30) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  async copyToClipboard(ip: string) {
    try {
      await navigator.clipboard.writeText(ip);
      this.notifyService.presentToast(`IP address ${ip} copied to clipboard`, 'Success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.notifyService.presentErrorToast('Copy Error', 'Failed to copy IP address');
    }
  }

  close() {
    this.closed.emit();
  }
}
