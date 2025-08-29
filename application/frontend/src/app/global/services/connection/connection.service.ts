import { Injectable, OnDestroy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ModalController } from "@ionic/angular";
import { BehaviorSubject, finalize } from "rxjs";
import { ConnectionComponent } from "../../components/connection/connection.component";
import { ApiService } from "../api/api.service";
import { LoggerService } from "../logger/logger.service";
import { NotifyService } from "../notify/notify.service";

@Injectable({
	providedIn: "root",
})
export class ConnectionService implements OnDestroy {
	logType = "[Service]";
	logName = "[Connection]";

	modal: HTMLIonModalElement;

	interval: number = 3000;
	intervalID;
	refreshIntervalID;

	testing: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
	initiated: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
	connected: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
	private onConnectionEstablished: () => void;
	onConnectionChanged: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

	constructor(
		private apiService: ApiService,
		private notifyService: NotifyService,
		private modalController: ModalController,
		private logger: LoggerService,
		private route: ActivatedRoute
	) {
		this.logger.info(`${this.logType} ${this.logName} constructor`);
		this.route.queryParams.subscribe(params => {
			const interval = +params["refresh"];
			if (!interval) {
				this.refreshIntervalID && clearInterval(this.refreshIntervalID);
			}
			if (interval && (interval >= 10 || interval <= 300)) {
				this.refreshIntervalID && clearInterval(this.refreshIntervalID);
				this.refreshIntervalID = setInterval(() => {
					this.logger.info(`${this.logType} ${this.logName} refreshing`, interval);
					if (this.onConnectionEstablished)
						this.onConnectionEstablished();
				}, interval * 1000);
			}
		});

		this.presentModal();
		setTimeout(() => {
			this.checkApiAvailability();
		}, 300);
		this.intervalID = setInterval(this.checkApiAvailability.bind(this), this.interval);
	}

	public init() {
		this.logger.info(`${this.logType} ${this.logName} init`);
	}

	public isConnected(): boolean {
		return this.connected.value;
	}

	public registerConnectionEstablished(callback: () => void) {
		this.logger.info(`${this.logType} ${this.logName} registerConnectionEstablished`, callback);
		this.onConnectionEstablished = callback;
	}

	checkApiAvailability() {
		if (this.testing.value) {
			return;
		}

		this.logger.info(`${this.logType} ${this.logName} checkApiAvailability`);
		this.testing.next(true);
		this.apiService.info().pipe(
			finalize(() => {
				this.testing.next(false);
				setTimeout(() => {
					if (!this.initiated.value) {
						this.initiated.next(true);
					}
					if (this.connected.value) {
						this.dismissModal();
					}
				}, 400);
				this.interval = this.connected.value ? 30000 : 5000;
				clearInterval(this.intervalID);
				this.intervalID = setInterval(this.checkApiAvailability.bind(this), this.interval);
			})
		).subscribe({
			next: () => {
				this.logger.info(`${this.logType} ${this.logName} checkApiAvailability success`);
				if (!this.connected.value) {
					this.connected.next(true);
					if (this.onConnectionEstablished) {
						this.onConnectionEstablished();
					}
				}
			},
			error: () => {
				this.logger.error(`${this.logType} ${this.logName} checkApiAvailability error`);
				if (this.connected.value) {
					this.connected.next(false);
					this.presentModal();
				}
			}
		});
	}

	async initModal() {
		this.logger.info(`${this.logType} ${this.logName} initModal`);

		this.modal = await this.modalController.create({
			component: ConnectionComponent,
			animated: false,
			cssClass: "full-size",
			componentProps: {
				initiated: this.initiated,
				connected: this.connected,
				onConnectionChanged: this.onConnectionChanged,
			}
		});
	}

	async presentModal() {
		this.logger.info(`${this.logType} ${this.logName} presentModal`, this.modal);
		if (!this.modal) {
			await this.initModal();
		}
		this.notifyService.dismissLoading();
		return await this.modal.present().catch((error) => {
			this.logger.error(`${this.logType} ${this.logName} presentModal`, error);
		});
	}

	async dismissModal() {
		this.logger.info(`${this.logType} ${this.logName} dismissModal`);
		if (this.modal) {
			await this.modal.dismiss().catch((error) => {
				this.logger.error(`${this.logType} ${this.logName} dismissModal`, error);
			});
			this.modal = null;
			return;
		}
	}

	ngOnDestroy() {
		if (this.interval) {
			clearInterval(this.interval);
		}
	}
}