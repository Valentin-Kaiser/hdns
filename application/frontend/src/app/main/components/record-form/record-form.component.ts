import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { Zone as DnsZone, Record } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-record-form',
  templateUrl: './record-form.component.html',
  styleUrls: ['./record-form.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RecordFormComponent implements OnInit, OnChanges {
  @Input() record: Record | null = null;
  @Input() isLoading = false;

  @Output() recordCreated = new EventEmitter<Record>();
  @Output() recordUpdated = new EventEmitter<Record>();
  @Output() cancelled = new EventEmitter<void>();

  zones: DnsZone[] = [];
  tokenError = false;

  formSteps = {
    token: false,
    zoneId: false,
    type: false,
    name: false
  };

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) {}

  ngOnInit() {
    if (this.record) {
      this.validateFormSteps();
      if (this.record.token) {
        this.loadZones();
      }
    }
  }

  ngOnChanges() {
    if (this.record) {
      this.validateFormSteps();
    }
  }

  private validateFormSteps() {
    if (!this.record) return;
    this.formSteps.token = !!(this.record.token && this.record.token.trim().length > 0);
    this.formSteps.zoneId = !!(this.record.zone_id && this.record.zone_id.trim().length > 0);
    this.formSteps.type = !!(this.record.type);
    this.formSteps.name = !!(this.record.name && this.record.name.trim().length > 0);
  }

  onFormFieldChange() {
    this.validateFormSteps();
    if (this.formSteps.token && !this.formSteps.zoneId) {
      this.loadZones();
    }
  }

  loadZones() {
    if (!this.record?.token) return;

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

  setZone(zoneId: string) {
    if (this.record) {
      this.record.zone_id = zoneId;
      this.record.domain = this.zones.find(zone => zone.id === zoneId)?.name || '';
      this.validateFormSteps();
    }
  }

  isFormValid(): boolean {
    return Object.values(this.formSteps).every(step => step);
  }

  createRecord() {
    if (!this.record || !this.isFormValid()) {
      this.notifyService.presentErrorToast('Form Validation Error', 'Please fill in all required fields');
      return;
    }

    this.apiService.createRecord(this.record as Record).subscribe({
      next: (response) => {
        if (response) {
          this.recordCreated.emit(response);
          this.notifyService.presentToast('DNS record created successfully');
        }
      },
      error: (error) => {
        this.notifyService.presentErrorToast('Failed to create DNS record', error);
      }
    });
  }

  updateRecord() {
    if (!this.record || !this.isFormValid()) {
      this.notifyService.presentErrorToast('Form Validation Error', 'Please fill in all required fields');
      return;
    }

    this.apiService.updateRecord(this.record).subscribe({
      next: (response) => {
        if (response) {
          this.recordUpdated.emit(response);
          this.notifyService.presentToast('DNS record updated successfully');
        }
      },
      error: (error) => {
        console.error('Update record error:', error);
        this.notifyService.presentErrorToast(
          'Update Error',
          error || 'Failed to update DNS record'
        );
      }
    });
  }

  cancel() {
    this.cancelled.emit();
  }
}
