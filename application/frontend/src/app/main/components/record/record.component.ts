import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Address, Record } from '../../../global/services/api/model/object';

@Component({
  selector: 'app-record',
  templateUrl: './record.component.html',
  styleUrls: ['./record.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RecordComponent {
  @Input() records: Record[] = [];
  @Input() current: Address | null = null;

  @Output() addRecord = new EventEmitter<void>();
  @Output() editRecord = new EventEmitter<Record>();
  @Output() deleteRecord = new EventEmitter<Record>();
  @Output() refreshRecord = new EventEmitter<Record>();
  @Output() showRecordResolution = new EventEmitter<Record>();

  isRecordUpdated(record: Record): boolean {
    return record.address_id === this.current?.id;
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
}
