import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import * as IonIcons from 'ionicons/icons';
import { ApiService } from './global/services/api/api.service';
import { LoggerService } from './global/services/logger/logger.service';
import { NotifyService } from './global/services/notify/notify.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [
    IonApp,
    IonRouterOutlet
  ],
  providers: [
    ApiService,
    NotifyService,
    ModalController,
  ],
})
export class AppComponent implements OnInit {
  logType = "[Main]";
  logName = "[AppComponent]";

  constructor(
    private logger: LoggerService,
    private notifyService: NotifyService,
    private apiService: ApiService,
  ) {
    addIcons(IonIcons);
    this.logger.info(`${this.logType} ${this.logName} constructor`);
  }

  ngOnInit() {
    this.logger.info(`${this.logType} ${this.logName} ngOnInit`);
    this.apiService.info().subscribe({
      next: (response) => {
        this.logger.info(`${this.logType} ${this.logName} API info response:`, response);
        if (response) {
          this.notifyService.presentToast("API is running");
          return;
        }
        this.notifyService.presentErrorToast("API is not running");
      },
      error: (error) => {
        this.logger.error(`${this.logType} ${this.logName} API info error:`, error);
        this.notifyService.presentErrorToast("API is not running");
      }
    })
  }
}
