import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../../../global/services/api/api.service';
import { Config } from '../../../global/services/api/model/object';
import { NotifyService } from '../../../global/services/notify/notify.service';

@Component({
  selector: 'app-configuration',
  templateUrl: './configuration.component.html',
  styleUrls: ['./configuration.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ConfigurationComponent implements OnInit, OnChanges {
  @Input() showConfig = false;
  @Input() config: Config = null;
  @Input() isLoadingConfig = false;
  @Input() isSavingConfig = false;

  @Output() closed = new EventEmitter<void>();
  @Output() configSaved = new EventEmitter<Config>();

  originalConfig: Config | null = null;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    if (this.showConfig && !this.originalConfig) {
      this.loadConfig();
    }
  }

  ngOnChanges() {
    if (this.showConfig && !this.originalConfig) {
      this.loadConfig();
    }
  }

  private loadConfig() {
    this.apiService.getConfig().subscribe({
      next: (config: Config) => {
        this.config = { ...config };
        this.originalConfig = { ...config };
      },
      error: (error) => {
        console.error('Failed to load config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to load configuration');
      }
    });
  }

  hasConfigChanges(): boolean {
    if (!this.originalConfig) return false;
    return JSON.stringify(this.config) !== JSON.stringify(this.originalConfig);
  }

  saveConfig() {
    this.apiService.updateConfig(this.config).subscribe({
      next: (updatedConfig: Config) => {
        this.config = { ...updatedConfig };
        this.originalConfig = { ...updatedConfig };
        this.configSaved.emit(updatedConfig);
        this.notifyService.presentToast('Configuration updated successfully', 'Success');
      },
      error: (error) => {
        console.error('Failed to update config:', error);
        this.notifyService.presentErrorToast('Configuration Error', 'Failed to update configuration');
      }
    });
  }

  close() {
    this.closed.emit();
  }
}
