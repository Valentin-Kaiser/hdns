import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnChanges, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { Config } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-configuration',
  templateUrl: './configuration.component.html',
  styleUrls: ['./configuration.component.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class ConfigurationComponent implements OnInit, OnChanges {
  @Output() onClose = new EventEmitter<void>();
  @Output() onChange = new EventEmitter<Config>();

  config: Config;
  formGroup: FormGroup;
  loading: boolean = false;
  saving: boolean = false;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.loadConfig();

  }

  ngOnChanges() {
    this.loadConfig();
  }

  private loadConfig() {
    this.loading = true;
    this.apiService.config().subscribe({
      next: (config: Config) => {
        this.config = { ...config };
        this.formGroup = this.formBuilder.group({
          log_level: [this.config.log_level],
          web_port: [this.config.web_port],
          refresh_interval: [this.config.refresh_interval],
          dns_servers: [],
        });
      },
      error: (error) => {
        console.error('Failed to load config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to load configuration');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }


  saveConfig() {
    if (this.formGroup.invalid) {
      return;
    }

    this.saving = true;
    this.config.log_level = this.formGroup.value.log_level;
    this.config.web_port = this.formGroup.value.web_port;
    this.config.refresh_interval = this.formGroup.value.refresh_interval;

    this.apiService.updateConfig(this.config).subscribe({
      next: (updatedConfig: Config) => {
        this.config = { ...updatedConfig };
        this.onChange.emit(updatedConfig);
        this.notifyService.presentToast('Configuration updated successfully', 'Success');
      },
      error: (error) => {
        console.error('Failed to update config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to update configuration');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  close() {
    this.onClose.emit();
  }

  addDnsServer() {
    if (!this.config.dns_servers) {
      this.config.dns_servers = [];
    }
    this.config.dns_servers.push('');
    this.dirty();
  }

  removeDnsServer(index: number) {
    if (this.config.dns_servers && this.config.dns_servers.length > 1) {
      this.config.dns_servers.splice(index, 1);
    }
    this.dirty();
  }

  updateDnsServer(index: number, value) {
    if (this.config.dns_servers && this.config.dns_servers.length > index) {
      this.config.dns_servers[index] = value;
    }
    this.dirty();
  }

  dirty() {
    this.formGroup.markAsDirty();
    if (this.config.dns_servers.some(s => !s || s.trim() === '')) {
      this.formGroup.controls['dns_servers'].setErrors({ invalid: true });
      return
    }
    this.formGroup.controls['dns_servers'].setErrors(null);
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }
}
