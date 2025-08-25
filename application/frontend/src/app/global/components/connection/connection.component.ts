import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

@Component({
	selector: 'app-connection',
	templateUrl: './connection.component.html',
	styleUrls: ['./connection.component.scss'],
	imports: [
		CommonModule,
		IonicModule,
	]
})
export class ConnectionComponent implements OnInit {
	@Input() initiated: BehaviorSubject<boolean>;
	@Input() connected: BehaviorSubject<boolean>;

	constructor(
		private modalController: ModalController
	) { }

	ngOnInit() {
	}

	dismiss() {
		if (this.connected.value) {
			this.modalController.dismiss();
		}
	}
}