import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IonicModule, ModalController } from '@ionic/angular';
import { LoggerService } from '../../services/logger/logger.service';
import { NotifyService } from '../../services/notify/notify.service';

interface Error {
  message: string;
  trace: string[];
  details?: Error;
}

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss'],
  imports: [
    IonicModule,
    CommonModule,
  ]
})
export class ErrorComponent implements OnInit {
  @Input() message: string;

  error: Error;

  clipboard: Clipboard;

  constructor(
    private modalController: ModalController,
    private sanitizer: DomSanitizer,
    private logger: LoggerService,
    private notifyService: NotifyService,
  ) { }

  ngOnInit() {
    this.clipboard = navigator?.clipboard

    if (!this.message) {
      this.notifyService.presentErrorToast('No error message provided');
      return;
    }

    this.error = this.parseError(this.message);
  }

  copy() {
    this.clipboard?.writeText(this.message).then(
      () => { },
      (err: any) => {
        this.notifyService.presentErrorToast("Could not copy to clipboard, error: ", err)
      }
    );
  }

  dismiss() {
    this.modalController.dismiss();
  }

  parseError(errorString: string): Error { 
    const [mainPart, detailsPart] = errorString.split('[').map((part) => part.trim());
    const [tracePart, message] = mainPart.split('|').map((part) => part.trim());

    const trace = tracePart.split('->').map((part) => part.trim());
    const details = detailsPart ? this.parseError(detailsPart.replace(']', '')) : undefined;
  
    return { message, trace, details };
  }
  
}
