import { Injectable } from "@angular/core";
import { LoadingController, ModalController, ToastController } from "@ionic/angular";
import { ErrorComponent } from "../../components/error/error.component";
import { WarningComponent } from "../../components/warning/warning.component";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class NotifyService {
	/**
	 * Log Type
	 *
	 * @memberof NotifyService
	 */
	logType = "[Service]";

	/**
	 * Log Name
	 *
	 * @memberof NotifyService
	 */
	logName = "[Notify]";

	/**
	 * instance of current active loading indicator - only one indicator must be present at a time
	 * otherwise sproadic error "Uncaught (in promise): removeView was not found"
	 *
	 * @private
	 * @type {HTMLIonLoadingElement}
	 * @memberof NotifyService
	 */
	private isPresentLoading: HTMLIonLoadingElement;

	/**
	 * Wether the notification should dismiss
	 *
	 * @private
	 * @type {boolean}
	 * @memberof NotifyService
	 */
	private requestDismiss: boolean;

	private toast: HTMLIonToastElement;
	private errortoast: HTMLIonToastElement;

	private queue: HTMLIonToastElement[] = [];
	private active: HTMLIonToastElement[] = [];
	private dismissAllButton: HTMLParagraphElement;

	constructor(
		private toastController: ToastController,
		private loadingController: LoadingController,
		private logger: LoggerService,
		private modalController: ModalController
	) {
		this.logger.info(`${this.logType} ${this.logName} constructor`);

		setInterval(() => {
			const toast = this.queue.pop();
			if (toast) {
				toast.style.top = '-24px';
				toast.style.transform = `translateY(-${this.active.length * 65}px)`;
				var style = document.createElement('style');
				style.innerHTML = `
					.toast-wrapper {
						margin-inline: unset !important;
						margin-inline-start: auto !important;
						animation: slideIn 0.5s ease-in-out forwards;
					}

					@keyframes slideIn {
						from {
							transform: translateX(100%);
						}
						to {
							transform: translateX(0);
						}
					}

				`;
				toast.shadowRoot.appendChild(style);
				this.active.push(toast);
				if (this.active.length > 3) {
					this.active[0].dismiss().catch(() => { });
					this.active = this.active.slice(-3);
				}

				toast.present();
				toast.onWillDismiss().then(() => {
					this.active = this.active.filter(t => t !== toast);
					this.active.forEach((t, i) => {
						t.style.transform = `translateY(-${i * 65}px)`;
					}
					);
				});

				if (this.dismissAllButton) {
					this.dismissAllButton.innerText = `Dismiss all ${this.active.length + this.queue.length} notifications`;
				}
			}

			(this.active.length > 1) ? this.createDismissAllButton() : this.removeDismissAllButton();
		}, 1000);
	}

	/**
	 * Standard info to user - floating from top away
	 *
	 * @param {string} msg
	 * @param {number} [duration=3000]
	 * @returns
	 * @memberof NotifyService
	 */
	async presentToast(title: string, msg?: string, duration: number = 5000) {
		this.toast = await this.toastController.create({
			header: title,
			message: msg,
			duration,
			position: "bottom",
			cssClass: 'toast',
			buttons: [
				{
					side: "end",
					text: "OK",
				},
			],
		});

		this.queue.push(this.toast);
	}

	/**
	 * Show error to user - floating from bottom away
	 *
	 * @param {string} msg
	 * @param {number} [duration=9000]
	 * @returns
	 * @memberof NotifyService
	 */
	async presentErrorToast(title: string, msg?: string, duration: number = 5000) {
		let err = "";
		if (msg) {
			err = this.extractErrorMessage(msg);
		}
		this.errortoast = await this.toastController.create({
			header: title,
			message: err,
			duration,
			position: "bottom",
			cssClass: 'error-toast',
			buttons: [
				{
					side: "end",
					icon: "information-circle",
					handler: () => {
						this.presentErrorDetailModal(msg);
					},
				},
				{
					side: "end",
					text: "OK",
					handler: () => {

					},
				},
			],
		});

		this.queue.push(this.errortoast);
	}

	/**
	 * Loading indicators - only one at a time - thus not returning the instance.
	 * To dismiss call dismissLoading()
	 *
	 * @param {string} [msg='Loading...']
	 * @param {number} [duration=8000]
	 * @returns
	 * @memberof NotifyService
	 */
	async presentLoading(msg: string = "Loading...", duration: number = 3000) {
		this.logger.debug(
			`${this.logType} ${this.logName} presentLoading - START.`
		);

		// only one loading indicator at a time
		if (this.isPresentLoading) {
			return;
		}

		this.isPresentLoading = await this.loadingController.create({
			message: msg,
			// safe guard - after xyz ms automatically remove the indicator
			duration,
		});

		if (this.requestDismiss) {
			this.logger.debug(
				`${this.logType} ${this.logName} presentLoading - Request Dismiss.`
			);
			this.isPresentLoading.dismiss().catch(() => { });
			this.isPresentLoading = null;
			this.requestDismiss = false;
			return;
		}

		this.isPresentLoading.present();
		this.logger.debug(
			`${this.logType} ${this.logName} presentLoading - Present.`
		);
	}

	/**
	 * Dismiss a loading indicator
	 *
	 * @returns
	 * @memberof NotifyService
	 */
	dismissLoading() {
		this.logger.debug(`${this.logType} ${this.logName} presentLoading - END.`);
		if (this.isPresentLoading) {
			this.logger.debug(
				`${this.logType} ${this.logName} presentLoading - Dismissed.`
			);
			this.isPresentLoading.dismiss().catch(() => { });
			this.isPresentLoading = null;
			return;
		}
		this.requestDismiss = true;
	}

	/**
	 * Shows a warning dialogue with the specified message and Button labels.
	 * Pressing a button will call the corresponding callback function
	 *
	 * @param message the message to use for the modal
	 * @param acceptButtonLabel the label of the accept button
	 * @param cancelButtonLabel the label of the cancel button
	 * @param onAccept the callback function to be called if the accept button is pressed
	 * @param onCancel the callback function to be called if the cancel button is pressed
	 */
	async showWarning(
		reference: any,
		message: string,
		leftButtonAction: (param?: any) => void,
		rightButtonAction: (param?: any) => void,
		leftButtonLabel?: string,
		rightButtonLabel?: string,
		leftButtonColor?: string,
		rightButtonColor?: string,
		hint?: string,
		param?: any
	) {
		const modal = await this.modalController.create({
			component: WarningComponent,
			backdropDismiss: true,
			showBackdrop: true,
			cssClass: "auto-height",
			componentProps: {
				reference,
				message,
				leftButtonAction,
				rightButtonAction,
				leftButtonLabel,
				rightButtonLabel,
				leftButtonColor,
				rightButtonColor,
				hint,
				param,
			},
		});
		return await modal.present();
	}

	async presentErrorDetailModal(error: string) {
		const modal = await this.modalController.create({
			component: ErrorComponent,
			backdropDismiss: true,
			showBackdrop: true,
			cssClass: "auto-height warning-auto-height",
			componentProps: {
				message: error,
			},
		});
		return await modal.present();
	}

	// Creates a small line of text below the first toast at the bottom of the screen
	createDismissAllButton() {
		if (this.dismissAllButton) {
			return
		}

		this.dismissAllButton = document.createElement('p');
		this.dismissAllButton.innerText = `Dismiss all ${this.active.length + this.queue.length} notifications`;
		this.dismissAllButton.classList.add('dismiss-notifications-button');
		this.dismissAllButton.onclick = () => {
			this.active.forEach(toast => toast.dismiss().catch(() => { }));
			this.queue.forEach(toast => toast.dismiss().catch(() => { }));
			this.active = [];
			this.queue = [];
		}

		document.body.appendChild(this.dismissAllButton);
	}

	removeDismissAllButton() {
		if (this.dismissAllButton) {
			this.dismissAllButton.remove();
			this.dismissAllButton = null;
		}
	}

	extractErrorMessage(error: string): string {
		const userPart = error.split('[')[0]?.split('|')[1]?.trim()
		if (!userPart) {
			return error;
		}

		return userPart;
	}
} // class
