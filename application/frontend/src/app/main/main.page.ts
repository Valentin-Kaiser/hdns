import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ApiService } from '../global/services/api/api.service';
import { Address, Record } from '../global/services/api/model/object';
import { NotifyService } from '../global/services/notify/notify.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class MainPage implements OnInit {

  current: Address;
  records: Record[] = [];
  newRecord: Record;

  constructor(
    private apiService: ApiService,
    private notifyService: NotifyService
  ) { }

  ngOnInit() {
    this.refresh();
    this.loadRecords();
  }

  refresh() {
    this.apiService.refreshAddress().subscribe({
      next: (response) => {
        this.current = response;
        this.notifyService.presentToast("Address refreshed");
      },
    });
  }

  loadRecords() {
    this.apiService.records().subscribe({
      next: (response) => {
        this.records = response;
      },
    });
  }

  addRecord() {
    this.newRecord = {
        id: 0,
        created_at: "",
        updated_at: "",
        token: "",
        zone_id: "",
        type: null,
        domain: "",
        name: "",
        ttl: null,
    }
  }

  createRecord() {
    if (!this.newRecord.type || !this.newRecord.domain || !this.newRecord.name || !this.newRecord.ttl) {
      this.notifyService.presentToast("Please fill in all fields");
      return;
    }

    this.apiService.createRecord(this.newRecord).subscribe({
      next: (response) => {
        this.records.push(response);
        this.notifyService.presentToast("Record created successfully");
        this.newRecord = null; // Clear the form
      },
      error: (error) => {
        this.notifyService.presentToast("Error creating record: " + error.message);
      }
    });
  }
}
