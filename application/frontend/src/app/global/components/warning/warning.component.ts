import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IonicModule, ModalController } from '@ionic/angular';
import { LoggerService } from '../../services/logger/logger.service';

@Component({
  selector: 'app-warning',
  templateUrl: './warning.component.html',
  styleUrls: ['./warning.component.scss'],
  imports: [
    CommonModule,
    IonicModule,
  ]
})
export class WarningComponent implements OnInit {

  logType = "[Component]";
  logName = "[WarningDialogue]";

  /**
   * WARNING: This message allows html formatting all ways to feed data
   * into this variable have to be secure or we risk XSS
   */
  @Input() message: string;
  @Input() reference: any;

  @Input() leftButtonAction: (param?: any) => void;
  @Input() leftButtonLabel?: string = "Okay";
  @Input() leftButtonColor?: string = "primary";

  @Input() rightButtonAction: (param?: any) => void;
  @Input() rightButtonLabel?: string = "Cancel";
  @Input() rightButtonColor?: string = "danger";

  /**
   * An optional parameter of any type, that will be supplied to the callback
   */
  @Input() param?: any;

  safeMessage: SafeHtml;

  constructor(
    private modalController: ModalController,
    private sanitizer: DomSanitizer,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    this.safeMessage = this.getAsHTML(this.message);
  }

  doOnLeft() {
    this.modalController.dismiss().then(() => {
      if (this.leftButtonAction) {
        this.leftButtonAction.call(this.reference, this.param);
      }
    });
  }

  doOnRight() {
    this.modalController.dismiss().then(() => {
      if (this.rightButtonAction) {
        this.rightButtonAction.call(this.reference);
      }
    });
  }

  getAsHTML(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }


  dismiss() {
    this.modalController.dismiss();
  }
}
