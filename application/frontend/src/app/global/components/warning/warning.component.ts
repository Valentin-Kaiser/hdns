import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
  ]
})
export class WarningComponent implements OnInit, OnChanges {
  logType = "[Component]";
  logName = "[WarningDialogue]";

  /**
   * WARNING: This message allows html formatting all ways to feed data
   * into this variable have to be secure or we risk XSS
   */
  @Input() message: string = '';
  @Input() hint: string = '';
  @Input() reference: any;

  @Input() leftButtonAction: (param?: any) => void;
  @Input() leftButtonLabel?: string = "Okay";
  @Input() leftButtonColor?: string = "primary";

  @Input() rightButtonAction?: (param?: any) => void;
  @Input() rightButtonLabel?: string = "Cancel";
  @Input() rightButtonColor?: string = "danger";

  @Input() showCheckbox: boolean = false;
  @Input() checkboxLabel: string = '';
  @Input() checkboxValue: boolean = false;
  @Input() checkboxChange?: (checked: boolean) => void;

  checkboxChecked: boolean = false;

  /**
   * An optional parameter of any type, that will be supplied to the callback
   */
  @Input() param?: any;

  safeMessage: SafeHtml = '';
  safeHint: SafeHtml = '';

  constructor(
    private modalController: ModalController,
    private sanitizer: DomSanitizer,
    private logger: LoggerService
  ) { }

  ngOnInit() {
  this.safeMessage = this.getAsHTML(this.message.trim());
  this.safeHint = this.getAsHTML(this.hint.trim());
  this.checkboxChecked = this.checkboxValue;
  this.logger.debug(`${this.logType}${this.logName} Component initialized with message: ${this.message}`);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['message'] && changes['message'].currentValue !== changes['message'].previousValue) {
      this.safeMessage = this.getAsHTML(this.message.trim());
      this.safeHint = this.getAsHTML(this.hint.trim());
    }
    if (changes['checkboxValue'] && changes['checkboxValue'].currentValue !== changes['checkboxValue'].previousValue) {
      this.checkboxChecked = changes['checkboxValue'].currentValue;
    }
  }

  doOnLeft() {
    this.modalController.dismiss().then(() => {
      if (this.leftButtonAction) {
        // Pass checkboxChecked as second param for generic use
        this.leftButtonAction.call(this.reference, this.param, this.checkboxChecked);
      }
      if (this.checkboxChange) {
        this.checkboxChange(this.checkboxChecked);
      }
    });
  }

  doOnRight() {
    this.modalController.dismiss().then(() => {
      if (this.rightButtonAction) {
        this.rightButtonAction.call(this.reference, this.param);
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
