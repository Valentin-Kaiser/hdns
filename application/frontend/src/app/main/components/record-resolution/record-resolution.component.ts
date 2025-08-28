import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs/internal/Subscription';
import { ApiService } from '../../../global/services/api/api.service';
import { Record, Resolution } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-record-resolution',
  templateUrl: './record-resolution.component.html',
  styleUrls: ['./record-resolution.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RecordResolutionComponent implements OnInit, OnDestroy {
  @Input() record: Record | null = null;
  @Output() onClose = new EventEmitter<void>();

  loading: boolean = true;
  resolutions: Resolution[] = [];
  sub: Subscription | null = null;
  interval: any;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    if (this.record) {
      const addressStream = this.apiService.resolve(this.record);
      this.sub = addressStream.messages$.subscribe({
        next: (message) => {
          this.resolutions = message;
          this.loading = false;
        },
        error: (error) => {
          console.error('Address stream error:', error);
        }
      });

      addressStream.send(null);
      this.interval = setInterval(() => {
        addressStream.send(null);
      }, 5000);
    }
  }

  ngOnDestroy() {
    this.interval && clearInterval(this.interval);
    this.sub?.unsubscribe();
  }

  getIpTypeIcon(ip: string): string {
    return this.isIPv6(ip) ? 'globe-outline' : 'earth-outline';
  }

  getIpTypeColor(ip: string): string {
    return this.isIPv6(ip) ? 'secondary' : 'primary';
  }

  getIpType(ip: string): string {
    return this.isIPv6(ip) ? 'IPv6' : 'IPv4';
  }

  isIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  isIPv6(ip: string): boolean {
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv6Regex.test(ip) || ip.includes('::');
  }

  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  }

  close() {
    this.onClose.emit();
  }
}
